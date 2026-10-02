# Delta for Productos CRUD + Stock

## ADDED Requirements

### Requirement: Producto Price Mode

The system MUST persist a per-product `tipoPrecio` (`FIJO` | `MARGEN`) as the `precioVenta` source of truth; create and update MUST persist it. `MARGEN` derives `precioVenta = precioCompra × (1 + margenGanancia/100)`; `FIJO` stores it verbatim.

#### Scenario: Create persists mode

- GIVEN a create body with `tipoPrecio: "FIJO"` and `precioVenta: 500`
- WHEN `POST /api/salones/1/productos`
- THEN status 201
- AND `body.tipoPrecio` equals `"FIJO"` and `body.precioVenta` equals 500

#### Scenario: Update persists mode

- GIVEN producto id=5 with `tipoPrecio="MARGEN"`
- WHEN `PUT /api/salones/1/productos/5` with `{ tipoPrecio: "FIJO", precioVenta: 750 }`
- THEN `body.tipoPrecio` equals `"FIJO"` and `body.precioVenta` equals 750

#### Scenario: Backfill existing data

- GIVEN a legacy producto with `precioCompra=0`, `precioVenta>0`, no `tipoPrecio`
- WHEN the backfill runs
- THEN `tipoPrecio` becomes `"FIJO"` and `precioVenta` is unchanged

### Requirement: Restock Producto Respects Price Mode

`POST /api/salones/:salonId/productos/:id/restock` MUST update the weighted-average `precioCompra` (PMP) from `cantidad` and the incoming `precioCompra`, then derive `precioVenta` from `tipoPrecio`. `MARGEN` MUST recompute from `margenGanancia`; `FIJO` MUST NOT overwrite `precioVenta` (MAY accept an explicit one).

#### Scenario: FIJO leaves price unchanged (PMP still updates)

- GIVEN a `FIJO` producto with `precioVenta=500`, `cantidadStock=10`, `precioCompra=0`
- WHEN `POST /api/salones/1/productos/5/restock` with `{ cantidad: 5, precioCompra: 100 }`
- THEN `body.precioVenta` equals 500 and `body.precioCompra` equals the PMP

#### Scenario: MARGEN recomputes

- GIVEN a `MARGEN` producto with `margenGanancia=30`, `cantidadStock=0`
- WHEN `POST /api/salones/1/productos/5/restock` with `{ cantidad: 10, precioCompra: 100 }`
- THEN `precioCompra`=100 and `precioVenta`=130

#### Scenario: FIJO accepts an explicit new price

- GIVEN a `FIJO` producto with `precioVenta=500`
- WHEN `POST /api/salones/1/productos/5/restock` with `{ cantidad: 5, precioCompra: 100, precioVenta: 650 }`
- THEN `body.precioVenta` equals 650

### Requirement: Sale Price Snapshot Stability

Sale registration MUST snapshot the current `precioVenta` into `RegistroProducto.precioVentaUnitario`. Since restock no longer clobbers a `FIJO` price, future sales, caja and reports MUST reflect it.

#### Scenario: Snapshot uses configured fixed price

- GIVEN a `FIJO` producto with `precioVenta=500` restocked unchanged
- WHEN a sale registers that producto
- THEN `RegistroProducto.precioVentaUnitario` equals 500

## MODIFIED Requirements

### Requirement: Create Producto

`POST /api/salones/:salonId/productos` MUST create a producto (DUEÑA/ADMIN MAY write). Body: `nombre*`, `tipoInventario*`, `tipoPrecio` (default `MARGEN`), `precioVenta` (required when `FIJO`), `precioCompra?`, `margenGanancia?`. For `MARGEN`, absent `precioVenta` MUST be derived from `precioCompra`/`margenGanancia`.
(Previously: `precioVenta*` required; derived from margin only when absent.)

#### Scenario: Happy path — create

- GIVEN valid body with nombre, tipoInventario, tipoPrecio
- WHEN `POST /api/salones/1/productos`
- THEN status 201 and body includes `id`, `cantidadStock: 0`, `activo: true`

#### Scenario: Missing required fields

- GIVEN body without `nombre`
- WHEN `POST /api/salones/1/productos`
- THEN status 422

#### Scenario: FIJO requires precioVenta

- GIVEN body `{ nombre, tipoInventario, tipoPrecio: "FIJO" }` without `precioVenta`
- WHEN `POST /api/salones/1/productos`
- THEN status 422

### Requirement: Update Producto

`PUT /api/salones/:salonId/productos/:id` MUST update partial fields and persist `tipoPrecio`. Derivation MUST follow the stored (or incoming) mode: `FIJO` MUST keep `precioVenta` unless explicitly provided; `MARGEN` MUST recompute when `precioCompra`/`margenGanancia` change and `precioVenta` is not explicit.
(Previously: always recomputed from margin when `precioCompra`/`margenGanancia` changed.)

#### Scenario: Happy path

- GIVEN producto id=5 with nombre "Esmalte"
- WHEN `PUT /api/salones/1/productos/5` with `{ nombre: "Esmalte Rojo" }`
- THEN status 200 and body.nombre equals "Esmalte Rojo"

#### Scenario: FIJO price not recalculated

- GIVEN a `FIJO` producto with `precioVenta=500`
- WHEN `PUT /api/salones/1/productos/5` with `{ precioCompra: 80 }`
- THEN `body.precioVenta` equals 500

### Requirement: Reabastecer Stock

`POST /api/salones/:salonId/productos/:id/reabastecer` MUST increment `cantidadStock` by `cantidad` and MAY update `precioCompra`. It MUST NOT change `precioVenta`; `/restock` owns price derivation.
(Previously: only said it "optionally updates precioCompra".)

#### Scenario: Happy path — restock

- GIVEN producto id=5 with cantidadStock=10
- WHEN `POST /api/salones/1/productos/5/reabastecer` with `{ cantidad: 5 }`
- THEN body.cantidadStock equals 15

#### Scenario: precioVenta untouched

- GIVEN producto with `precioVenta=500`
- WHEN `POST /api/salones/1/productos/5/reabastecer` with `{ cantidad: 5, precioCompra: 90 }`
- THEN `body.precioVenta` equals 500
