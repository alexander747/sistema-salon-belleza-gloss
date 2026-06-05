# Registros de Servicio — Specification

## ADDED Requirements

### Requirement: Walk-in Registration Entry Point

The system MUST provide a "Registrar servicio" button on the FinanzasPage Registros tab toolbar. Clicking it MUST open a modal for walk-in service registration. The modal MUST be a standalone component extracted from FinanzasPage.

#### Scenario: Open registration modal
- GIVEN the user is viewing the Registros tab of FinanzasPage
- WHEN the user clicks "Registrar servicio" in the toolbar
- THEN a modal opens with form sections: client, employee, services, products, payment, tip, and notes

#### Scenario: Cancel without saving
- GIVEN the registration modal is open with partially filled data
- WHEN the user closes the modal via the close button or backdrop
- THEN no data is submitted and the registros list remains unchanged

### Requirement: Walk-in Registration Form

The modal MUST include: searchable client selector (with inline creation), employee selector, service multi-select from `/salones/:id/servicios` with editable price, optional product add-ons from existing product catalog, payment method tabs (EFECTIVO|TARJETA|TRANSFERENCIA), tip input, notes field, and auto-calculated `totalServicios` + `montoTotal`.

#### Scenario: Service selection auto-calculates total
- GIVEN services "Corte" (25000) and "Tintura" (60000) are selected at default prices
- WHEN the form calculates totals
- THEN totalServicios MUST be 85000 AND descripcionServicio MUST include "Corte, Tintura"

#### Scenario: Price override in service selection
- GIVEN "Corte" has precioBase=25000 and the staff changes its price to 20000
- WHEN the total is recalculated
- THEN totalServicios reflects 20000 for that service instead of 25000

#### Scenario: Successful walk-in registration
- GIVEN client, employee, 2 services (total=85000), 1 product (5000), payment EFECTIVO=90000, tip=3000
- WHEN the user clicks "Registrar"
- THEN POST /salones/:id/registros with totalServicios=85000, totalProductos=5000, propina=3000, pagos=[{monto:90000, metodoPago:EFECTIVO}] AND on 201: modal closes, success message shows, registros list refreshes

#### Scenario: Validation prevents incomplete submission
- GIVEN missing client or no services selected
- WHEN the user clicks "Registrar"
- THEN the system SHOWS a client-side validation error and does NOT submit

#### Scenario: API error on submission
- GIVEN a complete form
- WHEN POST returns 4xx or 5xx
- THEN the modal stays open, an error message is displayed, and the form data is preserved for retry

### Requirement: Backend Schema — Remove serviciosIds

The `serviciosIds` field MUST be removed from the `createRegistroSchema` in `packages/validation/src/finanzas.schema.ts`. The `descripcionServicio` field SHOULD be auto-populated from selected service names on the frontend.

#### Scenario: Payload without serviciosIds
- GIVEN a complete registration payload without serviciosIds
- WHEN POST /salones/:salonId/registros
- THEN the request MUST succeed with 201

## MODIFIED Requirements

### Requirement: POST Crear Registro

The system MUST create a `RegistroServicioEntity` with its `pagos` and `divisiones` in a single database transaction. Business rules:
- `comisionCalculada = totalServicios * (porcentajeComisionServicio / 100)`. Productos and propina MUST NOT generate commission.
- `montoTotal = totalServicios + totalProductos + propina`
- `montoPendiente = (totalServicios + totalProductos) - SUM(pagos.monto)`. Propina excluded.
- Propina is 100% employee. It MUST NOT count toward salon revenue.
- If `esRetoque=true`, `totalServicios=0`. Inventory may still be deducted.
- Multiple payment methods supported via `pagos[]` relation.
- Shared work via `divisiones[]` with per-employee `porcentajeParticipacion` and `comisionCorrespondiente`.
(Previously: accepted serviciosIds field which was silently ignored — removed per Option A)

#### Scenario: Basic registro with single payment
- GIVEN totalServicios=39000, propina=0, pago EFECTIVO=39000, empleado comision=60%
- WHEN POST /api/salones/:salonId/registros
- THEN response MUST be 201 with comisionCalculada=23400, montoPendiente=0, montoTotal=39000

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
