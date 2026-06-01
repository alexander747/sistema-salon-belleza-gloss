# Proposal: Módulo de Finanzas y Reportes

## Intent

Build the `finanzas` module — the richest domain in the system — covering service registries, payments, expenses, returns, employee payroll/commissions, and financial reports. All business rules are proven from `pos-ok` production; this rebuild follows the established hexagonal DDD pattern used by `modules/agenda/`.

## Scope

### In Scope
- **Registro de Servicios**: Create (with commissions calc, M:N payments, tips, shared-work divisions), List/Get/Update/Anular — 5 use cases
- **Gastos**: List (date-range filter), Create, Delete — 3 use cases
- **Devoluciones**: Create (optional return-to-stock), List — 2 use cases
- **Liquidación / Nómina**: NominaPendiente (per employee), LiquidarEmpleada (create liquidacion + mark registros), HistorialLiquidaciones — 3 use cases
- **Reportes**: ResumenDia, ROIMensual, CierreTurno (employee-specific) — 3 use cases
- **Finanzas Dashboard**: Summary cards + charts (frontend page)
- ~20 REST endpoints under `/api/salones/:salonId/`
- Zod validation schemas in `packages/validation/`
- DI registration in `shared/container.ts`
- Integration tests for critical paths

### Out of Scope
- n8n endpoints (separate change: n8n-integration)
- PDF receipt generation
- Campaign marketing cost integration

## Capabilities

### New Capabilities
- `finanzas-registros`: Servicio registries with payments, commissions, divisions, tips, and retoques
- `finanzas-gastos`: Operational and fixed expense tracking
- `finanzas-devoluciones`: Product returns with optional stock reincorporation
- `finanzas-liquidacion`: Employee payroll — pending calculation, liquidation, history
- `finanzas-reportes`: ResumenDia, ROIMensual, CierreTurno reports
- `finanzas-dashboard`: Frontend page with summary cards and charts

### Modified Capabilities
- `backend-hexagonal`: New module addition, no spec-level rule changes
- `entity-layer`: No schema changes needed; entities already exist

## Approach

**Clean Hexagonal DDD** — same pattern as `modules/agenda/`:
- Domain ports (`IFinanzasRegistroRepository`, `IGastoRepository`, etc.)
- Dedicated use cases per operation with a single `execute()` method
- TypeORM repository implementations, registered in `shared/container.ts`
- Thin controllers delegating to use cases
- Routes under `/api/salones/:salonId/` (mergeParams: true)
- tsyringe DI with `@injectable()` + string tokens for interfaces

Critical: `CrearRegistroUseCase` wraps Registro + Pagos + Divisiones + Cliente update in a single TypeORM `QueryRunner` transaction — an improvement over the pos-ok reference.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `apps/api/src/modules/finanzas/` | New | Full hexagonal module (~40 files) |
| `apps/api/src/shared/container.ts` | Modified | ~25 new registrations |
| `apps/api/src/app.ts` | Modified | Mount `finanzasRouter` |
| `packages/validation/src/` | Modified | New Zod schemas |
| `apps/web/src/` | New | Finanzas dashboard page |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Decimal precision drift (DECIMAL↔JS Number) | High | `Number()` coercion on every arithmetic op; integration tests with exact decimal asserts |
| Missing transaction atomicity on CrearRegistro | Medium | QueryRunner wrapping the entire use case; rollback on any step failure |
| montoPendiente / deudaTotal desync | Medium | Both updated in same transaction; reconciliation query in tests |
| Liquidación period boundary bugs | Low | Only pick `estaPagadaEmpleada: false`; documented invariant |
| Effort overspill | High | 3-PR breakdown with clear boundaries; PR 1 is self-contained deployable milestone |

## Rollback Plan

- Revert PRs in reverse order (PR 3 → 2 → 1)
- No DB migration needed (entities already exist)
- DI registrations are additive — revert removes import + register blocks from `container.ts`
- Dashboard page removal is a single route + component delete

## Dependencies

- `modules/agenda/` pattern as architectural reference
- Existing entities: `RegistroServicioEntity`, `PagoTransaccionEntity`, `DivisionRegistroEntity`, `LiquidacionEntity`, `GastoEntity`, `DevolucionEntity`
- `IClienteRepository` (from `personas` module) for cliente `deudaTotal` update
- `IProductoRepository` (from `catalogo` module) for stock adjustments on devoluciones

## Success Criteria

- [ ] All 17 use cases pass unit tests with mocked repositories
- [ ] `CrearRegistroUseCase` integration test: creates record with payments, divisions, and correct `montoPendiente`
- [ ] `LiquidarEmpleadaUseCase` marks only `estaPagadaEmpleada: false` registros; creates `LiquidacionEntity`
- [ ] `ROIMensualUseCase` output matches manual calculation: ingresos - gastos - nómina
- [ ] `ResumenTurnoUseCase` returns correct `efectivoAEntregar = totalCobrado - comisiones - propinas`
- [ ] All 20 endpoints return correct HTTP status codes and payloads
- [ ] Dashboard page renders summary cards and chart components
- [ ] PRs pass CI (lint, type-check, tests) independently

## Delivery Strategy

**3 PRs, ~600-800 lines each** (within 400-line budget via chained split):

| PR | Scope | Lines est. | Deployable? |
|----|-------|-----------|-------------|
| PR 1 — Core Transaccional | Registro CRUD + Zod + DI + routes + controller | ~700 | Yes (read/write registros) |
| PR 2 — Reportes + Liquidación | ResumenDia, ROIMensual, NominaPendiente, LiquidarEmpleada, CierreTurno + Gastos + Devoluciones | ~800 | Yes (reports available) |
| PR 3 — Historial + Dashboard | HistorialLiquidaciones, DetalleLiquidacion, frontend dashboard, integration tests | ~600 | Yes (full feature set) |
