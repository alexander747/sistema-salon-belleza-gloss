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
