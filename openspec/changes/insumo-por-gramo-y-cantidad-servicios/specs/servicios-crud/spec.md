# Delta for servicios-crud

## MODIFIED Requirements

### Requirement: Create Servicio

`POST /api/salones/:salonId/servicios` MUST create a servicio. DUEÑA and ADMIN MAY write. `categoriaId` MUST belong to the same salon. The response MUST include `costoBaseInsumos` (default 0), `tipoCostoInsumo` (default `FIJO`) and `precioPorGramo` (default `null`). When `tipoCostoInsumo=POR_GRAMO`, `precioPorGramo` MUST be > 0.
(Previously: only `costoBaseInsumos` was accepted/returned)

| Method | Endpoint | Auth | Body |
|--------|----------|------|------|
| POST | `/api/salones/:salonId/servicios` | write roles | nombre*, precioBase*, duracionMinutos*, categoriaId*, descripcion?, costoBaseInsumos?, tipoCostoInsumo?, precioPorGramo? |

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

#### Scenario: Create POR_GRAMO

- GIVEN a valid body with `tipoCostoInsumo: "POR_GRAMO"` and `precioPorGramo: 1200`
- WHEN `POST /api/salones/1/servicios`
- THEN status 201 AND `body.tipoCostoInsumo="POR_GRAMO"` AND `body.precioPorGramo=1200`

#### Scenario: Create POR_GRAMO without price

- GIVEN a valid body with `tipoCostoInsumo: "POR_GRAMO"` and no `precioPorGramo`
- WHEN `POST /api/salones/1/servicios`
- THEN status 422

### Requirement: Update Servicio

`PUT /api/salones/:salonId/servicios/:id` MUST update partial fields, including `costoBaseInsumos`, `tipoCostoInsumo` and `precioPorGramo`. Changing to `POR_GRAMO` without a positive `precioPorGramo` (existing or in the same body) MUST be rejected with 422.
(Previously: only `costoBaseInsumos` among cost fields)

#### Scenario: Happy path

- GIVEN servicio id=10 with precioBase=100
- WHEN `PUT /api/salones/1/servicios/10` with `{ precioBase: 150 }`
- THEN status 200
- AND body.precioBase equals 150

#### Scenario: Update costoBaseInsumos

- GIVEN servicio id=10 with costoBaseInsumos=0
- WHEN `PUT /api/salones/1/servicios/10` with `{ costoBaseInsumos: 25000 }`
- THEN status 200
- AND body.costoBaseInsumos equals 25000

#### Scenario: Update a POR_GRAMO

- GIVEN servicio id=10 with `tipoCostoInsumo="FIJO"`
- WHEN `PUT /api/salones/1/servicios/10` with `{ tipoCostoInsumo: "POR_GRAMO", precioPorGramo: 1500 }`
- THEN status 200 AND `body.tipoCostoInsumo="POR_GRAMO"` AND `body.precioPorGramo=1500`

#### Scenario: POR_GRAMO sin precio al actualizar

- GIVEN servicio id=10 con `precioPorGramo=null`
- WHEN `PUT /api/salones/1/servicios/10` with `{ tipoCostoInsumo: "POR_GRAMO" }`
- THEN status 422

## ADDED Requirements

### Requirement: Exposición del modo de costo en ServicioDTO

`GET /api/salones/:salonId/servicios` y `GET /api/salones/:salonId/servicios/:id` MUST incluir `tipoCostoInsumo` y `precioPorGramo` en cada servicio. Servicios legacy sin el campo MUST devolver `tipoCostoInsumo="FIJO"` y `precioPorGramo=null`.

#### Scenario: List expone el modo de costo

- GIVEN un servicio `POR_GRAMO` con `precioPorGramo=1200`
- WHEN `GET /api/salones/1/servicios`
- THEN cada ítem incluye `tipoCostoInsumo` AND `precioPorGramo`

#### Scenario: Servicio legacy

- GIVEN un servicio creado antes del cambio (sin los campos)
- WHEN `GET /api/salones/1/servicios/:id`
- THEN `tipoCostoInsumo="FIJO"` AND `precioPorGramo=null`
