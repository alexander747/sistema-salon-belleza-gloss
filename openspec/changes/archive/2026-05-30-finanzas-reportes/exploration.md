## Exploration: Finanzas y Reportes

### Current State

The financial entities already exist in `apps/api/src/infrastructure/persistence/entities/` (migrated from pos-ok): `RegistroServicioEntity`, `PagoTransaccionEntity`, `DivisionRegistroEntity`, `LiquidacionEntity`, `GastoEntity`, `DevolucionEntity`. They have all fields and relations needed.

There is NO `modules/finanzas/` directory yet — no use cases, no controllers, no routes, no DI registration. The codebase has a well-established hexagonal DDD pattern (see `modules/agenda/`) with `tsyringe` DI, TypeORM repositories, controllers injecting use cases, and routes with validation middleware.

A full working reference exists in `pos-ok/backend/src/services/registroServicio.ts` and `finanzasServicio.ts` — all business rules are proven in production.

### Affected Areas

- `apps/api/src/modules/finanzas/` (NEW) — entire module: domain/ports, application/use-cases, application/dtos, infrastructure/persistence, presentation/controllers, presentation/routes
- `apps/api/src/shared/container.ts` — register all new repositories, use cases, and controllers in the DI container
- `apps/api/src/app.ts` — mount the new `finanzasRouter` under `/api/salones/:salonId`
- `apps/api/src/infrastructure/persistence/entities/RegistroServicioEntity.ts` — may need `tipoServicio` field? Review
- `apps/api/src/infrastructure/persistence/entities/UsuarioEntity.ts` — reads `porcentajeComisionServicio`, `sueldoFijo`, `bonoHorario` (already present)
- `apps/api/src/infrastructure/persistence/entities/ClienteEntity.ts` — updates `ultimaVisita`, `totalServicios`, `deudaTotal` after each registro
- `apps/api/src/infrastructure/persistence/entities/ProductoEntity.ts` — stock adjustments for devoluciones
- `apps/api/src/presentation/middleware/validate.ts` — validation schemas shared package (new Zod schemas)
- `packages/validation/src/` (NEW if exists) — validation schemas for registro creation, gastos, devoluciones

### Approaches

1. **Clean Hexagonal DDD (recommended)** — Follow exact pattern from `modules/agenda/`:
   - Domain ports (`IFinanzasRegistroRepository`, `IGastoRepository`, etc.)
   - Dedicated use cases per operation (CreateRegistroUseCase, ResumenDiaUseCase, etc.)
   - TypeORM repository implementations
   - tsyringe DI registration
   - Route at `/api/salones/:salonId/registros`, `/api/salones/:salonId/finanzas/*`
   - Pros: Consistent with codebase, testable, maintainable, follows the existing architecture contract
   - Cons: More files to create, higher initial effort
   - Effort: Medium

2. **Flat service layer** — Single controller + service (like pos-ok style):
   - Pros: Faster to write, fewer files
   - Cons: Inconsistent with the established hexagonal pattern, harder to test, tech debt
   - Effort: Low

3. **Hybrid — use cases for core, flat for reports** — Hexagonal for RegistroServicio (critical business rules), flat services for read-only reports:
   - Pros: Pragmatic, saves boilerplate on queries
   - Cons: Inconsistent enforcement, two patterns to maintain
   - Effort: Medium

### Recommendation

**Approach 1 — Clean Hexagonal DDD.** The whole point of rebuilding pos-ok is to fix the architecture. RegistroServicio is the MOST critical transaction in the system — it needs the guardrails of use cases, typed DTOs, and domain ports. The pattern is proven (agenda/ module), and the team is already familiar with it. Skipping it here would be the worst place to cut corners.

### Risks

