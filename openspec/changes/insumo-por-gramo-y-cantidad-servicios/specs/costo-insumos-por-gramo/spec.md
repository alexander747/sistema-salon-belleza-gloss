# Delta for costo-insumos-por-gramo

## ADDED Requirements

### Requirement: Modo de costo de insumos en el catálogo

Cada servicio MUST exponer `tipoCostoInsumo` (`FIJO | POR_GRAMO`, default `FIJO`) y `precioPorGramo` (decimal nullable). Con `POR_GRAMO`, `precioPorGramo` MUST ser > 0; con `FIJO`, `precioPorGramo` MUST ser `null` y el sistema MUST seguir usando `costoBaseInsumos`. Servicios existentes sin el campo MUST leerse como `FIJO` (retrocompatibilidad).

#### Scenario: Servicio POR_GRAMO válido

- GIVEN `POST /api/salones/1/servicios` con `{ tipoCostoInsumo: "POR_GRAMO", precioPorGramo: 1200, ... }`
- WHEN se crea el servicio
- THEN 201 AND `body.tipoCostoInsumo="POR_GRAMO"` AND `body.precioPorGramo=1200`

#### Scenario: POR_GRAMO sin precio rechazado

- GIVEN un payload con `tipoCostoInsumo="POR_GRAMO"` y sin `precioPorGramo` (o `precioPorGramo=0`)
- WHEN se crea o actualiza el servicio
- THEN 422 ValidationError AND el servicio no se persiste

#### Scenario: Default FIJO retrocompatible

- GIVEN un payload sin `tipoCostoInsumo`
- WHEN se crea el servicio
- THEN 201 AND `body.tipoCostoInsumo="FIJO"` AND `body.precioPorGramo=null`

### Requirement: Derivación server-side del costo real por gramo

Para cada línea de servicio `POR_GRAMO`, el servidor MUST derivar el costo real como `gramosUsados × precioPorGramo`, usando la configuración del catálogo del servicio como snapshot. El resultado MUST persistirse como `costoBaseInsumos` del item de registro. El `costoBaseInsumos` enviado por el cliente para una línea `POR_GRAMO` MUST ser ignorado: el cliente NO puede reducir la base de comisión enviando un costo arbitrario. La derivación MUST ocurrir en el servidor.

#### Scenario: Costo real derivado en el servidor

- GIVEN servicio id=7 con `tipoCostoInsumo=POR_GRAMO`, `precioPorGramo=1200` y una venta con `gramosUsados=95`
- WHEN `POST /api/salones/1/registros` (el cliente envía `costoBaseInsumos: 0`)
- THEN el item persiste `costoBaseInsumos=114000` (95 × 1200) AND el valor del cliente es ignorado

#### Scenario: Gramos ausentes o inválidos rechazados

- GIVEN una línea de un servicio `POR_GRAMO`
- WHEN la venta omite `gramosUsados` o envía `gramosUsados=0` (o negativo)
- THEN 422 ValidationError AND el registro no se crea

#### Scenario: Snapshot auditables de gramos y precio

- GIVEN una venta `POR_GRAMO` con `gramosUsados=95` y `precioPorGramo=1200`
- WHEN se persiste el item
- THEN el item guarda `gramosUsados=95` AND `precioPorGramo=1200` AND `costoBaseInsumos=114000`

### Requirement: Contrato de comisión con costo real

La comisión SHALL mantener la fórmula vigente `max(0, totalServicios − totalCostoBaseInsumosReal) × (porcentajeComision / 100)`, donde `totalCostoBaseInsumosReal` es la suma de los `costoBaseInsumos` reales de los items. El cálculo NO cambia: solo cambia el valor de costo que se le inyecta.

#### Scenario: Comisión con costo por gramo (registro 182)

- GIVEN `totalServicios=450000`, un item `POR_GRAMO` con costo real `114000` y comisión del empleado `60%`
- WHEN se crea el registro
- THEN `comisionCalculada=201600` ((450000 − 114000) × 60%)

#### Scenario: Insumos mayores al total

- GIVEN `totalServicios=100000`, costo real de items `120000` y comisión `60%`
- WHEN se crea el registro
- THEN `comisionCalculada=0` (nunca negativa)

### Requirement: Consistencia del costo real en reportes

Los reportes P&L mensual y resumen del día MUST sumar el `costoBaseInsumos` persistido por item (ya sea `FIJO` o el costo real derivado `POR_GRAMO`). El costo de insumos reportado MUST coincidir con el costo que se restó para la comisión del mismo registro.

#### Scenario: P&L y resumen usan el costo real

- GIVEN un registro `POR_GRAMO` con items cuyo costo real suma 114000 en el período
- WHEN se consulta el P&L mensual y el resumen del día
- THEN `costoBaseInsumos` (P&L) y `totalCostoBaseInsumos` (resumen) MUST incluir 114000

#### Scenario: Múltiples líneas POR_GRAMO

- GIVEN dos items `POR_GRAMO` con costos reales 114000 y 36000
- WHEN se reporta el día
- THEN el total de insumos del día MUST ser 150000

### Requirement: Retrocompatibilidad de servicios FIJO y registros legacy

Una línea de un servicio `FIJO` MUST ser inmune a los gramos: un `gramosUsados` enviado MUST ignorarse y el costo MUST conservar la semántica existente de `costoBaseInsumos`. Items de registros legacy sin `gramosUsados`/`precioPorGramo` MUST seguir leyéndose con su `costoBaseInsumos` intacto.

#### Scenario: FIJO ignora gramos

- GIVEN servicio `FIJO` con `costoBaseInsumos=25000` y una venta con `gramosUsados=50`
- WHEN se crea el registro
- THEN el item persiste `costoBaseInsumos=25000` AND los gramos se ignoran

#### Scenario: Item legacy se lee sin cambios

- GIVEN un registro existente con items sin `gramosUsados` ni `precioPorGramo`
- WHEN `GET /api/salones/1/registros/:id`
- THEN 200 AND el item conserva su `costoBaseInsumos` y la comisión original
