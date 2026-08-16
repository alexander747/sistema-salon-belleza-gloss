# Delta for finanzas-liquidacion

## ADDED Requirements

### Requirement: Frecuencia de pago por empleada

El formulario de empleada (crear/editar) MUST incluir un campo "Frecuencia de pago" con valores `MENSUAL` (default) y `QUINCENAL`. El DTO de empleada MUST exponer `frecuenciaPago` bajo rol DUEÑA/ADMINISTRADOR (null para otros roles). La API MUST aceptar `frecuenciaPago` en POST/PUT `/empleadas` con default `MENSUAL`.

#### Scenario: Crear empleada quincenal

- GIVEN payload con `frecuenciaPago: 'QUINCENAL'` y rol DUEÑA
- WHEN POST `/salones/:id/empleadas`
- THEN la empleada se guarda con `frecuenciaPago='QUINCENAL'` y la respuesta lo incluye

#### Scenario: Default MENSUAL

- GIVEN payload sin `frecuenciaPago`
- WHEN POST `/salones/:id/empleadas`
- THEN la empleada se guarda con `frecuenciaPago='MENSUAL'`

#### Scenario: Valor inválido rechazado

- GIVEN payload con `frecuenciaPago: 'SEMANAL'`
- WHEN POST `/salones/:id/empleadas`
- THEN respuesta 422

### Requirement: Período de nómina según frecuencia

El nómina pendiente MUST calcular el período de cada empleada según su `frecuenciaPago`, en timezone Colombia: `MENSUAL` → del día 1 del mes a hoy; `QUINCENAL` con día ≤ 15 → del 1 al 15; `QUINCENAL` con día ≥ 16 → del 16 al último día del mes (inclusive). El resultado MUST exponer `periodoInicio`, `periodoFin` y `frecuenciaPago` por empleada.

#### Scenario: Quincena primera mitad

- GIVEN empleada QUINCENAL y hoy = 10 de agosto (Colombia)
- WHEN GET `/salones/:id/finanzas/nomina`
- THEN `periodoInicio=2026-08-01` y `periodoFin=2026-08-15`

#### Scenario: Quincena segunda mitad

- GIVEN empleada QUINCENAL y hoy = 20 de agosto (Colombia)
- WHEN GET `/salones/:id/finanzas/nomina`
- THEN `periodoInicio=2026-08-16` y `periodoFin=2026-08-31`

#### Scenario: Mensual preserva comportamiento

- GIVEN empleada MENSUAL y hoy = 10 de agosto (Colombia)
- WHEN GET `/salones/:id/finanzas/nomina`
- THEN `periodoInicio=2026-08-01` y `periodoFin=2026-08-10`, con totales idénticos a la lógica anterior

### Requirement: Sueldo fijo quincenal = 50%

El comp fijo (`sueldoFijo` + `bonoHorario`) MUST computarse al 100% para `MENSUAL` y al 50% para `QUINCENAL`, tanto en el total a pagar pendiente como en la liquidación registrada.

#### Scenario: Quincenal paga mitad del fijo

- GIVEN empleada QUINCENAL con sueldoFijo=200000, bonoHorario=50000 y 0 comisiones
- WHEN GET `/salones/:id/finanzas/nomina`
- THEN `totalAPagar=125000` y la liquidación registra `sueldoFijo=100000`, `bonoHorario=25000`

#### Scenario: Mensual paga el fijo completo

- GIVEN empleada MENSUAL con sueldoFijo=200000 y bonoHorario=50000
- WHEN GET `/salones/:id/finanzas/nomina`
- THEN `totalAPagar=250000` (sin cambios)

### Requirement: Guard anti-doble-pago por período de la empleada

El guard MUST consultar liquidaciones del período de la empleada (`findBySalonEmpleadaAndPeriodo` con su `periodoInicio`/`periodoFin`), no un mes calendario global. MENSUAL MUST conservar la semántica actual.

#### Scenario: Quincenal liquidada en la primera quincena

- GIVEN empleada QUINCENAL liquidada del 1 al 15 y hoy = 20
- WHEN GET `/salones/:id/finanzas/nomina`
- THEN la empleada aparece con pendiente solo si hay registros posteriores a la última liquidación; el guard consulta la quincena 16-31

#### Scenario: Mensual sin registros nuevos

- GIVEN empleada MENSUAL liquidada este mes y 0 registros nuevos
- WHEN GET `/salones/:id/finanzas/nomina`
- THEN la empleada NO aparece en pendientes (comportamiento actual)

## MODIFIED Requirements

### Requirement: GET Nómina Pendiente

El sistema MUST retornar por empleada el pendiente: SUM de `comisionCalculada` + `propina` de registros no pagados, más `bonoHorario`, `sueldoFijo` (con factor 100%/50% según frecuencia), `periodoInicio`, `periodoFin`, `frecuenciaPago` y `totalAPagar`. Solo registros con `estaPagadaEmpleada=false` SHALL incluirse.
(Previously: sin campos de período/frecuencia y sin factor 50%.)

#### Scenario: Pendiente con múltiples registros

- GIVEN empleado MENSUAL con 2 registros sin pagar (comisionCalculada=15000+25000, propina=5000+3000), sueldoFijo=200000, bonoHorario=50000
- WHEN GET /api/salones/:salonId/nomina/pendiente?usuarioId=:id
- THEN totalComisiones=40000, totalPropinas=8000, sueldoFijo=200000, bonoHorario=50000, totalPendiente=298000, frecuenciaPago='MENSUAL'

#### Scenario: Pendiente con no registros

- GIVEN empleado con todos los registros pagados
- WHEN GET /api/salones/:salonId/nomina/pendiente
- THEN totalComisiones=0 Y totalPropinas=0

#### Scenario: Quincenal con registros

- GIVEN empleado QUINCENAL con 1 registro sin pagar (comisionCalculada=30000), sueldoFijo=200000, bonoHorario=0, hoy = 10
- WHEN GET /api/salones/:salonId/nomina/pendiente
- THEN totalComisiones=30000, sueldoFijo=100000, totalPendiente=130000, periodoInicio=2026-08-01, periodoFin=2026-08-15
