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

### Requirement: Captura de gramos usable en móvil con preview del costo de insumo

La UI de creación de registros (venta de mostrador y "completar cita") MUST presentar la captura de gramos de una línea `POR_GRAMO` como una fila propia del carrito, con etiqueta visible ("Gramos usados"), sufijo de unidad (`g`) y un área táctil de al menos 44px de alto — nunca comprimida entre el stepper de cantidad y el precio. Mientras `gramosUsados > 0`, la UI MUST mostrar el costo de insumo derivado (`gramosUsados × precioPorGramo`) formateado como moneda, y ese valor MUST coincidir con el `costoBaseInsumos` que el servidor persistirá para esa línea. Cuando los gramos están vacíos o son 0, la UI MUST NOT mostrar un costo de `$ 0`.

#### Scenario: Gramos editables en una fila propia

- GIVEN una línea `POR_GRAMO` en el carrito en un viewport móvil (390px)
- WHEN la línea se renderiza
- THEN el input de gramos tiene una etiqueta visible "Gramos usados", un sufijo "g" y un área táctil ≥44px
- AND la fila de gramos ocupa el ancho completo del carrito, sin compartir fila con el stepper de cantidad y el precio

#### Scenario: Preview del costo coincide con el persistido

- GIVEN una línea `POR_GRAMO` con `precioPorGramo=800` y 100 gramos ingresados
- WHEN el usuario tipea los gramos
- THEN la UI muestra "Costo de insumo $ 80.000" (= 100 × 800)
- AND ese valor MUST igualar el `costoBaseInsumos` que el servidor deriva para esa línea

#### Scenario: Sin gramos no hay costo engañoso

- GIVEN una línea `POR_GRAMO` con el input de gramos vacío o en 0
- WHEN la línea se renderiza
- THEN la UI MUST NOT mostrar "Costo de insumo $ 0"

### Requirement: Explicación visual del reparto (cobrado − insumos = a repartir)

La UI de creación de registros (venta de mostrador y "completar cita") MUST explicar visualmente, con los mismos números que el servidor persiste, cómo se reparte el dinero cuando hay un total ajustado y/o una línea `POR_GRAMO`. SHALL mostrar `Cobrado` (la parte de servicios del total realmente cobrado, prorrateada igual que `CreateRegistroUseCase`), `Insumos` (el `totalCostoBaseInsumos` derivado por el servidor, restado COMPLETO — no prorrateado por el descuento) y `A repartir` (= `max(0, cobrado − insumos)`). Cuando la empleada seleccionada tiene un porcentaje de comisión, la UI MUST mostrar además `Comisión empleada ({porcentaje}%)` e MUST calcularla como `aRepartir × (porcentaje / 100)`, y `Queda para el salón` como `aRepartir − comisión`. La UI MUST incluir una frase corta en español que indique que el costo de insumos se descuenta del total cobrado y el resto se reparte entre la empleada y el salón.

#### Scenario: Desglose canónico del dueño

- GIVEN un servicio `POR_GRAMO` con `precioPorGramo=800`, un total cobrado ajustado a 300.000 y 30 gramos usados, con la empleada al 60%
- WHEN la UI renderiza el desglose del reparto
- THEN muestra `Cobrado $ 300.000`, `Insumos − $ 24.000`, `A repartir $ 276.000`, `Comisión empleada (60%) $ 165.600` y `Queda para el salón $ 110.400`
- AND los valores MUST coincidir con la comisión y el costo que el servidor persiste para ese registro

#### Scenario: Insumo mayor al total cobrado

- GIVEN un total cobrado de 20.000 y un costo de insumos derivado de 24.000, con comisión del 60%
- WHEN la UI renderiza el desglose del reparto
- THEN `A repartir` es `$ 0` y `Comisión empleada` es `$ 0` (el servidor clampa en 0)
- AND la UI muestra el aviso "La comisión queda en $0 porque el insumo supera el total cobrado."
- AND la UI MUST NOT mostrar valores negativos

#### Scenario: Productos y propina prorratean la parte de servicios

- GIVEN `totalServicios=100.000`, `totalProductos=50.000`, `propina=10.000`, `valorFinal=120.000` e insumos por 20.000
- WHEN la UI calcula el desglose
- THEN `Cobrado` de servicios MUST ser 73.333 (mismo prorrateo del servidor) AND `A repartir` MUST ser 53.333
