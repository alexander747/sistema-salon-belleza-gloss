# Tasks: Módulo de Finanzas y Reportes

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 2800–3500 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → PR 2 → PR 3 → PR 4 |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Domain ports + DTOs + ComisionService + TypeORM repos + DI | PR 1 | Base branch: main. Pure infra, no use-case deps |
| 2 | Registro use cases + controller + routes | PR 2 | Base: main. Depends on PR 1 repos/ports |
| 3 | Gasto + Devolucion + Liquidacion use cases + controllers + routes | PR 3 | Base: main. Depends on PR 1; uses PR 2 registro repos |
| 4 | Reporte use cases + full route wiring + integration tests | PR 4 | Base: main. Depends on all prior PRs |

## Phase 1: Infrastructure Foundation

- [x] 1.1 Create 6 domain ports: `IRegistroServicioRepository`, `IPagoTransaccionRepository`, `IDivisionRegistroRepository`, `ILiquidacionRepository`, `IGastoRepository`, `IDevolucionRepository`
- [x] 1.2 Create DTOs: `RegistroServicioDTO`, `GastoDTO`, `DevolucionDTO`, `LiquidacionDTO`, `ResumenDiaDTO`, `ROIDTO`, `CierreTurnoDTO`, `NominaPendienteDTO`
- [x] 1.3 Create `ComisionService` — calcularComision, calcularMontoTotal, calcularMontoPendiente, calcularIngresoSalon
- [x] 1.4 Create 6 TypeORM repos following TypeORMCitaRepository pattern (getRepo, findBySalonId, save, update)
- [x] 1.5 Register repos (string tokens) + ComisionService (class token) in `shared/container.ts`
- [ ] 1.6 Unit test: ComisionService — commission on servicios only, propina exclusion, retoque edge case

## Phase 2: Core — Registro Use Cases

- [ ] 2.1 Create `CreateRegistroUseCase` — QueryRunner transaction: FK validation, cascade save pagos+divisiones, update cliente deudaTotal, decrement stock
- [ ] 2.2 Create `ListRegistroUseCase` — find with optional fechaDesde/fechaHasta/usuarioId/clienteId filters
- [ ] 2.3 Create `GetRegistroUseCase` — findById with pagos/divisiones relations
- [ ] 2.4 Create `AnularRegistroUseCase` — soft-cancel, set montoPendiente=0
- [ ] 2.5 Create `RegistroController` — list/get/create/anular handlers
- [ ] 2.6 Add registro routes to finanzas.routes.ts
- [ ] 2.7 Register 4 use cases + RegistroController in DI
- [ ] 2.8 Unit test: CreateRegistro — mocked repos, verify DTO, cascade, rollback on error

## Phase 3: Gastos, Devoluciones, Liquidación

- [ ] 3.1 Create 3 Gasto use cases: CreateGasto, ListGasto, DeleteGasto
- [ ] 3.2 Create `GastoController` + 3 routes
- [ ] 3.3 Create 2 Devolucion use cases: CreateDevolucion (stock increment), ListDevolucion
- [ ] 3.4 Create `DevolucionController` + 2 routes
- [ ] 3.5 Create 4 Liquidacion use cases: NominaPendiente, LiquidarEmpleada, HistorialLiquidaciones, GetLiquidacion
- [ ] 3.6 Create `LiquidacionController` + 4 routes
- [ ] 3.7 Register all 9 use cases + 3 controllers in DI
- [ ] 3.8 Unit test: LiquidarEmpleada — verify estaPagadaEmpleada flip, 409 on nothing to liquidate

## Phase 4: Reportes & Final Wiring

- [ ] 4.1 Create `ResumenDiaUseCase` — aggregate registros + devoluciones + gastos operativos by date
- [ ] 4.2 Create `ROIMensualUseCase` — ingresos - gastosFijos - nomina for given month/year
- [ ] 4.3 Create `CierreTurnoUseCase` — employee daily: cobrado - comision - propina
- [ ] 4.4 Create `ReporteController` + 3 report routes
- [ ] 4.5 Finalize `finanzas.routes.ts` — all 16 endpoints with mergeParams: true and role guards
- [ ] 4.6 Wire routes into `app.ts`: `app.use('/api/salones/:salonId', finanzasRouter)`
- [ ] 4.7 Register all 3 report UCs + ReporteController in DI
- [ ] 4.8 Integration tests: CreateRegistro full flow, Liquidación cascade, ROIMensual aggregation
