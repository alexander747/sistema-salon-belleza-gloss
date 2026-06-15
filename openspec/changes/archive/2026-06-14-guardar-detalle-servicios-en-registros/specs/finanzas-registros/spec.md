# Delta for finanzas-registros

## ADDED Requirements

### Requirement: serviciosItems Input Validation

The `createRegistroSchema` MUST accept an optional `serviciosItems` array. Each item MUST validate: `servicioId` (positive int), `nombreServicio` (string max 200), `precioServicio` (positive number). The field defaults to `[]` when absent.

#### Scenario: serviciosItems validation passes
- GIVEN a payload with `serviciosItems: [{servicioId:1, nombreServicio:"Corte", precioServicio:25000}]`
- WHEN parsed through `createRegistroSchema`
- THEN validation MUST succeed

#### Scenario: serviciosItems with invalid data
- GIVEN a payload with `serviciosItems: [{servicioId:0, nombreServicio:"", precioServicio:-1}]`
- WHEN parsed through `createRegistroSchema`
- THEN validation MUST fail

## MODIFIED Requirements

### Requirement: POST Crear Registro

The system MUST create a `RegistroServicioEntity` with its `pagos`, `divisiones`, `productosVendidos`, and `serviciosItems` in a single database transaction. Business rules:
- `comisionCalculada = totalServicios * (porcentajeComisionServicio / 100)`. Productos and propina MUST NOT generate commission.
- `montoTotal = totalServicios + totalProductos + propina`
- `montoPendiente = (totalServicios + totalProductos) - SUM(pagos.monto)`. Propina excluded.
- Propina is 100% employee. It MUST NOT count toward salon revenue.
- If `esRetoque=true`, `totalServicios=0`. Inventory may still be deducted.
- Multiple payment methods supported via `pagos[]` relation.
- Shared work via `divisiones[]` with per-employee `porcentajeParticipacion` and `comisionCorrespondiente`.
- `serviciosItems[]` SHALL be persisted as `RegistroServicioItemEntity` rows within the same transaction. `totalServicios` aggregate remains unchanged for commission calculation.
(Previously: no servicio items persisted)

#### Scenario: Basic registro with single payment and servicio items
- GIVEN totalServicios=39000, propina=0, pago EFECTIVO=39000, empleado comision=60%, serviciosItems=[{servicioId:1, nombreServicio:"Corte", precioServicio:39000}]
- WHEN POST /api/salones/:salonId/registros
- THEN response MUST be 201 with `serviciosItems` array length 1 AND comisionCalculada=23400 AND montoPendiente=0

#### Scenario: Duplicate submission
- GIVEN identical payload sent twice rapidly
- THEN second request MUST return 409 Conflict

### Requirement: GET Obtener Registro

The system MUST return a single registro by ID with pagos, divisiones, productosVendidos, and serviciosItems populated.

#### Scenario: Get with all relations
- GIVEN a registro with 2 payments, 1 division, 2 productosVendidos, and 3 servicio items
- WHEN GET /api/salones/:salonId/registros/:id
- THEN response MUST include `pagos[]`, `divisiones[]`, `productosVendidos[]`, and `serviciosItems[]`
