# Reportes — Specification

## Purpose

Daily financial summaries, monthly ROI calculations, and per-employee shift closeouts. All reports are read-only queries.

## ADDED Requirements

### Requirement: GET Resumen del Día

The system MUST return daily totals: sum of `totalServicios`, `totalProductos`, `propina`, `comisionCalculada`, and count of registros for a given `fecha` and `salonId`. Gastos operativos MUST be included as a deduction. Devoluciones are NOT applied here — they are deducted in the P&L report (see "Devoluciones como deducción explícita").

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

### Requirement: GET P&L Mensual

The system MUST return, for `GET /salones/:salonId/finanzas/pyl?desde=&hasta=&usuarioId=`, a period P&L with: `ingresosBrutos`, `descuentos`, `ingresosNetos`, `totalServicios`, `totalProductos`, `propinas`, `costoBaseInsumos`, `margenBruto`, `comisiones`, `gastosFijos`, `gastosOperativos`, `gastosPorCategoria`, `totalGastos`, `devoluciones`, `utilidadNeta`, `cantidadAtenciones`. Registros `ANULADO` MUST be excluded. `desde`/`hasta` are inclusive Colombia dates (05:00 UTC).

#### Scenario: P&L with all factors
- GIVEN period has 3 registros: brutos servicios=300000/productos=50000, descuento 10%, propinas=15000, comisiones=48000, insumos=60000; gastos fijos=200000, operativos=80000; devolución=20000
- WHEN GET /salones/1/finanzas/pyl?desde=2026-05-01&hasta=2026-05-31
- THEN ingresosBrutos=350000, ingresosNetos=315000, descuentos=35000, devoluciones=20000, utilidadNeta=-93000

#### Scenario: P&L empty period
- GIVEN no registros, gastos, or devoluciones in range
- WHEN GET /finanzas/pyl with valid empty range
- THEN all totals MUST be 0 AND cantidadAtenciones MUST be 0

### Requirement: Fórmula de utilidad neta

The system MUST compute `utilidadNeta = ingresosNetos − costoBaseInsumos − comisiones − totalGastos − devoluciones`. Propinas MUST NOT be deducted (pass-through). No nómina deduction — comisiones represent labor cost.

#### Scenario: Math check
- GIVEN ingresosNetos=315000, insumos=60000, comisiones=48000, gastos=280000, devoluciones=20000
- WHEN P&L is computed
- THEN utilidadNeta MUST be −93000

### Requirement: Devoluciones como deducción explícita

The system MUST sum `montoDevolucion` of devoluciones created within the period and subtract it as an explicit line. This implements the legacy "devoluciones MUST reduce" clause — for the P&L only, without altering `ResumenDiaUseCase`.

#### Scenario: Devolución reduces net
- GIVEN one devolución of 20000 in range
- WHEN P&L is computed
- THEN `devoluciones` MUST be 20000 AND utilidadNeta reduced by that amount

### Requirement: Filtro por usuario en reportes P&L

The system MUST apply the resumen-dia role rule: privileged roles (SUPERADMIN, DUEÑA, ADMINISTRADOR, CONTADOR) MAY filter by `usuarioId`; restricted roles MUST be forced to their own `usuarioId`. Applies to both `pyl` and `exportar`.

#### Scenario: Privileged filters by empleada
- GIVEN requester rol DUEÑA passes `usuarioId=5`
- WHEN GET /finanzas/pyl?usuarioId=5
- THEN P&L MUST use usuarioId=5

#### Scenario: Restricted role forced to self
- GIVEN requester rol MANICURISTA (id=4) passes `usuarioId=99`
- WHEN GET /finanzas/pyl?usuarioId=99
- THEN P&L MUST use usuarioId=4 and ignore 99

### Requirement: Export P&L a Excel

The system MUST serve `GET /salones/:salonId/finanzas/exportar?desde=&hasta=&usuarioId=` returning HTTP 200 with `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` and `Content-Disposition: attachment; filename="pyl_<desde>_<hasta>.xlsx"`. The workbook MUST contain a "P&L" sheet (same fields as pyl) and a "Movimientos" sheet (fecha, cliente, empleada, servicios, productos, propina, comisión, valor final). Same role rule as pyl.

#### Scenario: Download headers
- GIVEN a valid range
- WHEN GET /finanzas/exportar
- THEN response MUST carry the xlsx content-type and attachment disposition

#### Scenario: Empty period export
- GIVEN no data in range
- WHEN GET /finanzas/exportar
- THEN a workbook with both sheets (zeros) MUST still be returned

### Requirement: ReportesTab P&L y export

The dashboard ReportesTab MUST send both `desde` and `hasta` (not only `fecha`), MAY send `usuarioId`, MUST render P&L cards from API values (no client-side recomputation), and MUST provide an Export button downloading the blob.

#### Scenario: Both dates sent
- GIVEN ReportesTab with desde=2026-05-01 and hasta=2026-05-31
- WHEN Generar reporte is clicked
- THEN request MUST include both params and render API P&L values

#### Scenario: Export click
- GIVEN a P&L is loaded
- WHEN Export button is clicked
- THEN a blob download of the xlsx MUST start
