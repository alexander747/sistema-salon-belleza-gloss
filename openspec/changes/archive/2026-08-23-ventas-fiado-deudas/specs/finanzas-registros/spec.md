# Delta for finanzas-registros

## ADDED Requirements

### Requirement: Venta con pago parcial o fiado

El sistema MUST aceptar en `POST /registros` una venta con pago parcial o sin pago (fiado): `pagos` MAY contener montos menores al total o ser `[]`. `montoPendiente = max(0, valorFinal − propina − Σ pagos.monto)` (floor 0; la propina queda excluida de la deuda, semántica existente). La comisión del empleado SHALL calcularse sobre el valor COMPLETO ajustado por descuento, sin importar lo cobrado (el salón asume la deuda — invariante). Cada pago creado en la venta SHALL persistir `cajaId` = caja del registro (misma caja de la fecha de negocio).

#### Scenario: Fiado total

- GIVEN totalServicios=100000, propina=0, `pagos: []` y caja ABIERTA de la fecha
- WHEN POST /salones/1/registros
- THEN 201 con `montoPendiente=100000` AND comisionCalculada sobre 100000 AND sin filas en pagos_transaccion

#### Scenario: Pago parcial

- GIVEN valorFinal=90000, propina=0, `pagos: [{monto: 50000, metodoPago: 'EFECTIVO'}]`
- WHEN POST /registros
- THEN `montoPendiente=40000` AND el pago persiste `cajaId` = caja del registro

#### Scenario: Pago parcial con propina

- GIVEN valorFinal=90000, propina=10000, pago=80000
- WHEN POST /registros
- THEN `montoPendiente=0` (90000−10000−80000) AND propina fuera de la deuda

### Requirement: POST Abonar Deuda

El sistema MUST aceptar `POST /salones/:salonId/registros/:id/pagos` con body `{monto, metodoPago, referencia?}` (schema `abonarDeudaSchema`, `monto` positivo). Roles: SUPERADMIN, DUEÑA, ADMINISTRADOR, RECEPCIONISTA. El abono SHALL validar: registro existe y pertenece al salón (404 `REGISTRO_NO_ENCONTRADO`); registro NO `ANULADO` (422 `REGISTRO_ANULADO`); `monto <= montoPendiente` (409 `MONTO_EXCEDE_PENDIENTE`); caja ABIERTA hoy (422 `CAJA_CERRADA`, regla de oro). En UNA transacción MUST: crear `PagoTransaccion` con `cajaId` = caja de HOY, decrementar `registro.montoPendiente` y `cliente.deudaTotal` (nunca negativos). Respuesta 201 con el registro actualizado (DTO con `pagos`).

#### Scenario: Abono parcial exitoso

- GIVEN registro ACTIVO con montoPendiente=40000 y caja ABIERTA hoy
- WHEN POST /salones/1/registros/5/pagos {monto: 25000, metodoPago: 'EFECTIVO'}
- THEN 201 con pago creado ligado a la caja de HOY AND montoPendiente=15000 AND cliente.deudaTotal reducida en 25000

#### Scenario: Abono que salda la deuda

- GIVEN montoPendiente=40000
- WHEN abono {monto: 40000}
- THEN montoPendiente=0 AND deudaTotal reducida en 40000

#### Scenario: Abono supera el pendiente

- GIVEN montoPendiente=40000
- WHEN abono {monto: 45000}
- THEN 409 `MONTO_EXCEDE_PENDIENTE` AND ningún pago creado ni deuda modificada

#### Scenario: Registro anulado no recibe abonos

- GIVEN registro ANULADO con montoPendiente=0
- WHEN abono {monto: 10000}
- THEN 422 `REGISTRO_ANULADO` AND ningún pago creado

#### Scenario: Registro inexistente o de otro salón

- GIVEN registro id=999 o un registro de otro salón
- WHEN abono
- THEN 404 `REGISTRO_NO_ENCONTRADO`

#### Scenario: Sin caja abierta hoy

- GIVEN no hay caja ABIERTA hoy
- WHEN abono
- THEN 422 `CAJA_CERRADA` AND ningún pago creado

#### Scenario: Monto inválido

- GIVEN body {monto: 0} o {monto: -5}
- WHEN abono
- THEN 400 ValidationError

### Requirement: Anulación con pago parcial — limitación conocida

La anulación de un registro con pagos previos SHALL conservar su comportamiento actual (los pagos permanecen en la tabla; `calcularReporteCierre` excluye registros ANULADO). Esta es una limitación conocida documentada: el efectivo ya recibido puede no reflejarse en el arqueo de la caja original si el registro se anula después del cierre. NO se corrige en este cambio.

#### Scenario: Documentación de la limitación

- GIVEN el código de anulación y arqueo
- THEN SHALL existir un comentario referenciando esta limitación (decisión owner)
