# Archive Report — ventas-fiado-deudas

**Fecha**: 2026-08-23
**Branch**: main (HEAD `49a6e72`)

## Intención

El dueño pidió soporte para ventas con pago parcial o fiado: un servicio de $100.000 puede pagarse todo, parte ($60.000 → debe $40.000) o nada (fiado total → debe $100.000), para servicios y productos. El salón asume la deuda (le paga al empleado la comisión completa como si se hubiera cobrado todo). **Decisión contable del dueño: el ingreso se cuenta cuando se cobra (base caja)**, y el informe debe mostrar lo fiado / deudas por cobrar a clientes. La propina NUNCA se fía (voluntaria; si no se da es 0 y se muestra como tal).

## Qué cambió (4 PRs stacked-to-main)

### PR1 — Backend abonos (commits 89e5ef8..bf2322a)
- `PagoTransaccionEntity` + `cajaId` (FK nullable → Caja, ON DELETE SET NULL); `MetodoPago` extraído a módulo propio (rompía ciclo de entidades).
- `AbonarDeudaUseCase` + `POST /salones/:salonId/registros/:id/pagos`: valida registro no ANULADO (422), abono ≤ montoPendiente (409 MONTO_EXCEDE_PENDIENTE), caja de HOY abierta (422 CAJA_CERRADA); crea pago con cajaId = caja de hoy; decrementa `montoPendiente` + `cliente.deudaTotal` (floor 0).
- `CreateRegistroUseCase`: los pagos creados en la venta llevan `cajaId` = caja del registro.
- Arqueo por caja: `findByCajaConFallback(cajaId)` = `p.cajaId = C` OR (`p.cajaId IS NULL AND r.cajaId = C AND r.estado != ANULADO`) — cada pago en UNA sola caja, sin doble conteo; `calcularReporteCierre` recibe `pagosExtra`.
- CuentasCobrar: filas CLIENTE con `registros[]` (desglose por registro); préstamos `registros: null`.
- Script backfill `pagos.cajaId` (idempotente); se ejecutó en E2E (4/4 pagos con caja).

### PR2 — Backend reportes cash-basis (ac1fd54..4decd0a)
- Repo: `sumPagosPorPeriodo` (Σ pagos por fecha de recepción, excluye ANULADO), `sumMontoPendientePorPeriodo` (fiado del período), `sumMontoPendienteHasta` (deudas acumuladas).
- P&L: +`cobrado`, +`fiadoPeriodo`, +`deudasPorCobrar`; `utilidadNeta = cobrado − insumos − comisiones − gastos − devoluciones`. Líneas devengadas (`ingresosBrutos`, `totalServicios`, etc.) quedan informativas.
- Resumen: +`totalCobrado`, +`totalFiadoDia`. ROI: `ingresos` = cobrado del mes.
- `CierreTurnoUseCase.totalAEntregar` = Σ pagos cobrados − comisionGanada − propinas (base caja; la spec ya lo decía, la impl usaba montoTotal — bug alineado).
- Excel: filas Cobrado/Fiado/Deudas + columna Pendiente.

### PR3 — Frontend venta fiado/parcial (7f6c9c9..356b093)
- Helper `calcularPendiente(finalTotal, propina, montoPagado)` = `max(0, finalTotal − propina − montoPagado)`.
- WalkInModal, VentasPage, AgendaPage (completar cita): toggle "Fiado — la clienta paga después" + input "Monto a cobrar" editable (default 0) + "Queda pendiente: $X" + payload `pagos: [{monto}]` (0/parcial). Contado intacto. Propina nunca en la deuda.

### PR4 — Frontend deudas (e1e097f..49a6e72)
- Cuentas → Por cobrar: columna Acciones con botón "Cobrar/Abonar" (solo CLIENTE; PRESTAMO read-only); modal con desglose de registros (select, default el más antiguo), monto (default pendiente del registro), método de pago, POST `/registros/:id/pagos`, errores en el modal, éxito → banner + refresh.
- Cards cash: RegistrosTab +`Cobrado`/`Fiado del período`; P&L +`Cobrado`/`Fiado del período`/`Deudas por cobrar`.

## Verificación

- API: 492/492 tests. Dashboard: 304/305 (1 fallo = flake pre-existente AgendaPage C3, pasa aislado 24/24).
- tsc API: solo 3 errores pre-existentes (seed.ts:238, CreateRegistroUseCase.test.ts:94, RegistroServicioItemDTO.test.ts:3). tsc dashboard: 0.
- E2E real (curl + UI): venta fiada 100.000 (pago 0) → `montoPendiente=100000`, comisión completa 50.000; P&L 20/08: `cobrado 0`, `fiadoPeriodo 100000`, `deudasPorCobrar 100000`; caja 20/08 arqueo EFECTIVO 0 (el fiado no infla la caja); abono 40.000 con caja de hoy → `montoPendiente 60000`, P&L hoy `cobrado 120000`; Cuentas por cobrar muestra María García López con desglose 100.000 + 60.000 y botón Cobrar/Abonar funcional en UI.
- Datos de prueba E2E limpiados (registros 68/69, cajas 9/10; backfill de pagos legacy aplicado).

## Rollback

`git revert` de los commits de los 4 PRs en orden inverso (49a6e72..89e5ef8), o revert del merge a main.

## Riesgos residuales

1. **Anulación con pago parcial**: anular un registro con pagos deja los pagos huérfanos — el arqueo los excluye (registro ANULADO) y el efectivo ya recibido desaparece del esperado (limitación documentada en spec, fuera de scope).
2. **`cliente.deudaTotal` desnormalizada**: mantenida por Create/Abonar/Devolucion/Anular pero ya divergida en dev (clientes con deuda residual sin registros); hay dos fuentes de verdad.
3. **Asimetría de filtros**: `cobrado` filtra por empleada (usuarioId), `fiadoPeriodo`/`deudasPorCobrar` son a nivel salón.
4. **ROI conserva límites locales** (no UTC Colombia) en su rango de fechas — pre-existente.
5. **Flake AgendaPage C3** pre-existente bajo carga paralela (pasa aislado).
6. **P&L con propina**: `cobrado` incluye la propina pagada al momento (no se resta en utilidadNeta cash) — difiere del devengado que la excluye de ingresosNetos; documentado, seguido spec/design.
