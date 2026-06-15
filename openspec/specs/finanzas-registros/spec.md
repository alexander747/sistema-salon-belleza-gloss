# Registros de Servicio — Specification

## Purpose

Core financial record of services rendered: commission calculation, payment splitting, tips, shared work, and inventory-only retouches. Every creation is atomic via QueryRunner transaction.

## ADDED Requirements

### Requirement: POST Crear Registro

The system MUST create a `RegistroServicioEntity` with its `pagos`, `divisiones`, `productosVendidos`, and `serviciosItems` in a single database transaction. Business rules:
- `comisionCalculada = max(0, totalServicios - totalCostoBaseInsumos) * (porcentajeComisionServicio / 100)`. Productos and propina MUST NOT generate commission. `totalCostoBaseInsumos` is computed as the sum of `costoBaseInsumos` across all `serviciosItems`. Uses `max(0, ...)` to prevent negative commission when insumos exceed total.
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

#### Scenario: Registro with propina
- GIVEN totalServicios=39000, propina=6000, pago=45000, comision=60%
- WHEN created
- THEN comisionCalculada=23400 (only on servicios) AND montoPendiente=0 (39000-45000, propina excluded)

#### Scenario: Multiple payment methods
- GIVEN totalServicios=50000, totalProductos=10000, pagos: EFECTIVO=30000, TARJETA=30000
- WHEN created
- THEN response MUST include 2 PagoTransaccion records AND montoPendiente=0

#### Scenario: Shared work (divisiones)
- GIVEN totalServicios=60000, 2 employees at 50% each, comision=60%
- WHEN created
- THEN divisiones MUST have 2 records each with comisionCorrespondiente=18000

#### Scenario: Retoque (garantía)
- GIVEN esRetoque=true, totalServicios=0, totalProductos=0
- WHEN created
- THEN comisionCalculada=0 AND montoTotal=0 AND no montoPendiente is generated

#### Scenario: Duplicate submission
- GIVEN identical payload sent twice rapidly
- THEN second request MUST return 409 Conflict

### Requirement: serviciosItems Input Validation

The `createRegistroSchema` MUST accept an optional `serviciosItems` array. Each item MUST validate: `servicioId` (positive int), `nombreServicio` (string max 200), `precioServicio` (positive number), `costoBaseInsumos` (number, min 0, optional, defaults 0). The field defaults to `[]` when absent.

#### Scenario: serviciosItems validation passes
- GIVEN a payload with `serviciosItems: [{servicioId:1, nombreServicio:"Corte", precioServicio:25000}]`
- WHEN parsed through `createRegistroSchema`
- THEN validation MUST succeed

#### Scenario: serviciosItems with costoBaseInsumos
- GIVEN a payload with `serviciosItems: [{servicioId:1, nombreServicio:"Tintura", precioServicio:60000, costoBaseInsumos:40000}]`
- WHEN parsed through `createRegistroSchema`
- THEN validation MUST succeed AND costoBaseInsumos must be preserved

#### Scenario: serviciosItems with invalid data
- GIVEN a payload with `serviciosItems: [{servicioId:0, nombreServicio:"", precioServicio:-1}]`
- WHEN parsed through `createRegistroSchema`
- THEN validation MUST fail

### Requirement: GET Listar Registros

The system MUST return registros filtered by optional `fechaDesde`, `fechaHasta`, `usuarioId`, `clienteId`.

#### Scenario: Filter by date range
- GIVEN registros on 2026-05-01 and 2026-05-15
- WHEN GET /api/salones/:salonId/registros?fechaDesde=2026-05-01&fechaHasta=2026-05-10
- THEN only the May 1 registro is returned

### Requirement: GET Obtener Registro

The system MUST return a single registro by ID with pagos, divisiones, productosVendidos, and serviciosItems populated.

#### Scenario: Get with all relations
- GIVEN a registro with 2 payments, 1 division, 2 productosVendidos, and 3 servicio items
- WHEN GET /api/salones/:salonId/registros/:id
- THEN response MUST include `pagos[]`, `divisiones[]`, `productosVendidos[]`, and `serviciosItems[]`

### Requirement: PATCH Anular Registro

The system MUST soft-cancel a registro, setting montoPendiente to 0.

#### Scenario: Anular active registro
- GIVEN an active registro with montoPendiente=15000
- WHEN PATCH /api/salones/:salonId/registros/:id/anular
- THEN registro MUST be marked anulado AND montoPendiente MUST be 0
