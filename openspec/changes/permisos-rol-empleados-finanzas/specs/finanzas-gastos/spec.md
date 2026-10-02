# Delta for Gastos y Devoluciones

## MODIFIED Requirements

### Requirement: GET Listar Gastos

The system MUST return gastos filtered by optional `fechaDesde` and `fechaHasta`.
Access MUST require SUPERADMIN, DUEÑA, ADMINISTRADOR or CONTADOR; MANICURISTA
and RECEPCIONISTA MUST receive 403.
(Previously: accessible to any authenticated role.)

#### Scenario: Filter by date range

- GIVEN gastos on different dates
- WHEN `GET /api/salones/:salonId/gastos?fechaDesde=2026-05-01&fechaHasta=2026-05-31`
- THEN only gastos within that range are returned

#### Scenario: Restricted role denied

- GIVEN a JWT with `rol = RECEPCIONISTA`
- WHEN `GET /api/salones/:salonId/gastos`
- THEN the response MUST be 403

#### Scenario: Privileged role allowed

- GIVEN a JWT with `rol = CONTADOR`
- WHEN `GET /api/salones/:salonId/gastos`
- THEN the response MUST be 200

### Requirement: GET Listar Devoluciones por Registro

The system MUST return devoluciones for the salon, optionally filtered by
`registroServicioId`. Access MUST require SUPERADMIN, DUEÑA, ADMINISTRADOR or
CONTADOR; MANICURISTA and RECEPCIONISTA MUST receive 403.
(Previously: endpoint `GET /registros/:id/devoluciones`, no role restriction.)

#### Scenario: List by registro

- GIVEN a registro with 2 devoluciones
- WHEN `GET /api/salones/:salonId/devoluciones?registroServicioId=:id`
- THEN the response MUST include both devoluciones

#### Scenario: Restricted role denied

- GIVEN a JWT with `rol = RECEPCIONISTA`
- WHEN `GET /api/salones/:salonId/devoluciones`
- THEN the response MUST be 403
