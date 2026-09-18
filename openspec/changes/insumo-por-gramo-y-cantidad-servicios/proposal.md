# Proposal: Insumo por gramo y cantidad de servicios

## Intent

Supply cost is static (`costoBaseInsumos`), but real products are priced per gram, so commission uses a guessed cost. Verified: registro 182, `(450000 − 114000) × 60% = 201600`. The same service cannot be added twice to a sale or cita ("Pies ×2"); owner decided on a per-line **quantity**, not duplicate lines.

## Scope

### In Scope
- Catalog cost mode `FIJO | POR_GRAMO` + `precioPorGramo`.
- Sale-time gram capture; real cost = grams × price.
- Commission fed the REAL cost (formula unchanged).
- Service-line quantity in walk-in sales and citas.

### Out of Scope
- Gram stock/inventory deduction.
- Backfilling historical registros.
- Product quantities (already exist).

## Capabilities

### New
- `costo-insumos-por-gramo`: cost mode, gram capture, real-cost computation, commission contract.

### Modified
- `servicios-crud`: expose `tipoCostoInsumo` + `precioPorGramo`.
- `servicio-items`: snapshot gains `gramosUsados`/`precioPorGramo`; `costoBaseInsumos` = real line cost.
- `finanzas-registros`: accepts `gramosUsados`/`cantidad`; server computes cost; quantity expands to N rows.
- `agenda-citas`: services carry `cantidad`; duration = Σ(duracion × cantidad).

## Approach

- **Catalog**: `ServicioEntity` gains `tipoCostoInsumo` (default `FIJO`) + nullable `precioPorGramo`; zod, `ServicioDTO`, `ServiciosPage` toggle.
- **Cost**: `CreateRegistroUseCase` computes `costoBaseInsumos = gramosUsados × precioPorGramo` server-side for `POR_GRAMO` lines. Existing sum + `ComisionService` stay intact → split stays fair.
- **Quantity**: walk-in adds `cantidad` per line; the use case expands each into N per-unit rows. Citas replace the M:N join with an explicit `citas_servicios` entity (`cantidad`, default 1); `serviciosIds` still accepted as quantity-1.

## Affected Areas

| Area | Impact |
|---|---|
| `.../entities/ServicioEntity.ts`, `ServicioDTO.ts` | Modified |
| `.../entities/RegistroServicioItemEntity.ts` | Modified |
| `.../registro/CreateRegistroUseCase.ts` | Modified |
| `.../entities/CitaEntity.ts` | Modified |
| `packages/validation/src/*.schema.ts` | Modified |
| `apps/pos-dashboard/.../{ServiciosPage,WalkInModal,AgendaPage}.tsx` | Modified |

## Risks

| Risk | L | Mitigation |
|---|---|---|
| Client-forged per-gram cost | Med | derive cost server-side |
| Cita join PK blocks quantities | Med | explicit join entity |
| Legacy rows lack gram fields | Low | nullable/default |
| validation `dist/` stale | Med | rebuild `packages/validation` |

## Rollback Plan

Additive nullable columns only. Revert commits + `migration:down`; old rows read as `FIJO`/qty 1.

## Dependencies

- `packages/validation` rebuild; MySQL migration (port 3307).

## Success Criteria

- [ ] `POR_GRAMO` CRUD + DTO round-trips.
- [ ] Sale grams → snapshot cost = grams × price; commission uses it (case 182).
- [ ] Service ×2 in walk-in → 2 item rows, correct totals.
- [ ] Cita ×2 accepted; duration doubles; completar items correct.
- [ ] `FIJO`/qty-1 regression green (`npx vitest run`, `tsc --noEmit`).
