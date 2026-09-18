# Design: Insumo por gramo y cantidad de servicios

## Technical Approach

At sale time the server resolves each `POR_GRAMO` service, computes `gramosUsados × precioPorGramo`, snapshots it, and feeds the unchanged `ComisionService`. Quantity expands each line into N per-unit rows; citas persist `cantidad` on an explicit join entity. Reports sum the persisted cost, staying correct by construction.

## Architecture Decisions

| # | Decision | Choice | Why / rejected |
|---|---|---|---|
| 1 | Per-gram × quantity | `gramosUsados` is **per unit**; N units → N identical rows | Quantity multiplies price and grams like products; rows are the truth. Rejected line-total grams: ambiguous snapshot, needs division. |
| 2 | Cita duplicates | Explicit `CitaServicioEntity` on `citas_servicios`, composite PK + `cantidad INT DEFAULT 1` | Rejected M:N+column: TypeORM can't expose extra join columns (raw SQL, loses eager loading); duplicate M:N rows are blocked by the PK. |
| 3 | `totalServicios` recompute | **Yes** when items exist: server sets `Σ(precioServicio × cantidad)` for `montoTotal`, proration and commission; empty → payload (legacy) | Both sides of `total − cost` come from one source; blocks income forgery. |
| 4 | Grams validation | Zod = shape (`positive().optional()`, `cantidad int ≥1`); use case = semantic (`POR_GRAMO` without grams → 422 before writes) | Only the use case resolves the catalog; mirrors the `categoriaId`/salon check. |
| 5 | Single cost point | New pure `CostoInsumoService`, called once by `CreateRegistroUseCase`; reports read the snapshot | Cost cannot diverge. Rejected extending `ComisionService` and inline math. |

**Migration impact (verified live).** Local (`DB_SYNCHRONIZE=true`) has `citas_servicios(citasId, serviciosId, PK)`; the `InitialSchema` migration defines `citaId/servicioId` (prod). We standardize on the migration names: local synchronize drops/recreates the 2-row dev table; prod only adds `cantidad DEFAULT 1`. Migrate `CitaDTO`, `TypeORMCitaRepository`, `DisponibilidadService`, `CreateCitaUseCase` to `citasServicios.servicio`.

## Data Model

| Table | Column | Type | Default/Null | Legacy read |
|---|---|---|---|---|
| `servicios` | `tipoCostoInsumo` | varchar(20) | `'FIJO'` | FIJO |
| `servicios` | `precioPorGramo` | decimal(12,2) | NULL | null |
| `registros_servicio_items` | `gramosUsados` | decimal(12,2) | NULL | null |
| `registros_servicio_items` | `precioPorGramo` | decimal(12,2) | NULL | null |
| `citas_servicios` | `cantidad` | int | 1 | 1 |

`TipoCostoInsumo = 'FIJO' | 'POR_GRAMO'`. New migration `1700000000014-AddCostoPorGramoYCantidad.ts`.

## API / DTO / Validation

| Surface | Change |
|---|---|
| `ServicioDTO` / `ServicioEntity` | +`tipoCostoInsumo`, `precioPorGramo` |
| `RegistroServicioItemDTO` / entity | +`gramosUsados`, `precioPorGramo` |
| `CitaDTO.servicios[]` | +`cantidad`; `duracionTotalMinutos = Σ(duracion × cantidad)` |
| `createRegistroSchema.serviciosItems` | +`gramosUsados` (>0 opt), `cantidad` (int≥1, default 1) |
| `createCitaSchema` | accept `servicios: [{servicioId, cantidad}]` **or** legacy `serviciosIds`; require one; normalize in `CitaController` |

**Catalog gotcha:** `.superRefine` yields `ZodEffects` and breaks `.partial()`; keep a plain `servicioBaseSchema`, refine `POR_GRAMO → precio>0` on create only, and enforce the update rule in the use case.

## Cost Function Contract

```ts
calcularCostoLinea({ tipoCostoInsumo, precioPorGramo, gramosUsados, costoBaseInsumos }): number
// FIJO or missing -> Number(costoBaseInsumos ?? 0)
// POR_GRAMO       -> round2(gramosUsados * precioPorGramo)  // gramos > 0 guaranteed
```

Item snapshots `gramosUsados`/`precioPorGramo`; `costoBaseInsumos` = result.

## Frontend Flows

- **ServiciosPage** (`:731-739`): segmented `FIJO | POR_GRAMO`; POR_GRAMO hides `costoBaseInsumos`, shows `precioPorGramo`. Sends `precioPorGramo` only when POR_GRAMO.
- **WalkInModal** (`:405-419`, `:549-554`, `:1009`): `CartItem` gains `cantidad`, `tipoCostoInsumo`, `precioPorGramo`, `gramosUsados`. Re-click increments `cantidad`; add a qty stepper + per-unit grams input for POR_GRAMO (like product rows). `totalServicios = Σ(precio × cantidad)`; submit blocked while a POR_GRAMO line lacks grams; recibo uses `cantidad`.
- **AgendaPage** (`:254`, `:528`, `:650-666`): create form pairs ids with `servicioCantidades` (default 1), sends `servicios`. Completar multiplies `precio × cantidad` and sends per-line `cantidad`.

## Edge Cases

- FIJO ignores `gramosUsados`; POR_GRAMO ignores client `costoBaseInsumos`.
- POR_GRAMO without grams → 422, nothing persists (cita path rolls back via QR).
- `serviciosItems=[]` → legacy `totalServicios`; mixed modes sum by rows.
- `insumos > totalServicios` → commission 0 (unchanged).

## Testing Strategy

| Layer | What | Approach |
|---|---|---|
| Unit | `CostoInsumoService` FIJO/POR_GRAMO/rounding; `ComisionService` case 182 (450000−114000)×60% = 201600 | pure instantiation |
| Unit | zod: gram/cantidad accept-reject; POR_GRAMO without price; cita `cantidad=0` | parse payloads |
| Unit | `CreateRegistroUseCase`: derives cost ignoring client 0, expands ×N, recomputes `totalServicios`, 422 missing grams, FIJO regression | mocked repos |
| Unit | `CreateCitaUseCase`: duration/overlap use `Σ(duracion × cantidad)` | mocked repos |
| Unit | DTOs map `cantidad`/gram fields + legacy nulls | fixtures |

Strict TDD (`vitest`): `cd apps/api && npx vitest run`; rebuild validation (`npx tsc`); `tsc --noEmit`. No supertest harness exists.

## Rollback / Backwards Compat

Additive columns only. Revert commits + `migration:down`; PK unchanged, M:N restorable. Old rows read `FIJO`/`cantidad=1`; legacy `serviciosIds` = qty 1. No backfill.

## Open Questions

- [ ] Add a supertest harness, or keep DB scenarios unit-level?
- [ ] Local join-table recreate loses the 2 dev rows — acceptable?
