# Productos CRUD + Stock Specification

## Purpose

Define CRUD operations for inventory products (productos) with stock management. Products support role-based `precioCompra` visibility and stock mutation operations (descontar/reabastecer) with negative-stock prevention.

## Requirements

### Requirement: List Productos

`GET /api/salones/:salonId/productos` MUST return active productos, optionally filtered by `tipoInventario` (RETAIL|INTERNAL). Role-based field visibility:
- DUEÑA/ADMIN: see all fields including `precioCompra`
- MANICURISTA/RECEPCIONISTA: see `precioVenta`, `stock` but NOT `precioCompra`
- CONTADOR: see all fields read-only

| Method | Endpoint | Auth | Query |
|--------|----------|------|-------|
| GET | `/api/salones/:salonId/productos` | any role | ?tipoInventario=RETAIL |

#### Scenario: Happy path — list

- GIVEN a salon with 5 RETAIL productos and 3 INTERNAL
- WHEN `GET /api/salones/1/productos?tipoInventario=RETAIL`
- THEN status 200
- AND body contains only RETAIL productos

#### Scenario: precioCompra hidden for manicurista

- GIVEN JWT with rol=MANICURISTA
- WHEN `GET /api/salones/1/productos`
- THEN body[0] has `precioVenta` but NOT `precioCompra`

#### Scenario: Tenant isolation

- GIVEN salon A has 4 productos and salon B has 7
- WHEN fetching productos for salon A
- THEN only salon A's productos are returned

### Requirement: Get Producto Detail

`GET /api/salones/:salonId/productos/:id` MUST return a single producto with role-based field filtering.

#### Scenario: Happy path — contador sees all

- GIVEN JWT with rol=CONTADOR
- WHEN `GET /api/salones/1/productos/5`
- THEN status 200
- AND body includes `precioCompra` and `precioVenta`

#### Scenario: Recepcionista cannot see precioCompra

- GIVEN JWT with rol=RECEPCIONISTA
- WHEN `GET /api/salones/1/productos/5`
- THEN `precioCompra` is absent from the response

### Requirement: Create Producto

`POST /api/salones/:salonId/productos` MUST create a producto. DUEÑA and ADMIN MAY write.

| Method | Endpoint | Auth | Body |
|--------|----------|------|------|
| POST | `/api/salones/:salonId/productos` | write roles | nombre*, precioVenta*, tipoInventario*, precioCompra? |

#### Scenario: Happy path — create

- GIVEN valid body with nombre, precioVenta, tipoInventario
- WHEN `POST /api/salones/1/productos`
- THEN status 201
- AND body includes `id`, `cantidadStock: 0`, `activo: true`

#### Scenario: Missing required fields

- GIVEN body without `nombre`
- WHEN `POST /api/salones/1/productos`
- THEN status 422

### Requirement: Update Producto

`PUT /api/salones/:salonId/productos/:id` MUST update partial fields.

#### Scenario: Happy path

- GIVEN producto id=5 with nombre "Esmalte"
- WHEN `PUT /api/salones/1/productos/5` with `{ nombre: "Esmalte Rojo" }`
- THEN status 200
- AND body.nombre equals "Esmalte Rojo"

### Requirement: Descontar Stock

`POST /api/salones/:salonId/productos/:id/descontar` MUST decrement `cantidadStock` by `cantidad`. If `cantidadStock < cantidad`, MUST reject with 422.

| Method | Endpoint | Auth |
|--------|----------|------|
| POST | `/api/salones/:salonId/productos/:id/descontar` | any role |

#### Scenario: Happy path — decrement stock

- GIVEN producto id=5 with cantidadStock=10
- WHEN `POST /api/salones/1/productos/5/descontar` with `{ cantidad: 3 }`
- THEN status 200
- AND body.cantidadStock equals 7

#### Scenario: Prevent negative stock

- GIVEN producto id=5 with cantidadStock=2
- WHEN `POST /api/salones/1/productos/5/descontar` with `{ cantidad: 5 }`
- THEN status 422
- AND error indicates insufficient stock

### Requirement: Reabastecer Stock

`POST /api/salones/:salonId/productos/:id/reabastecer` MUST increment `cantidadStock` by `cantidad`. Optionally updates `precioCompra`.

#### Scenario: Happy path — restock

- GIVEN producto id=5 with cantidadStock=10
- WHEN `POST /api/salones/1/productos/5/reabastecer` with `{ cantidad: 5 }`
- THEN status 200
- AND body.cantidadStock equals 15

### Requirement: Delete Producto (Soft)

`DELETE /api/salones/:salonId/productos/:id` MUST set `activo=false`.

#### Scenario: Happy path

- GIVEN producto id=5 with activo=true
- WHEN `DELETE /api/salones/1/productos/5`
- THEN status 200
- AND producto `activo` is now `false`

### Requirement: Write Authorization

MANICURISTA, RECEPCIONISTA, and CONTADOR MUST be rejected with 403 on write/stock endpoints.

#### Scenario: Manicurista cannot descontar

- GIVEN JWT with rol=MANICURISTA
- WHEN `POST /api/salones/1/productos/5/descontar`
- THEN status 403
