# Delta for finanzas-reportes

## ADDED Requirements

### Requirement: P&L cash-basis con fiado y deudas por cobrar

El P&L MUST agregar tres campos (decisión owner: ingreso se cuenta cuando se cobra):
- `cobrado`: Σ pagos recibidos en el período por fecha de recepción (pago.cajaId → caja.fechaCaja; fallback `COALESCE(registro.fechaHora, creadoEn)`), excluyendo registros ANULADO.
- `fiadoPeriodo`: Σ `montoPendiente` de registros NO ANULADO del período (fiado originado en el período).
- `deudasPorCobrar`: Σ `montoPendiente` de registros NO ANULADO con fecha de negocio ≤ `hasta` (snapshot acumulado de deudas por cobrar a clientes).

`ingresosBrutos`, `descuentos`, `ingresosNetos`, `totalServicios`, `totalProductos` SHALL permanecer como líneas informativas devengadas. `utilidadNeta = cobrado − costoBaseInsumos − comisiones − totalGastos − devoluciones` (base caja).

#### Scenario: Venta fiada no es ingreso hasta cobrarse

- GIVEN período con venta fiada de 100000 (sin pagos) y venta cobrada de 50000
- WHEN GET /salones/1/finanzas/pyl
- THEN cobrado=50000 AND fiadoPeriodo=100000 AND utilidadNeta usa cobrado (no 150000)

#### Scenario: Abono posterior cuenta en el período del cobro

- GIVEN venta fiada en mayo (montoPendiente=100000); abono de 100000 recibido en junio
- WHEN GET pyl de junio
- THEN cobrado de junio incluye 100000 AND fiadoPeriodo de junio = 0

#### Scenario: Deudas por cobrar acumuladas

- GIVEN registro fiado de marzo (montoPendiente=30000) y registro fiado de junio (montoPendiente=20000)
- WHEN GET pyl de junio
- THEN deudasPorCobrar=50000

#### Scenario: Pago de registro anulado excluido

- GIVEN registro ANULADO con pago histórico
- WHEN GET pyl
- THEN el pago NO suma a cobrado

### Requirement: Resumen del día con cobrado y fiado

El resumen (día o período) MUST agregar `totalCobrado` (Σ pagos recibidos, misma semántica que P&L) y `totalFiadoDia` (Σ montoPendiente de registros NO ANULADO del período). `totalIngresos` SHALL permanecer devengado (informativo).

#### Scenario: Día con venta fiada

- GIVEN día con venta fiada de 60000 y venta cobrada de 40000
- WHEN GET /salones/1/reportes/resumen-dia
- THEN totalIngresos=100000 (devengado informativo) AND totalCobrado=40000 AND totalFiadoDia=60000

## MODIFIED Requirements

### Requirement: GET ROI Mensual

El sistema MUST calcular: `ingresos (cash: Σ pagos recibidos en el mes, por fecha de recepción, excluyendo registros ANULADO) − gastosFijos − gastosOperativos − nominaTotal` para un mes dado. Ambos parámetros, mes y año, son requeridos. `gananciaNeta = ingresos − gastosFijos − gastosOperativos − nomina`.
(Previously: ingresos = totalServicios + totalProductos del mes — devengado)

#### Scenario: ROI con todos los factores

- GIVEN mes con cobrado=3500000 (ventas devengadas 4000000, fiado 500000), gastosFijos=800000, gastosOperativos=0, nominaTotal=1200000
- WHEN GET /api/salones/:salonId/reportes/roi-mensual?mes=5&anio=2026
- THEN gananciaNeta MUST ser 1500000 (3500000 − 800000 − 1200000)

#### Scenario: ROI sin datos

- GIVEN no registros, gastos ni liquidaciones existen para el mes
- WHEN GET /api/salones/:salonId/reportes/roi-mensual
- THEN ingresos=0 AND gananciaNeta=0
