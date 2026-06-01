# Servicios CRUD Specification (Seasonal Pricing)

## Purpose

Define CRUD operations for services (servicios) offered by a salon. Each servicio belongs to a category and supports seasonal pricing via `reglasTemporada` on the salon. All prices include a computed `precioFinal` field.

## Requirements

### Requirement: List Servicios

`GET /api/salones/:salonId/servicios` MUST return active servicios, optionally filtered by `categoriaId`. Each response MUST include `precioFinal` computed by applying the active `reglasTemporada` multiplicador to `precioBase`. If no active reglasTemporada exist, `precioFinal` = `precioBase`. Response includes `fotosCount`. All logged-in roles MAY read.

| Method | Endpoint | Auth | Query |
|--------|----------|------|-------|
| GET | `/api/salones/:salonId/servicios` | any role | ?categoriaId |

#### Scenario: Happy path — list with pricing

- GIVEN a servicio with precioBase=100 and salon has active reglaTemporada with multiplicador=1.2
- WHEN `GET /api/salones/1/servicios`
- THEN status 200
- AND body[0].precioFinal equals 120
- AND body[0].precioBase equals 100

#### Scenario: No seasonal pricing

- GIVEN a servicio with precioBase=100 and salon has no active reglasTemporada
- WHEN `GET /api/salones/1/servicios`
- THEN body[0].precioFinal equals 100

#### Scenario: Filter by categoria

- GIVEN 5 servicios across 2 categorías
- WHEN `GET /api/salones/1/servicios?categoriaId=3`
- THEN only servicios with categoriaId=3 are returned

#### Scenario: Tenant isolation

- GIVEN salon A has 3 servicios, salon B has 5
- WHEN fetching servicios for salon A
- THEN only salon A's servicios are returned

### Requirement: List Servicios — Nullable Categoria

The system MUST include servicios with NULL `categoriaId` when listing servicios for a salon. The query MUST use LEFT JOIN on `categoria` instead of INNER JOIN to prevent silent omission of category-less servicios. Existing filtering and pricing logic MUST remain unchanged.

#### Scenario: Servicio without category appears in list

- GIVEN a servicio with `categoriaId: NULL` exists for salon X
- WHEN `GET /api/salones/X/servicios`
- THEN the servicio appears in results
- AND `categoria` is `null` in the response (not omitted)

#### Scenario: Servicio with category still works

- GIVEN a servicio with `categoriaId: 5` exists for salon X
- WHEN `GET /api/salones/X/servicios`
- THEN the servicio appears with its category data included
- AND `precioFinal` computation and tenant isolation remain unchanged

### Requirement: Get Servicio Detail

`GET /api/salones/:salonId/servicios/:id` MUST return a single servicio with `precioFinal`, `fotosCount`, and all base fields.

#### Scenario: Happy path

- GIVEN servicio id=10 with 3 fotos
- WHEN `GET /api/salones/1/servicios/10`
- THEN status 200
- AND body.fotosCount equals 3
- AND body.precioFinal is computed

### Requirement: Create Servicio

`POST /api/salones/:salonId/servicios` MUST create a servicio. DUEÑA and ADMIN MAY write. `categoriaId` MUST belong to the same salon.

| Method | Endpoint | Auth | Body |
|--------|----------|------|------|
| POST | `/api/salones/:salonId/servicios` | write roles | nombre*, precioBase*, duracionMinutos*, categoriaId*, descripcion? |

#### Scenario: Happy path — create

- GIVEN valid body with categoriaId belonging to salon 1
- WHEN `POST /api/salones/1/servicios`
- THEN status 201
- AND body includes `id`, `precioFinal`, `activo: true`

#### Scenario: Wrong categoria's salon returns 422

- GIVEN categoriaId belonging to a DIFFERENT salon
- WHEN `POST /api/salones/1/servicios`
- THEN status 422

#### Scenario: Missing required fields

- GIVEN body without `precioBase`
- WHEN `POST /api/salones/1/servicios`
- THEN status 422

### Requirement: Update Servicio

`PUT /api/salones/:salonId/servicios/:id` MUST update partial fields.

#### Scenario: Happy path

- GIVEN servicio id=10 with precioBase=100
- WHEN `PUT /api/salones/1/servicios/10` with `{ precioBase: 150 }`
- THEN status 200
- AND body.precioBase equals 150

### Requirement: Delete Servicio (Soft)

`DELETE /api/salones/:salonId/servicios/:id` MUST set `activo=false`.

#### Scenario: Happy path — soft delete

- GIVEN servicio id=10 with activo=true
- WHEN `DELETE /api/salones/1/servicios/10`
- THEN status 200
- AND the servicio's `activo` is now `false`

### Requirement: Write Authorization

MANICURISTA and RECEPCIONISTA MUST be rejected with 403 on write endpoints.

#### Scenario: Recepcionista rejected

- GIVEN JWT with rol=RECEPCIONISTA
- WHEN `POST /api/salones/1/servicios`
- THEN status 403
