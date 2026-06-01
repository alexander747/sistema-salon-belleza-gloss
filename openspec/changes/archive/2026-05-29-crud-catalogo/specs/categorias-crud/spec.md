# Delta for Categorías CRUD

## ADDED Requirements

### Requirement: List Categorías

`GET /api/salones/:salonId/categorias` MUST return all active categorías ordered by `orden` then `nombre`. DUEÑA, ADMIN, and RECEPCIONISTA MAY read.

| Method | Endpoint | Auth | Output |
|--------|----------|------|--------|
| GET | `/api/salones/:salonId/categorias` | read roles | CategoriaDto[] |

#### Scenario: Happy path — list

- GIVEN a salon with 3 active categorías
- WHEN `GET /api/salones/1/categorias`
- THEN status 200
- AND body is an array ordered by `orden` then `nombre`

#### Scenario: Tenant isolation

- GIVEN salon A has 2 categorías and salon B has 3
- WHEN fetching categorías for salon A
- THEN only salon A's categorías are returned

### Requirement: Create Categoría

`POST /api/salones/:salonId/categorias` MUST create a categoría. `nombre` is REQUIRED and MUST be unique per salon. DUEÑA and ADMIN MAY write.

| Method | Endpoint | Auth | Body |
|--------|----------|------|------|
| POST | `/api/salones/:salonId/categorias` | write roles | nombre*, descripcion?, emoji?, orden? |

#### Scenario: Happy path — create

- GIVEN valid body `{ nombre: "Uñas", orden: 1 }`
- WHEN `POST /api/salones/1/categorias`
- THEN status 201
- AND body includes `id`, `nombre: "Uñas"`, `activo: true`

#### Scenario: Missing nombre returns 422

- GIVEN body without `nombre`
- WHEN `POST /api/salones/1/categorias`
- THEN status 422
- AND error indicates `nombre` is required

#### Scenario: Duplicate nombre returns 409

- GIVEN existing categoría "Uñas" in salon 1
- WHEN `POST /api/salones/1/categorias` with `{ nombre: "Uñas" }`
- THEN status 409

### Requirement: Update Categoría

`PUT /api/salones/:salonId/categorias/:id` MUST update partial fields.

#### Scenario: Happy path

- GIVEN categoría id=5 with orden=1
- WHEN `PUT /api/salones/1/categorias/5` with `{ orden: 2 }`
- THEN status 200
- AND body shows `orden: 2`

### Requirement: Delete Categoría (Soft)

`DELETE /api/salones/:salonId/categorias/:id` MUST set `activo=false`. If categoría has active servicios, MUST include a warning field.

#### Scenario: Soft delete without servicios

- GIVEN categoría id=5 with 0 active servicios
- WHEN `DELETE /api/salones/1/categorias/5`
- THEN status 200
- AND categoría `activo` is `false`

#### Scenario: Warn on active servicios

- GIVEN categoría id=5 with 3 active servicios
- WHEN `DELETE /api/salones/1/categorias/5`
- THEN body includes `warning` about N servicios activos
- AND delete STILL proceeds (activo=false)

### Requirement: Write Authorization

MANICURISTA and RECEPCIONISTA MUST be rejected with 403 on write endpoints.

#### Scenario: Manicurista cannot create

- GIVEN JWT with rol=MANICURISTA
- WHEN `POST /api/salones/1/categorias`
- THEN status 403
