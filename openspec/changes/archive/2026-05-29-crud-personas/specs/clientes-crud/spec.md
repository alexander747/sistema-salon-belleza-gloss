# Delta for Clientes CRUD

## ADDED Requirements

### Requirement: List Clientes

`GET /api/salones/:salonId/clientes` MUST return clientes for the salon. DUEÑA, ADMIN, RECEPCIONISTA, and MANICURISTA MAY read. Supports optional `?telefono=` search.

| Method | Endpoint | Auth | Query |
|--------|----------|------|-------|
| GET | `/api/salones/:salonId/clientes` | read roles | ?telefono |

#### Scenario: Phone search returns matching cliente

- GIVEN salon 1 has clientes with telefono "+541112345" and "+541116789"
- WHEN `GET /api/salones/1/clientes?telefono=+541112345`
- THEN status 200, response contains only the matching cliente

#### Scenario: Phone search returns empty

- GIVEN no cliente with telefono "99999" in salon 1
- WHEN `GET /api/salones/1/clientes?telefono=99999`
- THEN status 200, body is empty array

#### Scenario: Tenant isolation

- GIVEN salon A has 3 clientes, salon B has 5
- WHEN fetching clientes for salon A
- THEN only salon A's clientes returned

### Requirement: Get Cliente

`GET /api/salones/:salonId/clientes/:id` MUST return a single cliente including `puntajeConfianza`, `deudaTotal`, `puntosFidelidad`.

#### Scenario: Happy path

- GIVEN cliente id=10 with `puntajeConfianza: 100`
- WHEN `GET /api/salones/1/clientes/10`
- THEN status 200, body includes `nombre`, `telefono`, `puntajeConfianza: 100`

### Requirement: Create Cliente

`POST /api/salones/:salonId/clientes` MUST create with `nombre` and `telefono`. DUEÑA, ADMIN, RECEPCIONISTA MAY write. If `telefono` already exists in the salon, MUST return the existing cliente (n8n idempotency).

| Method | Endpoint | Auth | Body |
|--------|----------|------|------|
| POST | `/api/salones/:salonId/clientes` | write roles (except MANICURISTA) | nombre*, telefono* |

#### Scenario: Happy path create

- GIVEN valid body `{ nombre: "Juan", telefono: "+541112345" }`
- WHEN `POST /api/salones/1/clientes`
- THEN status 201, body includes `id`, `activo: true`, `puntajeConfianza: 100`

#### Scenario: Duplicate phone returns existing

- GIVEN existing cliente with telefono "+541112345" in salon 1
- WHEN `POST /api/salones/1/clientes` with same phone
- THEN status 200 (not 201), body is the existing cliente

#### Scenario: Missing telefono returns 422

- GIVEN body without `telefono`
- WHEN `POST /api/salones/1/clientes`
- THEN status 422

### Requirement: Update Cliente

`PUT /api/salones/:salonId/clientes/:id` MUST update partial fields. DUEÑA, ADMIN, RECEPCIONISTA MAY write.

#### Scenario: Update nombre

- GIVEN cliente id=10 with nombre "Juan"
- WHEN `PUT /api/salones/1/clientes/10` with `{ nombre: "Juan Carlos" }`
- THEN status 200, body.nombre equals "Juan Carlos"

### Requirement: Write Authorization

MANICURISTA MUST be rejected with 403 on write endpoints.

#### Scenario: MANICURISTA cannot create

- GIVEN JWT with rol=MANICURISTA
- WHEN `POST /api/salones/1/clientes`
- THEN status 403
