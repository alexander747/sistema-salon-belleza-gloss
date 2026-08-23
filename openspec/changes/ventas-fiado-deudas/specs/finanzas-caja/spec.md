# Delta for finanzas-caja

## ADDED Requirements

### Requirement: Arqueo incluye pagos por su caja (abonos)

El sistema MUST computar el arqueo de una caja con TODOS los pagos recibidos ese día, identificados por su `pago.cajaId`: (a) pagos de registros de la caja (`pago.cajaId = C`, o `NULL` con fallback `registro.cajaId = C` para legacy) y (b) abonos posteriores (`pago.cajaId = C` sobre registros de OTRA caja). Cada pago SHALL contar en UNA sola caja (la suya; fallback la del registro) — sin doble conteo. `montoEsperado = montoInicial + Σ pagos EFECTIVO de la caja − Σ gastos EFECTIVO` se mantiene; el desglose por método de pago SHALL incluir los abonos.

#### Scenario: Abono de hoy en registro de ayer

- GIVEN caja de ayer CERRADA con registro montoPendiente=40000 y caja de HOY ABIERTA
- WHEN abono de 25000 EFECTIVO hoy (pago.cajaId = caja de hoy) y luego se cierra la caja de hoy
- THEN el arqueo de HOY incluye 25000 en EFECTIVO AND el arqueo de AYER no lo incluye

#### Scenario: Sin doble conteo entre cajas

- GIVEN pago con `pago.cajaId = C` y `registro.cajaId = A` (A ≠ C)
- WHEN se calcula el arqueo de C y el de A
- THEN el pago cuenta SOLO en C

#### Scenario: Pago legacy sin cajaId

- GIVEN pago con `cajaId = NULL` y `registro.cajaId = A`
- WHEN se calcula el arqueo de A
- THEN el pago cuenta en A (fallback por registro.cajaId)

#### Scenario: Abono bloqueado sobre registro anulado

- GIVEN registro ANULADO
- WHEN POST /registros/:id/pagos
- THEN 422 `REGISTRO_ANULADO` AND ningún pago ingresa a ninguna caja (el guard del abono impide pagos de registros anulados)

## MODIFIED Requirements

### Requirement: Reporte de Cierre

El reporte de cierre MUST incluir los campos existentes (total servicios, total productos, ingresos brutos, descuentos, ingresos netos, desglose por metodoPago, comisiones, total gastos, montoEsperado, montoReal, diferencia, cantidad de movimientos). La función de cálculo SHALL aceptar `pagosExtra` (pagos de la caja provenientes de abonos u otros registros) y sumarlos al desglose `porMetodoPago` y al arqueo de EFECTIVO. `ingresosBrutos`/`ingresosNetos` siguen siendo líneas informativas devengadas (no cambian con abonos).
(Previously: el reporte derivaba todos los pagos únicamente de los registros de la caja; los abonos posteriores caían en la caja del registro original)

#### Scenario: Reporte con abono incluido

- GIVEN caja con montoInicial=50000, un registro con pago EFECTIVO=180000 y un abono EFECTIVO=25000 (pagosExtra); sin gastos
- WHEN se cierra la caja con montoRealEfectivo=255000
- THEN porMetodoPago.EFECTIVO=205000 AND montoEsperado=255000 AND diferencia=0
