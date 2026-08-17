# Design: Completar Cita Atómico

## Technical Approach

Option A (owner-approved): `CompletarCitaUseCase` becomes the transaction owner. When `registro` is present it opens ONE queryRunner, runs all validations first (caja abierta, cliente, usuario, state transition), then calls `CreateRegistroUseCase.execute(registro, qr)` followed by `citaRepo.cambiarEstado(id, COMPLETADA, {completadoPorId}, qr)`, commits, re-fetches both DTOs AFTER commit, releases. Any throw → rollback → nothing persisted. Legacy path (no `registro`) keeps current single-call behavior without explicit transaction.

## Architecture Decisions

| Decision | Choice | Alternatives | Rationale |
|----------|--------|--------------|-----------|
| Transaction owner | `CompletarCitaUseCase` opens ONE qr | Repos each own tx | Cross-module atomicity needs a single shared boundary; matches exploration Option A |
| CreateRegistro reuse | `execute(input, queryRunner?)` optional param | Duplicate logic / extract service | Backward compatible; absent param = own-tx; all inner repo calls already accept `qr` |
| cambiarEstado qr | `cambiarEstado(id, estado, extraData?, queryRunner?)` | New repo method | Minimal interface change; qr optional keeps other callers untouched |
| salonId source | Always from `cita.salonId` | Client payload | Trust boundary — client can't book a registro for another salon |
| Validation order | ALL validations BEFORE first write | Validate inline during writes | Ensures rollback is a true no-op (nothing to undo) |
| State rejection | Reuse `cambiarEstado()` in-memory guard (throws 422 via `UnprocessableEntityError`) | Allow PENDIENTE→COMPLETADA | Retry safety: completed cita → 422 → tx aborts → no duplicate |
| Response | `{ cita, registro }` | Just cita | Frontend ignores body today; exposing registro supports future consumers |

## Data Flow

```
POST /salones/:id/agenda/citas/:citaId/completar  { registro?: {...} }
  → validate(completarCitaSchema)                 // registro optional
  → CompletarCitaUseCase.execute({ id, usuarioId, registro? })
      ├─ citaRepo.findById(id)                    // 404 if missing
      ├─ verificarCajaAbierta(cajaRepo, cita.salonId)   // 422 CAJA_CERRADA
      ├─ if (registro): validate cliente + usuario exist
      ├─ cambiarEstado(cita, COMPLETADA)          // in-memory guard → 422 on invalid
      ├─ if NO registro → citaRepo.cambiarEstado(id, COMPLETADA, {completadoPorId})   // legacy
      └─ if registro:
          qr = AppDataSource.createQueryRunner(); qr.connect(); qr.startTransaction()
          try:
            registro = createRegistroUseCase.execute(registro, qr)   // salonId := cita.salonId
            await citaRepo.cambiarEstado(id, COMPLETADA, {completadoPorId}, qr)
            await qr.commitTransaction()
          catch → qr.rollbackTransaction() → rethrow
          finally → qr.release()
          // READ-AFTER-WRITE: re-fetch via default repo AFTER commit
          cita = await citaRepo.findById(id)
          registroDTO = await registroRepo.findById(registro.id) → registroServicioToDTO
          return { cita: CitaDTO.fromEntity(cita), registro: registroDTO }
```

**Read-after-write gotcha:** inside the tx, TypeORM's `findById` via the same queryRunner can return cached pre-commit state. Always re-fetch DTOs with the DEFAULT repository AFTER `commitTransaction`. `CreateRegistroUseCase` already re-fetches after its own commit when self-tx; when passed a `qr` it MUST skip its own commit/re-fetch (the caller owns that).

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `CompletarCitaUseCase.ts` (agenda/use-cases/cita/) | Modify | Add `registro?`; inject `CreateRegistroUseCase`; atomic flow above |
| `CreateRegistroUseCase.ts` (finanzas/registro/) | Modify | `execute(input, queryRunner?)`; use passed qr; skip own commit/refetch when qr given |
| `ICitaRepository.ts` + `TypeORMCitaRepository.ts` | Modify | Optional `queryRunner?: QueryRunner` on `cambiarEstado` |
| `CitaController.ts` + `agenda.routes.ts` | Modify | Pass `registro`; return `{ cita, registro }`; add `validate(completarCitaSchema)` |
| `packages/validation/src/finanzas.schema.ts` + `index.ts` | Modify | `completarCitaSchema`; export |
| `RegistroServicioEntity.ts` | Modify | Add `citaId: number \| null` column + relation |
| `migrations/1700000000013-AddCitaIdRegistros.ts` | Create | `ALTER TABLE registros_servicio ADD citaId INT NULL` + FK + index |
| `apps/pos-dashboard/src/pages/AgendaPage.tsx` | Modify | Single POST with `{ registro: {...} }`; delete `/registros` call |
| Tests (CompletarCita, CitaController, CreateRegistro) | Modify | Atomic scenarios + regression |

## Interfaces / Contracts

```ts
// CompletarCitaUseCase
interface CompletarCitaInput { id: number; usuarioId?: number; registro?: CreateRegistroInput }
execute(input: CompletarCitaInput): Promise<{ cita: CitaDTO; registro?: RegistroServicioDTO }>

// CreateRegistroUseCase — backward compatible
execute(input: CreateRegistroInput, queryRunner?: QueryRunner): Promise<RegistroServicioDTO>

// ICitaRepository
cambiarEstado(id: number, estado: EstadoCita, extraData?: Partial<CitaEntity>, queryRunner?: QueryRunner): Promise<CitaEntity | null>

// Validation
export const completarCitaSchema = z.object({ registro: createRegistroSchema.optional() });
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit — CompletarCita | Atomic success (one tx: registro + cita), rollback on registro failure, retry→422 no dup, PENDIENTE→422, caja cerrada→422 no write, legacy no-registro, salonId override | Mock repos + queryRunner; assert single qr, commit/rollback/release, DTOs re-fetched after commit |
| Unit — CreateRegistro | qr passthrough: no own commit/release; own-tx when absent | Extend existing test file |
| Unit — Controller/Route | `registro` forwarded; response `{ cita, registro }`; schema validation | Extend `CitaController.test.ts`; schema parse tests |
| E2E/manual | Frontend single call; duplicate-retry scenario | Manual: complete twice via dashboard |

## Migration / Rollout

Migration `1700000000013-AddCitaIdRegistros`: add nullable `citaId` + FK to `citas(id)` + index (mirror `AddCajaIdRegistros` pattern). Nullable → existing rows untouched. Validation package rebuild + API restart required (AGENTS.md). Rollback: migration `down` drops column; code revert restores two-call behavior.

## Open Questions

- None blocking. (Follow-up: deterministic idempotency key for network-ambiguous failures — explicitly out of scope.)
