# Tasks: Completar Cita Atómico

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~330 (additions+deletions) |
| 400-line budget risk | Medium |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | single-pr |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Backend atomic flow + migration + validation | PR 1 (single) | Includes tests per file |

## Phase 1: Foundation

- [x] 1.1 Create `apps/api/src/infrastructure/persistence/migrations/1700000000013-AddCitaIdRegistros.ts` — add nullable `citaId` INT + FK → `citas(id)` + index (mirror `1700000000010-AddCajaIdRegistros.ts`); run migration
- [x] 1.2 Add `citaId: number | null` column + `@ManyToOne(() => CitaEntity)` relation to `RegistroServicioEntity.ts`

## Phase 2: Core — Atomic Transaction

- [x] 2.1 Modify `CreateRegistroUseCase.execute(input, queryRunner?)` — when qr passed: use it for all repo writes, skip own `createQueryRunner/commit/rollback/release` and post-commit re-fetch
- [x] 2.2 Modify `ICitaRepository.cambiarEstado(id, estado, extraData?, queryRunner?)` + `TypeORMCitaRepository` impl — use `qr.manager.getRepository(CitaEntity)` when qr passed
- [x] 2.3 Modify `CompletarCitaUseCase` — add `registro?` to input; inject `CreateRegistroUseCase` (class token, registered in `container.ts`)
- [x] 2.4 Implement atomic flow: validate caja/cliente/usuario/state-machine → open qr → `createRegistro(registro, qr)` → `cambiarEstado(..., qr)` → commit → re-fetch DTOs after commit → release; salonId from `cita.salonId`; return `{ cita, registro }`
- [x] 2.5 Keep legacy path: no `registro` → current single-call behavior (no explicit tx)

## Phase 3: API Wiring + Validation

- [x] 3.1 Add `completarCitaSchema = z.object({ registro: createRegistroSchema.optional() })` to `packages/validation/src/finanzas.schema.ts`; export from `index.ts`; rebuild (`cd packages/validation && npx tsc`)
- [x] 3.2 Update `CitaController.completar` — pass `registro: req.body?.registro`; return `{ cita, registro }`
- [x] 3.3 Add `validate(completarCitaSchema)` to `POST /agenda/citas/:id/completar` in `agenda.routes.ts`

## Phase 4: Frontend — Single Call

- [x] 4.1 Update `AgendaPage.tsx handleConfirmarCompletar` — build same payload, nest under `registro`, single `POST /salones/:id/agenda/citas/:id/completar`; delete the separate `POST /registros` call (L580)
- [x] 4.2 Keep existing error handling (`isCajaCerradaError` + `dispatchCajaRefresh`); verify modal stays open on error

## Phase 5: Tests (spec scenarios)

- [x] 5.1 `CompletarCitaUseCase.test.ts` — atomic success: single qr, registro + cita, `{ cita, registro }`; rollback: registro failure → no cita state change; retry on COMPLETADA → 422 no dup; PENDIENTE → 422 no registro; caja cerrada → 422 no write; legacy no-registro; salonId override (spec: Completar Cita Atómico, Reintento, Caja Cerrada, Legacy)
- [x] 5.2 `CreateRegistroUseCase.test.ts` — qr passthrough: no own commit/release; own-tx when absent
- [x] 5.3 `CitaController.test.ts` — `registro` body forwarded; response `{ cita, registro }`; `completarCitaSchema` parse tests (optional registro)
- [x] 5.4 Verify: `cd apps/api && npx vitest run` (all modules) + `npx tsc --noEmit`

## Phase 6: Cleanup

- [ ] 6.1 Manual smoke: complete cita via dashboard — exactly one POST in network tab; complete twice → 422, one registro (requires running server — for verify/manual phase)
- [x] 6.2 Update `openspec/changes/completar-cita-atomico/tasks.md` checkboxes; ensure no dead code (e.g. unused imports)

## Dependency Notes

- Validation rebuild before API restart (AGENTS.md: API imports `dist/`)
- Migration order: `1700000000013` after existing 12 migrations
- `CreateRegistroUseCase` already class-token registered in `container.ts` L293 → injectable into agenda module
