# Delta for finanzas-liquidacion

## ADDED Requirements

### Requirement: Período editable al liquidar (pago fuera de ciclo)

El modal de auditoría pre-liquidación MUST mostrar inputs editables Desde/Hasta de período, con default = `periodoInicio`/`periodoFin` calculados por la frecuencia de la empleada (fila pendiente). El usuario MAY cambiarlos para liquidar CUALQUIER período (adelantado / fuera de ciclo / semanal). Al cambiar el rango, los registros del detalle MUST recalcularse para el nuevo rango y la confirmación MUST enviar el período editado al endpoint de liquidación. La frecuencia SHALL seguir siendo el default; el pago fuera de ciclo es una excepción manual permitida (nada se remueve).

#### Scenario: Modal precarga el período calculado

- GIVEN empleada QUINCENAL con `periodoInicio=2026-08-01` y `periodoFin=2026-08-15`
- WHEN se abre la auditoría pre-liquidación
- THEN los inputs Desde/Hasta muestran 01/08/2026 y 15/08/2026 y el detalle lista los registros de esa quincena

#### Scenario: Editar período re-filtra el detalle

- GIVEN el modal abierto con período 1→15 y registros del 05/08 y 20/08
- WHEN el usuario edita Hasta = 31/08
- THEN el detalle se re-filtra y ahora incluye el registro del 20/08

#### Scenario: Confirmar envía el período editado

- GIVEN el usuario cambió Desde/Hasta a 2026-08-01 → 2026-08-20
- WHEN confirma la liquidación
- THEN POST `/salones/:id/finanzas/nomina/liquidar` envía `periodoInicio=2026-08-01T05:00:00.000Z` y `periodoFin=2026-08-21T05:00:00.000Z`

#### Scenario: Solapamiento con liquidación previa

- GIVEN el rango editado solapa una liquidación existente de la empleada (historial)
- WHEN el usuario edita el período
- THEN el modal MUST mostrar un aviso de que el comp fijo podría pagarse nuevamente en el rango solapado

## MODIFIED Requirements

### Requirement: Frecuencia de pago por empleada

El formulario de empleada (crear/editar) MUST incluir un campo "Frecuencia de pago" con valores `MENSUAL` (default), `QUINCENAL` y `SEMANAL`. El DTO de empleada MUST exponer `frecuenciaPago` bajo rol DUEÑA/ADMINISTRADOR (null para otros roles). La API MUST aceptar `frecuenciaPago` en POST/PUT `/empleadas` con default `MENSUAL`.
(Previously: solo `MENSUAL` y `QUINCENAL`.)

#### Scenario: Crear empleada quincenal

- GIVEN payload con `frecuenciaPago: 'QUINCENAL'` y rol DUEÑA
- WHEN POST `/salones/:id/empleadas`
- THEN la empleada se guarda con `frecuenciaPago='QUINCENAL'` y la respuesta lo incluye

#### Scenario: Crear empleada semanal

- GIVEN payload con `frecuenciaPago: 'SEMANAL'` y rol DUEÑA
- WHEN POST `/salones/:id/empleadas`
- THEN la empleada se guarda con `frecuenciaPago='SEMANAL'` y la respuesta lo incluye

#### Scenario: Default MENSUAL

- GIVEN payload sin `frecuenciaPago`
- WHEN POST `/salones/:id/empleadas`
- THEN la empleada se guarda con `frecuenciaPago='MENSUAL'`

#### Scenario: Valor inválido rechazado

- GIVEN payload con `frecuenciaPago: 'ANUAL'`
- WHEN POST `/salones/:id/empleadas`
- THEN respuesta 422

### Requirement: Período de nómina según frecuencia

El nómina pendiente MUST calcular el período de cada empleada según su `frecuenciaPago`, en timezone Colombia: `MENSUAL` → del día 1 del mes a hoy; `QUINCENAL` con día ≤ 15 → del 1 al 15; `QUINCENAL` con día ≥ 16 → del 16 al último día del mes (inclusive); `SEMANAL` → del lunes al domingo de la semana actual (inclusive). El resultado MUST exponer `periodoInicio`, `periodoFin` y `frecuenciaPago` por empleada.
(Previously: sin `SEMANAL`.)

