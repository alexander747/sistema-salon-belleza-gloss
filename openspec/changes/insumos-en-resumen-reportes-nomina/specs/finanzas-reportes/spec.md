# Delta for Reportes

## ADDED Requirements

### Requirement: Insumo del resumen condicionado al rol

El sistema MUST omitir las propiedades `totalCostoBaseInsumos` y `balanceNeto` de la respuesta de
`GET /api/salones/:salonId/finanzas/resumen` cuando el rol del solicitante NO es privilegiado
(SUPERADMIN, DUEÑA, ADMINISTRADOR, CONTADOR). Se omiten ambas claves porque
`balanceNeto = totalIngresos − totalGastos − totalComisiones − totalCostoBaseInsumos`, de modo que
exponer `balanceNeto` permitiría derivar el costo de insumos. La omisión MUST ser de la clave
(ausente), NO `null` ni `0`, y MUST aplicarse solo en la serialización HTTP: el caso de uso sigue
calculando ambos valores. Para roles privilegiados ambas claves MUST estar presentes con el valor
calculado. Los campos SHALL ser opcionales en el tipo de respuesta HTTP
(`totalCostoBaseInsumos?: number`, `balanceNeto?: number`) para no romper consumidores existentes.
El cómputo MUST excluir registros `ANULADO` y sumar `Math.round(Σ serviciosItems[].costoBaseInsumos)`.

#### Scenario: Rol privilegiado recibe el insumo

- GIVEN un rango con registros cuyos serviciosItems suman costoBaseInsumos=84000
- WHEN GET /api/salones/1/finanzas/resumen como DUEÑA
- THEN la respuesta contiene `totalCostoBaseInsumos`=84000 AND `balanceNeto` con el valor calculado

#### Scenario: Rol no privilegiado no recibe la clave

- GIVEN el mismo rango
- WHEN GET /api/salones/1/finanzas/resumen como MANICURISTA
- THEN la respuesta NO tiene la propiedad `totalCostoBaseInsumos` (ausente, ni `null` ni `0`)
- AND la respuesta NO tiene la propiedad `balanceNeto` (ausente, ni `null` ni `0`)
- AND el resto de las métricas de Registros (comisiones, ingresos, cobrado) sigue presente

#### Scenario: Sin registros ni items muestra 0

- GIVEN un rango sin registros, o con registros sin `serviciosItems`
- WHEN GET /finanzas/resumen como DUEÑA
- THEN `totalCostoBaseInsumos`=0

#### Scenario: Registro ANULADO no aporta insumo

- GIVEN un rango con un registro `ANULADO` cuyos items suman 84000
- WHEN GET /finanzas/resumen como DUEÑA
- THEN `totalCostoBaseInsumos`=0

### Requirement: Invariante de balance neto del resumen

El sistema MUST calcular `balanceNeto = totalIngresos − totalGastos − totalComisiones − totalCostoBaseInsumos`.
`totalGastos` NO se filtra por empleada/cliente (el gasto pertenece al salón). El insumo se resta sin
ajuste por descuento. El cómputo MUST ser siempre con el insumo real; sin embargo, `balanceNeto` MUST
omitirse de la respuesta HTTP para roles no privilegiados (es una función del costo de insumos —
ver "Insumo del resumen condicionado al rol").

#### Scenario: Fixture real lucía (2026-09-04..2026-09-29)

- GIVEN registros de lucía en el rango con totalIngresos=555000, totalComisiones=267600, totalCostoBaseInsumos=84000 y sin gastos
- WHEN GET /finanzas/resumen?desde=2026-09-04&hasta=2026-09-29
- THEN `totalCobrado`=555000 AND `totalCostoBaseInsumos`=84000 AND `balanceNeto`=203400

#### Scenario: Balance sin insumos

- GIVEN totalIngresos=100000, totalGastos=10000, totalComisiones=30000, totalCostoBaseInsumos=0
- WHEN se calcula el resumen
- THEN `balanceNeto`=60000

### Requirement: ReportesTab — tarjeta Insumos solo para roles privilegiados

El dashboard ReportesTab MUST renderizar la tarjeta "📦 Insumos" del P&L SOLO cuando el usuario es
privilegiado (SUPERADMIN, DUEÑA, ADMINISTRADOR, CONTADOR) según el helper compartido
`isPrivilegedRole(user)`. Roles no privilegiados MUST NOT ver la tarjeta, aunque la API les omita el
campo.

