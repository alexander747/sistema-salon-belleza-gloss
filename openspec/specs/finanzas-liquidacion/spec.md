# Liquidación / Nómina — Specification

## Purpose

Employee payroll: calculate pending amounts, liquidate services, and query history. Only registros with `estaPagadaEmpleada=false` are eligible for liquidation.

## ADDED Requirements

### Requirement: GET Nómina Pendiente

The system MUST return per-employee pending payroll: SUM of unpaid `comisionCalculada` + `propina` from eligible registros, plus the employee's `bonoHorario` and `sueldoFijo`. Only registros where `estaPagadaEmpleada=false` SHALL be included.

#### Scenario: Pending with multiple registros
- GIVEN empleado has 2 unpaid registros (comisionCalculada=15000+25000, propina=5000+3000), sueldoFijo=200000, bonoHorario=50000
- WHEN GET /api/salones/:salonId/nomina/pendiente?usuarioId=:id
- THEN response MUST show totalComisiones=40000, totalPropinas=8000, sueldoFijo=200000, bonoHorario=50000, totalPendiente=298000

#### Scenario: Pending with no registros
- GIVEN empleado has all registros already paid
- WHEN GET /api/salones/:salonId/nomina/pendiente
- THEN totalComisiones=0 AND totalPropinas=0

### Requirement: POST Liquidar Empleada

The system MUST create a `LiquidacionEntity` covering `fechaDesde` to `fechaHasta`, set `totalComisiones`, `totalPropinas`, `sueldoFijo`, `bonoHorario`, `totalPagado`, and MUST update ALL unpaid registros for that employee to `estaPagadaEmpleada=true`, linking them to the `liquidacionId`.

#### Scenario: Liquidate employee
- GIVEN empleado has 3 unpaid registros totaling comisiones=60000, propinas=12000, sueldoFijo=200000, bonoHorario=50000
- WHEN POST /api/salones/:salonId/nomina/liquidar with usuarioId, fechaDesde, fechaHasta
- THEN response MUST be 201 AND all 3 registros MUST have estaPagadaEmpleada=true AND liquidacionId=createdId

#### Scenario: Liquidate twice (already paid)
- GIVEN all registros are already paid for this employee
- WHEN POST /api/salones/:salonId/nomina/liquidar
- THEN response MUST be 409 Conflict with message explaining nothing to liquidate

### Requirement: GET Historial Liquidaciones

The system MUST return liquidaciones for an employee, filterable by date range.

#### Scenario: Historial with filters
- GIVEN empleado has 2 liquidaciones in different months
- WHEN GET /api/salones/:salonId/nomina/historial?usuarioId=:id&fechaDesde=2026-05-01&fechaHasta=2026-05-31
- THEN only the May liquidación is returned with totalPagado and date range

### Requirement: Nómina incluye todos los roles pagados por el salón

La nómina pendiente MUST incluir empleados activos de los roles MANICURISTA, RECEPCIONISTA, ADMINISTRADOR y DUEÑA del salón. MUST NOT incluir CONTADOR. SUPERADMIN queda excluido (no pertenece a un salón).

#### Scenario: Recepcionista con sueldo fijo aparece
- GIVEN recepcionista activa con sueldoFijo=400000 y 0 registros pendientes
- WHEN GET /salones/:salonId/finanzas/nomina
- THEN la respuesta incluye a la recepcionista con sueldoFijo=400000 y totalAPagar=400000

#### Scenario: Contador excluido
- GIVEN contador activo con sueldoFijo=600000
- WHEN GET /salones/:salonId/finanzas/nomina
- THEN la respuesta NO incluye al contador

#### Scenario: Dueña con configuración de pago incluida
- GIVEN dueña activa con sueldoFijo=2500000 y bonoHorario=0
- WHEN GET /salones/:salonId/finanzas/nomina
- THEN la respuesta incluye a la dueña con totalAPagar=2500000

#### Scenario: Dueña sin configuración ni registros excluida
- GIVEN dueña activa con sueldoFijo=0, bonoHorario=0 y 0 registros pendientes
- WHEN GET /salones/:salonId/finanzas/nomina
- THEN la respuesta NO incluye a la dueña

