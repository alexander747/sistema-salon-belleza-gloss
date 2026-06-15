# Servicio Items — Specification

## Purpose

Per-service detail tracking for financial records. Each `RegistroServicioItem` represents a single service rendered within a registro, with a snapshot of service name and price at registration time.

## Requirements

### Requirement: Servicio Items Persistence

The system MUST persist individual service items as part of registro creation. Each item MUST snapshot `servicioId`, `nombreServicio` (varchar), `precioServicio` (decimal), and `costoBaseInsumos` (decimal, default 0). This mirrors the `RegistroProductoEntity` pattern. The `costoBaseInsumos` snapshot is used to compute commission after deducting supply costs.

#### Scenario: Persist items on registration
- GIVEN a registro with 2 selected services (Corte=$25000, Tintura=$60000)
- WHEN the registro is created with `serviciosItems` in the payload
- THEN 2 `registros_servicio_items` rows are persisted with correct `registroServicioId`, `servicioId`, `nombreServicio`, `precioServicio`

#### Scenario: Empty serviciosItems
- GIVEN a registro payload with no `serviciosItems` field
- WHEN the registro is created
- THEN no `registros_servicio_items` rows are created and DTO returns `serviciosItems: []`

### Requirement: Servicio Items in DTO

The system MUST return `serviciosItems[]` in the `RegistroServicioDTO` response on create and get.

#### Scenario: DTO includes items
- GIVEN a registro with 2 persisted servicio items
- WHEN GET /api/salones/:salonId/registros/:id
- THEN response MUST include `serviciosItems` with `id`, `servicioId`, `nombreServicio`, `precioServicio`, `costoBaseInsumos`