#### Scenario: Dueña ve la tarjeta Insumos

- GIVEN user.rol=DUEÑA y un P&L con costoBaseInsumos=84000
- WHEN se renderiza ReportesTab
- THEN la tarjeta "📦 Insumos" muestra $84000

#### Scenario: Rol no privilegiado no ve la tarjeta

- GIVEN user.rol=MANICURISTA abriendo ReportesTab
- WHEN se renderiza el P&L
- THEN la tarjeta "📦 Insumos" NO está en el DOM

## MODIFIED Requirements

### Requirement: GET P&L Mensual

The system MUST return, for `GET /salones/:salonId/finanzas/pyl?desde=&hasta=&usuarioId=`, a period P&L with: `ingresosBrutos`, `descuentos`, `ingresosNetos`, `totalServicios`, `totalProductos`, `propinas`, `costoBaseInsumos`, `margenBruto`, `comisiones`, `gastosFijos`, `gastosOperativos`, `gastosPorCategoria`, `totalGastos`, `devoluciones`, `utilidadNeta`, `cantidadAtenciones`. Registros `ANULADO` MUST be excluded. `desde`/`hasta` are inclusive Colombia dates (05:00 UTC). El endpoint MUST estar protegido por `requireRole(SUPERADMIN, DUEÑA, ADMINISTRADOR, CONTADOR)` — la pestaña Reportes es solo para esos roles (decisión del owner). Un rol no privilegiado MUST recibir `403` y MUST NOT ejecutar el caso de uso. Como solo los roles privilegiados pueden acceder, la respuesta completa (con `costoBaseInsumos`, `margenBruto`, `utilidadNeta`) es la única forma de respuesta y NO se omiten columnas ni claves.
(Previously: `costoBaseInsumos` was always returned to every role, and any role could call the endpoint.)

#### Scenario: P&L with all factors

- GIVEN period has 3 registros: brutos servicios=300000/productos=50000, descuento 10%, propinas=15000, comisiones=48000, insumos=60000; gastos fijos=200000, operativos=80000; devolución=20000
- WHEN GET /salones/1/finanzas/pyl?desde=2026-05-01&hasta=2026-05-31
- THEN ingresosBrutos=350000, ingresosNetos=315000, descuentos=35000, devoluciones=20000, utilidadNeta=-93000

#### Scenario: P&L empty period

- GIVEN no registros, gastos, o devoluciones in range
- WHEN GET /finanzas/pyl with valid empty range
- THEN all totals MUST be 0 AND cantidadAtenciones MUST be 0

#### Scenario: Rol privilegiado recibe costoBaseInsumos

- GIVEN un P&L con costoBaseInsumos=84000
- WHEN GET /finanzas/pyl como ADMINISTRADOR
- THEN la respuesta contiene `costoBaseInsumos`=84000

#### Scenario: Rol no privilegiado recibe 403

- GIVEN el mismo P&L
- WHEN GET /finanzas/pyl como MANICURISTA
- THEN la respuesta es `403` con código FORBIDDEN / detalle INSUFFICIENT_ROLE
- AND el caso de uso NO se ejecuta

#### Scenario: Período sin insumos

- GIVEN registros sin `serviciosItems` con costo
- WHEN GET /finanzas/pyl como DUEÑA
- THEN `costoBaseInsumos`=0

### Requirement: Exportación Excel solo para roles privilegiados

`GET /salones/:salonId/finanzas/exportar` MUST estar protegido por
`requireRole(SUPERADMIN, DUEÑA, ADMINISTRADOR, CONTADOR)`. Un rol no privilegiado MUST recibir `403`
con código FORBIDDEN / detalle INSUFFICIENT_ROLE y MUST NOT ejecutar el servicio de exportación.
NO se recortan filas del workbook por rol (el P&L ya es solo privilegiado).

#### Scenario: Rol privilegiado descarga el xlsx

- GIVEN un usuario CONTADOR con una caja/reporte disponible
- WHEN GET /finanzas/exportar
- THEN la respuesta es `200` con el archivo xlsx

#### Scenario: Rol no privilegiado recibe 403

- GIVEN un usuario RECEPCIONISTA
- WHEN GET /finanzas/exportar
- THEN la respuesta es `403` con código FORBIDDEN / detalle INSUFFICIENT_ROLE
- AND el servicio de exportación NO se ejecuta
