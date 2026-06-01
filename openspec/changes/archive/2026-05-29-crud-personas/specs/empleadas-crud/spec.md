# Delta for Empleadas CRUD

## ADDED Requirements

### Requirement: List Empleadas

`GET /api/salones/:salonId/empleadas` MUST return empleadas for the salon. DUEÑA and ADMIN see all fields including compensation (`porcentajeComisionServicio`, `sueldoFijo`, `bonoHorario`, `frecuenciaBono`). Other roles SHALL receive null for compensation fields.

| Method | Endpoint | Auth | Query |
|--------|----------|------|-------|
| GET | `/api/salones/:salonId/empleadas` | DUEÑA, ADMIN | ?rol, ?activo |

#### Scenario: Full visibility for DUEÑA

- GIVEN JWT with rol=DUEÑA, salon has 2 empleadas with compensation data
- WHEN `GET /api/salones/1/empleadas`
- THEN status 200, each entry includes `porcentajeComisionServicio`, `sueldoFijo`

#### Scenario: MANICURISTA rejected

- GIVEN JWT with rol=MANICURISTA
- WHEN `GET /api/salones/1/empleadas`
- THEN status 403

#### Scenario: Tenant isolation

- GIVEN salon A has 3 empleadas, salon B has 5
- WHEN fetching for salon A
- THEN only salon A's empleadas returned

### Requirement: Get Empleada

`GET /api/salones/:salonId/empleadas/:id` MUST return a single empleada with role-based field filtering.

#### Scenario: DUEÑA sees compensation

- GIVEN empleada id=5 with `sueldoFijo: 50000`
- WHEN `GET /api/salones/1/empleadas/5` as DUEÑA
- THEN status 200, body includes `sueldoFijo: 50000`

#### Scenario: Self-profile for MANICURISTA

- GIVEN JWT with id=5 and rol=MANICURISTA
- WHEN `GET /api/salones/1/empleadas/5` (own profile)
- THEN status 200, compensation fields are null

### Requirement: Create Empleada

`POST /api/salones/:salonId/empleadas` MUST create with `nombre`, `numeroWhatsApp`, `email`, `password`, `rol`, and optional compensation fields. `password` SHALL be bcrypt-hashed. `passwordHash` MUST NOT appear in response. DUEÑA, ADMIN only.

| Method | Endpoint | Auth | Body |
|--------|----------|------|------|
| POST | `/api/salones/:salonId/empleadas` | DUEÑA, ADMIN | nombre*, numeroWhatsApp*, email*, password*, rol* |

#### Scenario: Happy path create

- GIVEN valid body with all required fields
- WHEN `POST /api/salones/1/empleadas`
- THEN status 201, body has `nombre`, no `passwordHash`

#### Scenario: Duplicate phone returns 409

- GIVEN existing empleada with `numeroWhatsApp: "+541112345"` in salon 1
- WHEN `POST /api/salones/1/empleadas` with same phone
- THEN status 409

#### Scenario: Missing nombre returns 422

- GIVEN body without `nombre`
- WHEN `POST /api/salones/1/empleadas`
- THEN status 422

### Requirement: Update Empleada

`PUT /api/salones/:salonId/empleadas/:id` MUST update partial fields. If `password` present, re-hash it; otherwise preserve existing `passwordHash`.

#### Scenario: Update name

- GIVEN empleada id=5 with nombre "Ana"
- WHEN `PUT /api/salones/1/empleadas/5` with `{ nombre: "Ana M." }`
- THEN status 200, body.nombre equals "Ana M."

### Requirement: Toggle Activo

`PATCH /api/salones/:salonId/empleadas/:id/activar` and `PATCH .../desactivar` MUST toggle `activo`. Self-deactivation SHALL be rejected.

#### Scenario: Deactivate another empleada

- GIVEN current user id=1, target empleada id=5
- WHEN `PATCH /api/salones/1/empleadas/5/desactivar`
- THEN status 200, body.activo is false

#### Scenario: Cannot deactivate self

- GIVEN current user id=1
- WHEN `PATCH /api/salones/1/empleadas/1/desactivar`
- THEN status 422

### Requirement: Write Authorization

Non-DUEÑA and non-ADMIN roles MUST be rejected with 403 on POST, PUT, PATCH endpoints.

#### Scenario: RECEPCIONISTA cannot create

- GIVEN JWT with rol=RECEPCIONISTA
- WHEN `POST /api/salones/1/empleadas`
- THEN status 403
