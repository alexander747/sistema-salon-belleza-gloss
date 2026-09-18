# Delta for servicio-items

## MODIFIED Requirements

### Requirement: Servicio Items Persistence

The system MUST persist individual service items as part of registro creation. Each item MUST snapshot `servicioId`, `nombreServicio` (varchar), `precioServicio` (decimal), and `costoBaseInsumos` (decimal, default 0). For `POR_GRAMO` lines, each item MUST also snapshot `gramosUsados` (decimal, nullable) and `precioPorGramo` (decimal, nullable), and `costoBaseInsumos` MUST equal the server-derived real cost (`gramosUsados × precioPorGramo`). The `costoBaseInsumos` snapshot is used to compute commission after deducting supply costs.
(Previously: no `gramosUsados`/`precioPorGramo` snapshot)

#### Scenario: Persist items on registration

- GIVEN a registro with 2 selected services (Corte=$25000, Tintura=$60000)
- WHEN the registro is created with `serviciosItems` in the payload
- THEN 2 `registros_servicio_items` rows are persisted with correct `registroServicioId`, `servicioId`, `nombreServicio`, `precioServicio`

#### Scenario: Persist gram snapshot on POR_GRAMO

- GIVEN a registro with one `POR_GRAMO` item (`gramosUsados=95`, `precioPorGramo=1200`)
- WHEN the registro is created
- THEN the item persists `gramosUsados=95`, `precioPorGramo=1200` AND `costoBaseInsumos=114000`

#### Scenario: Empty serviciosItems

- GIVEN a registro payload with no `serviciosItems` field
- WHEN the registro is created
- THEN no `registros_servicio_items` rows are created and DTO returns `serviciosItems: []`

### Requirement: Servicio Items in DTO

The system MUST return `serviciosItems[]` in the `RegistroServicioDTO` response on create and get. Each item MUST include `id`, `servicioId`, `nombreServicio`, `precioServicio`, `costoBaseInsumos`, `gramosUsados` and `precioPorGramo` (`gramosUsados`/`precioPorGramo` are `null` for `FIJO` or legacy items).
(Previously: DTO omitted `gramosUsados`/`precioPorGramo`)

#### Scenario: DTO includes items

- GIVEN a registro with 2 persisted servicio items
- WHEN GET /api/salones/:salonId/registros/:id
- THEN response MUST include `serviciosItems` with `id`, `servicioId`, `nombreServicio`, `precioServicio`, `costoBaseInsumos`

#### Scenario: DTO exposes gram snapshot

- GIVEN a registro whose item has `gramosUsados=95` and `precioPorGramo=1200`
- WHEN GET /api/salones/:salonId/registros/:id
- THEN the item includes `gramosUsados=95` AND `precioPorGramo=1200`

#### Scenario: Legacy item keeps null gram fields

- GIVEN an item persisted before the change (no gram columns)
- WHEN GET /api/salones/:salonId/registros/:id
- THEN the item returns `gramosUsados=null`, `precioPorGramo=null` AND its original `costoBaseInsumos`
