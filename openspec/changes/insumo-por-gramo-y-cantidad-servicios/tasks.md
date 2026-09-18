# Tasks: Insumo por gramo y cantidad de servicios

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~1,700 (±300), tests included |
| 400-line budget risk | High (session budget is 800) |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → PR 2 → PR 3 |
| Delivery strategy | auto-forecast |
| Chain strategy | stacked-to-main |

```text
Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High
```

Per-area estimates (additions+deletions): DB/entities/migrations ~180; `packages/validation` ~180; API use-cases/services/DTOs ~520; API tests ~520; frontend ~450; frontend tests ~200. `packages/validation/dist` is gitignored — rebuilding adds zero review lines.

> Deviation from design: three slice-owned migrations (014 servicios, 015 item grams, 016 citas_servicios) instead of one, so each slice rolls back alone. **Correction (verified live):** the real table is `citas_servicios(citasId, serviciosId)` (TypeORM `synchronize`); production was never migrated (`DB_SYNCHRONIZE=true`), so migration 016 is additive (`ADD cantidad DEFAULT 1`) and renames no column.

### Suggested Work Units

| Unit | Goal | Likely PR | Base |
|------|------|-----------|------|
| 1 | Catalog cost mode end-to-end (~350) | PR 1 | main |
| 2 | Per-gram cost + quantity in walk-in sales (~720) | PR 2 | PR 1 |
| 3 | Cita cantidad via explicit join entity (~670) | PR 3 | PR 2 |

Each unit keeps tests with its code; each is independently shippable. Verify: `cd apps/api && npx vitest run`, `cd apps/pos-dashboard && npx vitest run`, `npx tsc --noEmit` (both apps). Rollback: revert slice commits; migrations are additive with `down()`.

## Phase 1 — PR 1: Catalog cost mode (`FIJO|POR_GRAMO`)

- [x] 1.1 RED: add `.../catalogo/.../__tests__/servicios.schema.test.ts` — accept/reject `tipoCostoInsumo`/`precioPorGramo`; `update (.partial())` still parses. Verify `npx vitest run servicios.schema`.
- [x] 1.2 GREEN: `packages/validation/src/catalogo.schema.ts` — plain `servicioBaseSchema`; refine `POR_GRAMO → precioPorGramo>0` on create only. Rebuild `packages/validation` (`npx tsc`).
- [x] 1.3 `ServicioEntity`: add `tipoCostoInsumo` varchar(20) default `FIJO`, `precioPorGramo` decimal(12,2) nullable.
- [x] 1.4 Migration `1700000000014-AddCostoPorGramoServicios.ts` (additive; `down` drops both).
- [x] 1.5 RED→GREEN: `ServicioDTO` exposes both (legacy → `FIJO`/null); `ServicioController.test.ts` create/update POR_GRAMO 201/422.
- [x] 1.6 `CreateServicioUseCase`/`UpdateServicioUseCase` pass fields; update path: POR_GRAMO without positive price → 422.
- [x] 1.7 Frontend: `services/servicioService.ts` `Servicio` + fields; `ServiciosPage.tsx` segmented FIJO|POR_GRAMO (hide `costoBaseInsumos`, show `precioPorGramo`).
- [x] 1.8 RED→GREEN: `ServiciosPage.test.tsx` toggle + submit payload.
- [x] 1.9 Verify unit 1 (api + dashboard vitest, both `tsc --noEmit`).

## Phase 2 — PR 2: Grams cost + quantity in walk-in sales

- [x] 2.1 `RegistroServicioItemEntity`: add nullable `gramosUsados`/`precioPorGramo` decimal(12,2).
- [x] 2.2 Migration `1700000000015-AddGramosUsadosItem.ts` (+ `down`).
- [x] 2.3 RED: `CostoInsumoService.test.ts` — FIJO passthrough, POR_GRAMO 95×1200=114000, round2, commission case 182 = 201600, insumos>total → 0.
- [x] 2.4 GREEN: new `.../finanzas/application/services/CostoInsumoService.ts` (`calcularCostoLinea`).
- [x] 2.5 RED→GREEN: `finanzas.schema.ts` + tests — `gramosUsados` >0 optional, `cantidad` int≥1 default 1.
- [x] 2.6 RED→GREEN: `RegistroServicioItemDTO` + test — gram snapshot; legacy nulls.
- [x] 2.7 RED: extend `CreateRegistroUseCase.test.ts` — client-forged cost ignored, POR_GRAMO sin gramos → 422 (nothing persists), ×N rows, `totalServicios=Σ(precio×cantidad)`, FIJO regression.
- [x] 2.8 GREEN: `CreateRegistroUseCase.ts` — single `CostoInsumoService` point, expand each line ×`cantidad`, recompute `totalServicios`/cost when items present; persist snapshots.
- [x] 2.9 RED→GREEN: report tests — `PyLMensualUseCase`/`ResumenDiaUseCase` sum persisted cost (114000, 150000).
- [x] 2.10 Frontend `WalkInModal.tsx`: `CartItem` + `cantidad`/`tipoCostoInsumo`/`precioPorGramo`/`gramosUsados`; re-click increments; qty stepper; grams input; block submit without grams; receipt uses `cantidad`.
- [x] 2.11 RED→GREEN: `WalkInModal.test.tsx` grams/qty payload.
- [x] 2.12 Verify unit 2.

## Phase 3 — PR 3: Cita cantidad (explicit join) + AgendaPage

- [x] 3.1 New `entities/CitaServicioEntity.ts` on `citas_servicios`, composite PK, `cantidad` int default 1.
- [x] 3.2 Migration `1700000000016-AddCantidadCitaServicios.ts`; additive `ADD cantidad DEFAULT 1` on the live `citasId/serviciosId` table (no rename).
- [x] 3.3 `CitaEntity`/`ServicioEntity`: replace `@ManyToMany` with OneToMany `citasServicios`.
- [x] 3.4 RED→GREEN: `CitaDTO` + `cantidad`; `duracionTotalMinutos=Σ(duracion×cantidad)`; legacy `cantidad=1`.
- [x] 3.5 `agenda.schema.ts`: accept `servicios:[{servicioId,cantidad}]` OR legacy `serviciosIds`; tests reject `cantidad=0`.
- [x] 3.6 `CitaController` normalize input; `CreateCitaUseCase` duration/overlap use expanded duration.
- [x] 3.7 `TypeORMCitaRepository`/`DisponibilidadService` read `citasServicios.servicio`; update their tests.
- [x] 3.8 RED→GREEN: `CompletarCitaUseCase` test — `cantidad=2` → 2 item rows, `totalServicios=40000`.
- [x] 3.9 Frontend `AgendaPage.tsx`: `Cita` types + `cantidad`; create `servicioCantidades` sends `servicios`; completar per-line `cantidad`/grams.
- [x] 3.10 RED→GREEN: `AgendaPage.test.tsx`.
- [x] 3.11 Verify unit 3 + full suites both apps + `tsc --noEmit` + validation rebuild.

## Phase 4 — Documentation

- [ ] 4.1 `AGENTS.md` gotchas: `tipoCostoInsumo`/`precioPorGramo`, quantity semantics, join-table naming, validation rebuild.
