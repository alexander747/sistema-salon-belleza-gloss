# Reportes — Specification

## Purpose

Daily financial summaries, monthly ROI calculations, and per-employee shift closeouts. All reports are read-only queries.

## ADDED Requirements

### Requirement: GET Resumen del Día

The system MUST return daily totals: sum of `totalServicios`, `totalProductos`, `propina`, `comisionCalculada`, and count of registros for a given `fecha` and `salonId`. Devoluciones MUST reduce the day's product totals. Gastos operativos MUST be included as a deduction.

#### Scenario: Resumen con datos
- GIVEN the day has 3 registros: servicios=100000, productos=30000, propinas=15000, comisiones=48000, and a gasto operativo=10000
- WHEN GET /api/salones/:salonId/reportes/resumen-dia?fecha=2026-05-15
- THEN response MUST show totalServicios=100000, totalProductos=30000, totalPropinas=15000, totalComisiones=48000, cantidadAtenciones=3, gastosOperativos=10000

#### Scenario: Resumen día vacío
- GIVEN no registros or gastos exist for the date
- WHEN GET /api/salones/:salonId/reportes/resumen-dia
- THEN all totals MUST be 0 AND cantidadAtenciones MUST be 0

### Requirement: GET ROI Mensual

The system MUST calculate: `ingresos (totalServicios + totalProductos) - gastosFijos - nominaTotal` for a given month. Both month and year query parameters are required.

#### Scenario: ROI with all factors
- GIVEN month has servicios=3000000, productos=500000, gastosFijos=800000, nominaTotal=1200000
- WHEN GET /api/salones/:salonId/reportes/roi-mensual?mes=5&anio=2026
- THEN roi MUST be 1500000 (3500000 - 800000 - 1200000)

#### Scenario: ROI with no data
- GIVEN no registros, gastos, or liquidaciones exist for the month
- WHEN GET /api/salones/:salonId/reportes/roi-mensual
- THEN roi MUST be 0

### Requirement: GET Cierre de Turno

The system MUST return an employee-specific daily summary including: total services, total products, total commission earned, total tips, and `efectivoAEntregar = totalCobrado - comisionCalculada - propina` for the employee.

#### Scenario: Cierre turno with data
- GIVEN empleado had 2 registros today: cobrado total=90000, comisionCalculada=36000, propina=10000
- WHEN GET /api/salones/:salonId/reportes/cierre-turno?usuarioId=:id&fecha=2026-05-15
- THEN efectivoAEntregar MUST be 44000 (90000 - 36000 - 10000)

#### Scenario: Cierre turno vacío
- GIVEN empleado has no registros today
- WHEN GET /api/salones/:salonId/reportes/cierre-turno
- THEN all values MUST be 0 AND efectivoAEntregar MUST be 0
