# Delta for Productos CRUD + Stock

## ADDED Requirements

### Requirement: Export Productos a Excel

`GET /api/salones/:salonId/productos/exportar` MUST return an `.xlsx` workbook. It MUST be registered **before** `GET /productos/:id` and guarded by `requireRole(...PRIVILEGED_ROLES_LIST)`. The response MUST use `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` and an attachment `Content-Disposition`.

The workbook MUST contain two sheets:

| Sheet | Content |
|-------|---------|
| Productos | One row per active product: Nombre, Marca, Código de barras, Color, Tamaño, Tipo, Precio compra (PMP), Precio venta, Margen %, Stock, Stock mínimo, Valor inventario compra, Valor inventario venta |
| Totales | total de productos; valor inventario a compra `Σ(precioCompra × cantidadStock)`; valor inventario a venta `Σ(precioVenta × cantidadStock)` ("si se vendiera todo el stock") |

#### Scenario: Descarga con dos hojas

- GIVEN a salon with 3 productos and a privileged requester
- WHEN `GET /salones/1/productos/exportar`
- THEN status 200 with the xlsx content-type and attachment disposition
- AND the workbook has sheets `Productos` (3 rows) and `Totales`

#### Scenario: Fórmulas de totales

- GIVEN producto A(precioCompra=100, precioVenta=150, stock=2) and B(precioCompra=200, precioVenta=300, stock=10)
- WHEN exporting
- THEN Totales total de productos=2, valor inventario compra=2200, valor inventario venta=3300

#### Scenario: Route order — exportar is not an :id

- GIVEN a privileged requester
- WHEN `GET /salones/1/productos/exportar`
- THEN the response is the xlsx (200), NOT a product-detail 404/422 for id="exportar"

#### Scenario: Non-privileged role denied

- GIVEN JWT with rol=MANICURISTA
- WHEN `GET /salones/1/productos/exportar`
- THEN status 403 and no workbook body

#### Scenario: Empty salon still exports

- GIVEN a salon with 0 active productos
- WHEN exporting
- THEN both sheets are returned and all Totales values are 0

#### Scenario: Values not gated incorrectly

- GIVEN products mixing `precioCompra=0` and/or `cantidadStock=0` with non-zero products
- WHEN a privileged role exports
- THEN every row shows `precioCompra` (0 included, never blank/omitted)
- AND totals sum ALL products (no row dropped for zero cost or zero stock)
