# Tasks: Carga Histórica — Backfill del Cuaderno

## Review Workload Forecast

| Campo | Valor |
|-------|-------|
| Líneas estimadas | ~750–960 (código + tests, 3 PRs) |
| Riesgo presupuesto 400 | Medio (PR1 ~400–480) |
| Chained PRs recomendado | Sí |
| Split sugerido | PR1 → PR2 → PR3 (stacked-to-main) |
| Estrategia | auto-forecast (owner aprobó 3 PRs) |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: Medium

### Suggested Work Units

| Unidad | Meta | PR | Base |
|--------|------|----|------|
| 1 | Backend datos: `fechaHora` + filtros + fix gasto + caja por fecha | PR1 | main (autónomo) |
| 2 | Caja backfill: `fechaCaja` opcional en abrir + schema + modal CajaTab | PR2 | main (tras PR1) |
| 3 | Frontend formularios: fechas en WalkInModal/VentasPage/AgendaPage/FinanzasPage | PR3 | main (tras PR1+PR2) |

## PR1 — Backend datos (TDD, base main)

- [x] 1.1 RED: `finanzas.schema.test.ts` — `fechaHora` opcional aceptada, inválida rechazada
- [x] 1.2 GREEN: `finanzas.schema.ts` + `RegistroServicioEntity` (`fechaHora` nullable) + `RegistroServicioDTO`; **rebuild** `cd packages/validation && npx tsc`
- [x] 1.3 RED: `verificarCajaAbierta.test.ts` — fecha param; sin caja de esa fecha → `CajaNoAbiertaEnFechaError` (409)
- [x] 1.4 GREEN: `verificarCajaAbierta.ts` (+fecha, throw 409) + `errors.ts` (`CajaNoAbiertaEnFechaError`)
- [x] 1.5 RED: `CreateRegistroUseCase.test.ts` — fechaHora persistida (default ahora); caja = la de la fecha del payload
- [x] 1.6 GREEN: `CreateRegistroUseCase.ts` — fechaHora + fecha al guard + `create` con `fechaHora`
- [x] 1.7 GREEN: `TypeORMRegistroServicioRepository.ts` — `COALESCE(r.fechaHora, r.creadoEn)` en `search`/`count`/`findBySalonAndDateRange` + order
- [x] 1.8 RED→GREEN: `NominaPendienteUseCase.test.ts` + `NominaPendienteUseCase.ts` — período con `fechaHora ?? creadoEn`; fixtures +fechaHora
- [x] 1.9 RED→GREEN: `ObtenerDetalleCierreCajaUseCase.test.ts` + uso — movimientos `fecha: r.fechaHora ?? r.creadoEn`
- [x] 1.10 RED→GREEN: `CuentasCobrarUseCase.test.ts` (si existe) + uso — antigüedad por `fechaHora ?? creadoEn`
- [x] 1.11 RED→GREEN: `CreateGastoUseCase.test.ts` + uso — honra `input.fecha` + caja por esa fecha (LiquidarEmpleada vía repo, guard anti-doble-pago intacto)
- [x] 1.12 RED→GREEN: `CompletarCitaUseCase` + `CambiarEstadoCitaUseCase` — `fechaHora ?? cita.fechaHora` + fecha al guard (tests agenda)
- [x] 1.13 Rebuild validation + `npx tsc --noEmit` + `npx vitest run` + cobertura ≥80% (api)

## PR2 — Caja backfill (TDD, base main)

- [x] 2.1 RED: `caja.schema.test.ts` — `fechaCaja` regex opcional; **rebuild** validation
- [x] 2.2 RED→GREEN: `AbrirCajaUseCase.test.ts` + uso — `fechaCaja` passthrough (default hoy); día/any-open/backstop con fecha pasada; `CajaController.test.ts` + controller (spread condicional)
- [x] 2.3 RED→GREEN: `CajaTab.test.tsx` + `CajaTab.tsx` — date input en modal Abrir (default hoy) + `fechaCaja` en POST
- [x] 2.4 vitest api + dashboard

## PR3 — Frontend formularios (TDD, base main)

- [ ] 3.1 RED→GREEN: `AgendaPage.test.tsx` + `AgendaPage.tsx` — quitar `min` (L1677), default `fecha: todayStr` (L250/499)
- [ ] 3.2 RED→GREEN: `WalkInModal.test.tsx` + `WalkInModal.tsx` — state `fecha` default hoy + `fechaHora` en payload (L441-474)
- [ ] 3.3 RED→GREEN: `VentasPage.test.tsx` + `VentasPage.tsx` — date input + `fechaHora` en payload (L315-382)
- [ ] 3.4 `FinanzasPage.tsx` — mostrar `fechaHora` (L3547); fixture si asserta `creadoEn`
- [ ] 3.5 vitest dashboard + tsc

## Phase 4 — Verification / Smoke E2E

- [ ] 4.1 Rebuild `packages/validation` + restart API (gotcha AGENTS.md)
- [ ] 4.2 Smoke: abrir caja 16/08 → venta 16/08 → cerrar → P&L agosto y caja 16/08 incluyen la venta
- [ ] 4.3 Smoke: venta 16/08 sin caja de esa fecha → 409 `CAJA_NO_ABIERTA_EN_FECHA`
- [ ] 4.4 Smoke: cita pasada + default hoy; gasto 16/08 en arqueo; n8n mirror sin cambios
- [ ] 4.5 Commits por unidad de trabajo (Conventional Commits, tests con código)

## Test Break Inventory

| Test | Impacto |
|------|---------|
| `NominaPendienteUseCase.test.ts` | Fixtures solo `creadoEn` (L44, 184, 243…) → período con fallback no rompe; **añadir casos `fechaHora`** |
| `LiquidarEmpleadaUseCase.test.ts` | Filtro vía repo mockeado → seguro; añadir `fechaHora` en `makeRegistro` |
| `ObtenerDetalleCierreCajaUseCase.test.ts` | Movimientos `fecha: creadoEn` (L75, 129, 143) → fallback ok; añadir casos |
| `finanzas.schema.test.ts` / `caja.schema.test.ts` | No rompen (opcionales); añadir casos nuevos |
| `verificarCajaAbierta.test.ts` | Firma con default → no rompe; añadir caso fecha |
| `CreateRegistroUseCase.test.ts` / `PyLMensualUseCase.test.ts` / `ResumenDiaUseCase.test.ts` / `AbrirCajaUseCase.test.ts` | Repos mockeados → seguros; añadir casos fecha |
| `AgendaPage.test.tsx` / `VentasPage.test.tsx` | Seguros (sin assert de `min`; `objectContaining`) |
| `WalkInModal.test.tsx` / `CajaTab.test.tsx` / `FinanzasPage.test.tsx` | Revisar asserts de payload/fixtures; añadir campo fecha |

## Dependencies

PR2 y PR3 requieren PR1 mergeado (verificarCajaAbierta con fecha, COALESCE, schema). PR3 además usa el DTO con `fechaHora` (PR1) y el modal Abrir de PR2. Rebuild de `packages/validation` tras cada cambio de schema.