### Requirement: Empleada con solo sueldo fijo en pendientes

Un empleado con 0 registros pendientes pero sueldoFijo + bonoHorario > 0 MUST aparecer en pendientes con totalAPagar = sueldoFijo + bonoHorario (+ propinas si las hubiera). Un empleado con 0 registros y fijo + bono <= 0 MUST NOT aparecer.

#### Scenario: Solo sueldo fijo
- GIVEN manicurista con sueldoFijo=200000, bonoHorario=50000 y todos los registros ya pagados
- WHEN GET /salones/:salonId/finanzas/nomina
- THEN la respuesta incluye al empleado con totalComisiones=0, sueldoFijo=200000, bonoHorario=50000, totalAPagar=250000

#### Scenario: Sin sueldo ni registros
- GIVEN empleado con sueldoFijo=0, bonoHorario=0 y 0 registros pendientes
- WHEN GET /salones/:salonId/finanzas/nomina
- THEN el empleado NO aparece en la respuesta

### Requirement: Liquidación con 0 registros pendientes

El sistema MUST permitir liquidar un empleado con 0 registros pendientes cuando sueldoFijo + bonoHorario > 0. La liquidación MUST registrar totalComisiones=0, totalPropinas=0, sueldoFijo, bonoHorario y totalPagado correspondiente.

#### Scenario: Liquidar solo sueldo fijo
- GIVEN empleado con sueldoFijo=200000, bonoHorario=50000 y 0 registros pendientes en el período
- WHEN POST /salones/:salonId/finanzas/nomina/liquidar
- THEN respuesta MUST ser 201 con sueldoFijo=200000, bonoHorario=50000 y totalPagado=250000

#### Scenario: Sin montos liquidables
- GIVEN empleado con sueldoFijo=0, bonoHorario=0 y 0 registros pendientes
- WHEN POST /salones/:salonId/finanzas/nomina/liquidar
- THEN respuesta MUST ser 4xx con mensaje de error (sin montos pendientes)

### Requirement: Guard anti-doble-pago de sueldo fijo

El sueldo fijo MUST NOT pagarse dos veces en el mismo período. Si el empleado ya fue liquidado en el período y no hay registros nuevos desde entonces, la liquidación MUST ser rechazada (skip en pendientes / error al liquidar).

#### Scenario: Ya liquidada en el período
- GIVEN empleado con sueldoFijo=200000 ya liquidado este mes y 0 registros nuevos desde esa liquidación
- WHEN POST /salones/:salonId/finanzas/nomina/liquidar
- THEN respuesta MUST ser 409/422 indicando que ya fue liquidada en el período

#### Scenario: Pendientes la excluyen tras liquidar
- GIVEN empleada liquidada este mes (sueldo fijo pagado) y 0 registros nuevos
- WHEN GET /salones/:salonId/finanzas/nomina
- THEN la empleada NO aparece en pendientes

### Requirement: Formulario de empleada — modo MIXTO

El formulario de empleada (crear/editar) MUST soportar un modo de pago MIXTO donde sueldoFijo y porcentajeComisionServicio se guardan simultáneamente. Los modos exclusivos COMISION y FIJO SHALL anular el campo no seleccionado.

#### Scenario: Guardar modo MIXTO
- GIVEN el usuario selecciona MIXTO con sueldoFijo=1200000 y porcentaje=30
- WHEN guarda la empleada
- THEN el payload incluye sueldoFijo=1200000 Y porcentajeComisionServicio=30

#### Scenario: Modo exclusivo anula el otro campo
- GIVEN el usuario selecciona COMISION con porcentaje=40
- WHEN guarda la empleada
- THEN el payload incluye porcentajeComisionServicio=40 Y sueldoFijo=0

#### Scenario: Edición de empleada MIXTO existente
- GIVEN empleada con sueldoFijo>0 y porcentaje>0
- WHEN se abre el modal de edición
- THEN el modo seleccionado es MIXTO y ambos campos aparecen precargados