- **Decimal precision (MySQL DECIMAL↔JS Number)**: The TypeORM entity uses `decimal` type but the TS type is `number`. All arithmetic must use `Number()` conversion to avoid string-concatenation bugs. The pos-ok reference does this, but it's a common source of subtle bugs.
- **Transaction atomicity**: `CrearRegistro` must create RegistroServicio + PagoTransaccion(s) + DivisionRegistro(s) + Cliente update in a single database transaction. TypeORM's `cascade: true` on the entity helps but a QueryRunner transaction wrapping the entire use case is safer. The pos-ok reference does NOT use transactions — this is a genuine improvement opportunity.
- **montoPendiente tracking vs deudaTotal on Cliente**: These two values must stay in sync. Every registro creation/devolucion should update both. Currently `montoPendiente` is on the registro and `deudaTotal` is on the cliente — ideally they're consistent.
- **Liquidacion period boundaries**: Liquidación marks registros as paid. If a new registro is created with `creadoEn` inside an already-liquidated period, it stays as pending. The `liquidarEmpleada` logic only picks up `estaPagadaEmpleada: false` — this is correct but needs documentation.
- **Propina in montoPendiente**: The pos-ok reference explicitly excludes propina from `montoPendiente` calculation (`montoSinPropina = totalServicios + totalProductos`). This is correct per business rules but is a non-obvious gotcha that must be preserved in the new implementation.
- **DivisionRegistro cascading**: When a registro has divisions, `comisionCalculada` on the main registro still reflects 100% of the commission. The per-employee commission is on `DivisionRegistro.comisionCorrespondiente`. Reports that sum commissions must account for this.
- **Effort scope**: This is the FATEST domain in the system. Complete module creation with all its use cases could be 3 PRs, not 1.

### Business Rule Inventory (from pos-ok, confirmed)

| # | Rule | Detail |
|---|------|--------|
| 1 | Comisión solo sobre servicios | `comisionCalculada = totalServicios * (porcentajeComision / 100)`; productos $0 comisión |
| 2 | Propina 100% empleada | No suma a ingresos del salón; no se cobra comisión sobre ella |
| 3 | montoTotal = servicios + productos + propina | Suma bruta de la transacción |
| 4 | montoPendiente = (servicios+productos) - pagado | Propina NO cuenta en la deuda del cliente |
| 5 | esRetoque = $0 | No genera monto, solo descuenta material del inventario |
| 6 | Trabajo compartido | DivisionRegistro con porcentaje; comisión se distribuye |
| 7 | Liquidación = comisiones + propinas + bono + sueldoFijo | Todo suma al pago de la empleada |
| 8 | Cierre de turno = efectivo - comisión - propinas | Lo que la empleada entrega a caja |
| 9 | Gasto fijo vs operativo | `esGastoFijo`; los fijos van al ROI mensual, los operativos al resumen del día |
| 10 | Devolución con regreso a stock | `regresaAlStock` decide si se reincorpora el producto al inventario |

### Use Case Inventory

**PR 1 — Core Transaccional** (critical path):
- `CrearRegistroUseCase` — Create registro with payments + divisions + cliente update (wrapped in DB transaction)
- `GetRegistroUseCase` — Get single registro with relations
- `ListRegistrosUseCase` — List registros with date/user/client filters
- `IFinanzasRegistroRepository` — domain port
- `TypeORMRegistroRepository` — TypeORM implementation
- Validación Zod en `packages/validation`
- DI registration + routes + controller
- Tests (unit + integration)

**PR 2 — Reportes + Liquidación**:
- `ResumenDiaUseCase` — Daily financial summary
- `ROIMensualUseCase` — Monthly ROI (ingresos - gastos - nómina)
- `NominaPendienteUseCase` — Pending payroll per employee
- `LiquidarEmpleadaUseCase` — Mark as paid + create Liquidacion record
- `DetalleLiquidacionUseCase` — Detail of pending registros for an employee
- `ResumenTurnoUseCase` — Employee shift closeout (total services, products, commission, cash to deliver)
- Gastos CRUD (list, create)
- Devoluciones CRUD (create, list)
- Routes + controllers + DI

**PR 3 — Historial + Refinements**:
- `HistorialPagosUseCase` — Paginated liquidation history with filters
- `DetalleLiquidacionHistorialUseCase` — Specific liquidation detail
- Refactor: shared query builder helpers for date-range queries
- Integration test suite

### Ready for Proposal

**Yes.** All entities exist, business rules are fully specified (proven in pos-ok production), the module pattern is well-established, and the effort breakdown is clear. The orchestrator should proceed to `sdd-propose` with the 3-PR breakdown as the scope recommendation. Warn the user that this is the fattest domain in the system and expect it to span multiple sessions.
