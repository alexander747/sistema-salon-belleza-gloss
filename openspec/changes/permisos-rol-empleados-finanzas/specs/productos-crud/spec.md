# Delta for Productos CRUD

## ADDED Requirements

### Requirement: Product Reads Remain Unguarded

`GET /api/salones/:salonId/productos` and `GET /api/salones/:salonId/productos/:id`
MUST NOT be restricted by role. MANICURISTA and RECEPCIONISTA MUST keep 200 access
(with `precioCompra` still hidden per the role-based field visibility), because
Ventas, Agenda and Registros depend on these endpoints. No `requireRole` guard
MUST be added to the product read routes.

#### Scenario: RECEPCIONISTA can list productos

- GIVEN a JWT with `rol = RECEPCIONISTA`
- WHEN `GET /api/salones/:salonId/productos`
- THEN the response MUST be 200
- AND `precioCompra` MUST be absent from each item

#### Scenario: MANICURISTA can list productos

- GIVEN a JWT with `rol = MANICURISTA`
- WHEN `GET /api/salones/:salonId/productos`
- THEN the response MUST be 200
