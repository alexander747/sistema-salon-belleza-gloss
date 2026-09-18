# Delta for finanzas-registros

## MODIFIED Requirements

### Requirement: serviciosItems Input Validation

The `createRegistroSchema` MUST accept an optional `serviciosItems` array. Each item MUST validate: `servicioId` (positive int), `nombreServicio` (string max 200), `precioServicio` (positive number), `costoBaseInsumos` (number, min 0, optional, defaults 0), `gramosUsados` (number > 0, optional) and `cantidad` (int ≥ 1, optional, defaults 1). For `POR_GRAMO` lines the server MUST derive `costoBaseInsumos` from the catalog and ignore the client value. The field defaults to `[]` when absent.
(Previously: no `gramosUsados`/`cantidad` and client cost was preserved)

#### Scenario: serviciosItems validation passes

- GIVEN a payload with `serviciosItems: [{servicioId:1, nombreServicio:"Corte", precioServicio:25000}]`
- WHEN parsed through `createRegistroSchema`
- THEN validation MUST succeed

#### Scenario: serviciosItems with costoBaseInsumos

- GIVEN a payload with `serviciosItems: [{servicioId:1, nombreServicio:"Tintura", precioServicio:60000, costoBaseInsumos:40000}]`
- WHEN parsed through `createRegistroSchema`
- THEN validation MUST succeed AND costoBaseInsumos must be preserved

#### Scenario: serviciosItems with invalid data

- GIVEN a payload with `serviciosItems: [{servicioId:0, nombreServicio:"", precioServicio:-1}]`
- WHEN parsed through `createRegistroSchema`
- THEN validation MUST fail

#### Scenario: Cantidad inválida rechazada

- GIVEN `serviciosItems: [{servicioId:1, nombreServicio:"Corte", precioServicio:25000, cantidad:0}]` (o negativa)
- WHEN parsed through `createRegistroSchema`
- THEN validation MUST fail

#### Scenario: Gramos aceptados en la línea

- GIVEN `serviciosItems: [{servicioId:7, nombreServicio:"Tintura", precioServicio:450000, gramosUsados:95}]`
- WHEN parsed through `createRegistroSchema`
- THEN validation MUST succeed AND `gramosUsados` MUST be preserved

## ADDED Requirements

### Requirement: Cantidad de servicios en ventas de mostrador

Cada línea de `serviciosItems` MAY incluir `cantidad` (int ≥ 1, default 1). El sistema MUST expandir cada línea en `cantidad` filas de item por unidad (una fila por unidad, mismo `precioServicio` unitario). `totalServicios` SHALL igualar Σ(`precioServicio` × `cantidad`); `totalCostoBaseInsumos` SHALL igualar Σ(costo unitario × `cantidad`). La comisión SHALL seguir la fórmula vigente sobre esos totales, de modo que N unidades de un servicio se reflejen tanto en el ingreso como en el costo de insumos.

#### Scenario: Una línea ×2

- GIVEN `serviciosItems: [{servicioId:1, nombreServicio:"Pies", precioServicio:20000, cantidad:2}]`, `totalServicios=40000`, comisión 60%
- WHEN POST /api/salones/1/registros
- THEN 201 AND se persisten 2 item rows (cada una `precioServicio=20000`) AND `totalServicios=40000`

#### Scenario: Dos servicios distintos

- GIVEN `serviciosItems: [{servicioId:1, precioServicio:20000, cantidad:1}, {servicioId:2, precioServicio:30000, cantidad:1}]`, `totalServicios=50000`
- WHEN POST /registros
- THEN 201 AND se persisten 2 item rows AND `totalServicios=50000`

#### Scenario: Cantidades mixtas

- GIVEN `serviciosItems: [{servicioId:1, precioServicio:20000, cantidad:2}, {servicioId:2, precioServicio:30000, cantidad:3}]`
- WHEN POST /registros con `totalServicios=130000`
- THEN 201 AND se persisten 5 item rows AND la comisión se calcula sobre 130000 menos el costo total

#### Scenario: Comisión refleja la cantidad

- GIVEN una línea ×2 con `precioServicio=20000` y costo unitario 5000, comisión 60%
- WHEN se crea el registro
- THEN `totalServicios=40000`, `totalCostoBaseInsumos=10000` AND `comisionCalculada=18000` ((40000 − 10000) × 60%)

### Requirement: Costo por gramo derivado en el servidor al crear registros

En `POST /api/salones/:salonId/registros`, para cada línea de un servicio `POR_GRAMO`, el sistema MUST resolver el servicio del catálogo, calcular `gramosUsados × precioPorGramo` y persistir ese valor como `costoBaseInsumos` del item. Cualquier `costoBaseInsumos` enviado por el cliente para esa línea MUST ser descartado. Si `gramosUsados` falta o no es > 0 en una línea `POR_GRAMO`, la petición MUST rechazarse con 422 y no MUST persistirse nada.

#### Scenario: Costo forjado por el cliente es descartado

- GIVEN servicio id=7 `POR_GRAMO` con `precioPorGramo=1200` y una petición con `{gramosUsados:95, costoBaseInsumos:0}`
- WHEN POST /registros con caja ABIERTA
- THEN el item persiste `costoBaseInsumos=114000` (no 0) AND la comisión usa 114000

#### Scenario: POR_GRAMO sin gramos

- GIVEN una línea de servicio `POR_GRAMO` sin `gramosUsados`
- WHEN POST /registros
- THEN 422 ValidationError AND ningún item ni registro queda persistido

#### Scenario: FIJO mantiene su costo

- GIVEN una línea de servicio `FIJO` con `costoBaseInsumos=25000` y `gramosUsados=50`
- WHEN POST /registros
- THEN el item persiste `costoBaseInsumos=25000` AND los gramos no alteran el costo
