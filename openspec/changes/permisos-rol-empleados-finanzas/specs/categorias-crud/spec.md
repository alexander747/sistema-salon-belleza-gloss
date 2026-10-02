# Delta for Categorías CRUD

## ADDED Requirements

### Requirement: Categoría Reads Remain Unguarded

`GET /api/salones/:salonId/categorias` MUST NOT be restricted by role.
MANICURISTA and RECEPCIONISTA MUST keep read access because Servicios, Agenda
and Registros depend on the endpoint. No `requireRole` guard MUST be added to
the categoría read route.

#### Scenario: RECEPCIONISTA can list categorías

- GIVEN a JWT with `rol = RECEPCIONISTA`
- WHEN `GET /api/salones/:salonId/categorias`
- THEN the response MUST be 200

#### Scenario: MANICURISTA can list categorías

- GIVEN a JWT with `rol = MANICURISTA`
- WHEN `GET /api/salones/:salonId/categorias`
- THEN the response MUST be 200