#### Scenario: Quincena primera mitad

- GIVEN empleada QUINCENAL y hoy = 10 de agosto (Colombia)
- WHEN GET `/salones/:id/finanzas/nomina`
- THEN `periodoInicio=2026-08-01` y `periodoFin=2026-08-15`

#### Scenario: Quincena segunda mitad

- GIVEN empleada QUINCENAL y hoy = 20 de agosto (Colombia)
- WHEN GET `/salones/:id/finanzas/nomina`
- THEN `periodoInicio=2026-08-16` y `periodoFin=2026-08-31`

#### Scenario: Semana a mitad (jueves)

- GIVEN empleada SEMANAL y hoy = 13 de agosto de 2026 (jueves, Colombia)
- WHEN GET `/salones/:id/finanzas/nomina`
- THEN `periodoInicio=2026-08-10` y `periodoFin=2026-08-16`

#### Scenario: Semana el lunes

- GIVEN empleada SEMANAL y hoy = lunes 17 de agosto de 2026 (Colombia)
- WHEN GET `/salones/:id/finanzas/nomina`
- THEN `periodoInicio=2026-08-17` y `periodoFin=2026-08-23`

#### Scenario: Mensual preserva comportamiento

- GIVEN empleada MENSUAL y hoy = 10 de agosto (Colombia)
- WHEN GET `/salones/:id/finanzas/nomina`
- THEN `periodoInicio=2026-08-01` y `periodoFin=2026-08-10`, con totales idénticos a la lógica anterior

### Requirement: Sueldo fijo por frecuencia

El comp fijo (`sueldoFijo` + `bonoHorario`) MUST computarse al 100% para `MENSUAL`, 50% para `QUINCENAL` y 25% para `SEMANAL` (mensual ÷ 4), tanto en el total a pagar pendiente como en la liquidación registrada.
(Previously: sin `SEMANAL`.)

#### Scenario: Quincenal paga mitad del fijo

- GIVEN empleada QUINCENAL con sueldoFijo=200000, bonoHorario=50000 y 0 comisiones
- WHEN GET `/salones/:id/finanzas/nomina`
- THEN `totalAPagar=125000` y la liquidación registra `sueldoFijo=100000`, `bonoHorario=25000`

#### Scenario: Semanal paga la cuarta parte del fijo

- GIVEN empleada SEMANAL con sueldoFijo=200000, bonoHorario=50000 y 0 comisiones
- WHEN GET `/salones/:id/finanzas/nomina`
- THEN `totalAPagar=62500` y la liquidación registra `sueldoFijo=50000`, `bonoHorario=12500`

#### Scenario: Mensual paga el fijo completo

- GIVEN empleada MENSUAL con sueldoFijo=200000 y bonoHorario=50000
- WHEN GET `/salones/:id/finanzas/nomina`
- THEN `totalAPagar=250000` (sin cambios)

### Requirement: Guard anti-doble-pago por período de la empleada

El guard MUST consultar liquidaciones del período de la empleada (`findBySalonEmpleadaAndPeriodo` con su `periodoInicio`/`periodoFin`), no un mes calendario global. Para `SEMANAL` el período es la semana actual. MENSUAL MUST conservar la semántica actual.
(Previously: sin `SEMANAL`.)

#### Scenario: Quincenal liquidada en la primera quincena

- GIVEN empleada QUINCENAL liquidada del 1 al 15 y hoy = 20
- WHEN GET `/salones/:id/finanzas/nomina`
- THEN la empleada aparece con pendiente solo si hay registros posteriores a la última liquidación; el guard consulta la quincena 16-31

#### Scenario: Semana liquidada sin registros nuevos

- GIVEN empleada SEMANAL liquidada esta semana y 0 registros nuevos
- WHEN GET `/salones/:id/finanzas/nomina`
- THEN la empleada NO aparece en pendientes

#### Scenario: Mensual sin registros nuevos

- GIVEN empleada MENSUAL liquidada este mes y 0 registros nuevos
- WHEN GET `/salones/:id/finanzas/nomina`
- THEN la empleada NO aparece en pendientes (comportamiento actual)
