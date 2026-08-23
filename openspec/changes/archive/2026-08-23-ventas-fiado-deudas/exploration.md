# Exploration: ventas-fiado-deudas

Venta de servicios y productos con pago parcial o diferido (fiado). El salón
asume la deuda: la empleada cobra su comisión como si la venta se hubiera
cobrado completa. Se requiere una sección de deudas de clientes con flujo de
cobro (abono).

Estado: EXPLORACIÓN — sin cambios de código.

---

## 1. Estado actual por área

### 1.1 Creación de registro (backend) — PARCIALMENTE LISTO

- `packages/validation/src/finanzas.schema.ts:5-9,33` — `createRegistroSchema`
  acepta `pagos: [{ monto, metodoPago, referencia }]` (array, montos arbitrarios,
  múltiples métodos). NO existe campo `montoPendiente` de entrada (se computa) y
  NO se valida `Σ pagos == valorFinal` → el contrato API ya acepta pago parcial.
- `apps/api/.../registro/CreateRegistroUseCase.ts:101-110` —
  `totalPagado = Σ pagos.monto`; `montoPendiente = calcularMontoPendiente(valorFinal, propina, totalPagado)` (floor ≥ 0).
  - Fiado total (pagos: [] o monto 0) → `montoPendiente = valorFinal − propina`. **Funciona.**
  - Pago parcial ($60k de $100k) → `montoPendiente = $40k`. **Funciona.**
  - Pago completo → 0. **Funciona.**
- `CreateRegistroUseCase.ts:52` — `verificarCajaAbierta` corre SIEMPRE, incluso
  con pago $0 → el registro fiado igual se liga a `cajaId`. El arqueo solo cuenta
  pagos reales, así que no infla el efectivo esperado (ver 1.4).
- `CreateRegistroUseCase.ts:189` — incrementa `cliente.deudaTotal` en
  `montoPendiente` (columna desnormalizada, ver riesgo R2).
- `CreateRegistroUseCase.ts:95-99` — `calcularComision` sobre el valor COMPLETO
  (ajustado por descuento), NO sobre lo cobrado → la empleada cobra como si se
  hubiera cobrado todo. **Requisito del dueño ya cumplido en backend.**

### 1.2 Formularios frontend — BLOQUEAN pago parcial y fiado

- `apps/pos-dashboard/src/components/WalkInModal.tsx:288` —
  `canSubmit` exige `montoRecibido >= finalTotal` para EFECTIVO → **pago parcial
  bloqueado**. Payload `pagos: [{ monto: montoRecibido | finalTotal }]` (línea
  464-470). Sin opción "Fiado".
- `apps/pos-dashboard/src/pages/VentasPage.tsx:216` — misma guarda (flujo solo
  productos). Bloqueado igual.
- `apps/pos-dashboard/src/pages/AgendaPage.tsx:630` — completar cita envía
  `pagos: [{ monto: finalTotal, ... }]` SIEMPRE completo; `montoRecibido` es solo
  cosmético (cambio, línea 2950). Sin fiado.
- Resumen: el backend soporta parcial/fiado, la UI lo impide en los 3 flujos.

### 1.3 Pago a empleadas — CORRECTO (requisito cumplido)

- `NominaPendienteUseCase.ts:176-179` — `totalComisionesPendientes = Σ comisionCalculada` (valor completo).
- `LiquidarEmpleadaUseCase.ts:104-107` — idem. La empleada NO es penalizada por fiado.
- ⚠️ `CierreTurnoUseCase.ts:52-58` (reporte por empleada/día, `GET /finanzas/turno/:id`):
  `totalAEntregar = montoTotal − comision − propina` usa el monto TOTAL. Con pago
  parcial el empleado "debe entregar" más de lo cobrado. Discrepancia a corregir
  o documentar cuando el fiado esté vivo.

### 1.4 Arqueo de caja — CORRECTO en venta, ROTO para abonos posteriores

- `calcularReporteCierre.ts:81-96` — `porMetodoPago` suma SOLO `r.pagos` (pagos reales);
  `montoEsperado = montoInicial + EFECTIVO pagos − gastos EFECTIVO`. Si el cliente
  pagó $60k de $100k, el esperado es $60k. **Arqueo correcto.**
- `calcularReporteCierre.ts:87` — `ingresosBrutos = Σ totalServicios + totalProductos`
  (valor completo). Se muestra en CajaTab como "Ingresos brutos" (CajaTab.tsx:1017):
  informativo, puede confundir (muestra $100k con $60k en cajón) — no es bug de arqueo.
- ⚠️ **CRÍTICO para abonos**: `PagoTransaccionEntity.ts` NO tiene `cajaId`. El arqueo
  deriva los pagos vía `registro.cajaId → pagos` (`ObtenerEsperadoCajaUseCase.ts:35`,
  `CerrarCajaUseCase`). Un abono registrado HOY como pago nuevo en un registro
  VIEJO contaría en el arqueo de la caja VIEJA (probablemente cerrada) en lugar de
  la caja de hoy. → requiere migración (cajaId en pagos_transaccion o entidad de abono).

### 1.5 Sección deudas — EXISTE (solo lectura), FALTA el cobro

- `CuentasCobrarUseCase.ts` — agrupa registros con `montoPendiente > 0` por cliente
  (deudaTotal, cantidadRegistros, antigüedad por buckets) MÁS préstamos ACTIVOS.
  Incluye deuda de servicios Y productos (montoPendiente cubre toda la venta).
  Documentado como v1 SOLO LECTURA, sin flujo de cobro (comentario líneas 29-34).
  Ojo: el comentario "(a) las devoluciones NO reducen montoPendiente" está **obsoleto** —
  `CreateDevolucionUseCase.ts:88-99` SÍ resta `min(montoDevolucion, montoPendiente)`
  del registro y del cliente en la misma transacción.
- Frontend: `FinanzasPage.tsx:4625-4683` — sub-tab "Por cobrar": tabla
  Cliente/Préstamo, Tipo, Deuda total, Registros, Antigüedad. **Sin columna de
  acciones, sin abonar.** Test lo explicita (FinanzasPage.test.tsx:631-637).
- `ClientesPage.tsx:996-1003` — perfil del cliente muestra `cliente.deudaTotal`
  (desnormalizada; puede divergir del recomputado de CuentasCobrar — ver R2).
- Rutas: `finanzas.routes.ts:84-93` — solo GET /finanzas/cuentas/cobrar y /pagar.
  `RegistroController` solo GET/POST/DELETE. **No existe endpoint de abono.**

### 1.6 Reportes

- `PyLMensualUseCase.ts:114-115` y `ResumenDiaUseCase.ts:102-126` — ingresos a valor
  COMPLETO (neto tras descuento, no tras cobro). Defendible: el salón asume la deuda
  (devengo en venta) y paga comisión completa. No hay mecanismo de incobrables
  (deuda que nunca se cobra queda como ingreso). Consideración de diseño, no bug.
- `ExcelExportService.ts:134` — movimientos sin columna `montoPendiente` (nice-to-have).

---

## 2. Hallazgos CRÍTICOS

1. **Abono sin caja**: sin `cajaId` en `pagos_transaccion`, un abono posterior no
   entra en el arqueo de la caja donde se recibe el dinero (cae en la caja del
   registro original). Requiere migración + ajuste del reporte de cierre.
2. **Anulación de registro con pago parcial** (preexistente, amplificado por fiado):
   `AnularRegistroUseCase` deja los pagos en la tabla pero `calcularReporteCierre:66`
   excluye registros ANULADOS → el efectivo ya recibido desaparece del esperado de esa
   caja (sobra en el arqueo). Vale evaluar en diseño.
3. **UI bloquea parcial/fiado** en los 3 flujos (1.2) — el gap principal de venta.
4. **CierreTurnoUseCase.totalAEntregar** usa montoTotal completo, no lo cobrado.

---

## 3. Alcance estimado

**Backend** (~450-550 líneas con tests):
- Migración: `cajaId` en `pagos_transaccion` (o tabla de abonos).
- `AbonarDeudaUseCase` (valida registro no ANULADO, monto ≤ montoPendiente, crea
  PagoTransaccion, decrementa montoPendiente y cliente.deudaTotal, liga a caja de hoy).
- Ruta `POST /salones/:id/registros/:id/pagos` + schema de validación + controller.
- Ajuste `calcularReporteCierre` para contar pagos por su cajaId.
- Fix/decisión `CierreTurnoUseCase.totalAEntregar` (monto cobrado).
- Actualizar comentarios obsoletos (CuentasCobrarUseCase:29).

**Frontend** (~500-700 líneas con tests):
- WalkInModal + VentasPage + AgendaPage: toggle "Fiado", monto a pagar editable
  para todos los métodos, display "queda $X pend.", relajar guarda `canSubmit`.
- CuentasTab: columna de acciones + modal de abono (monto + método) + refresh.
- (Opcional) detalle por cliente: registros que componen la deuda.

**Total**: ~1.000-1.300 líneas + tests. **3 PRs encadenados** (backend / venta / deudas)
o 2 (backend / frontend completo).

---

## 4. Tests existentes

Cubren el estado actual (sin fiado):
- `ComisionService.test.ts:67-89` — calcularMontoPendiente (pago completo, parcial, propina, exceso).
- `CreateRegistroUseCase.test.ts:474-540` — montoPendiente con descuento: pago total → 0; parcial 50k/90k → 40k. **Prueban que el backend ya soporta parcial.**
- `finanzas.schema.test.ts` — schema de pagos.
- `CuentasCobrarUseCase.test.ts` (10+) — agregación por cliente, buckets, préstamos, paginación.
- `CuentasController.test.ts` — GET read-only.
- `AnularRegistroUseCase.test.ts:77-105` — deuda decrementada al anular.
- `CreateDevolucionUseCase.test.ts:120-161` — deuda/montoPendiente decrementados.
- `calculoReporteCierre.test.ts` — arqueo por método de pago.
- Frontend: `WalkInModal.test.tsx`, `VentasPage.test.tsx` (cobro completo),
  `AgendaPage.test.tsx:454-524` (pago en completar cita), `FinanzasPage.test.tsx:528-719`
  (cuentas; **el test :631 "NO muestra botones de cobro" se debe reescribir**).

**Se rompen/actualizan**: FinanzasPage.test.tsx:631-637 (read-only → acciones),
tests de WalkInModal/VentasPage/AgendaPage si cambia el payload de pagos,
ExcelExportService.test.ts si se agrega columna pendiente. Los tests de backend de
creación/cuentas NO se rompen (el contrato no cambia).

---

## 5. Enfoque recomendado

| Delta | Recomendación |
|---|---|
| Pago parcial en venta | Backend listo; UI: monto editable para todos los métodos + "queda pendiente". Toggle "Fiado" (pago $0 → `pagos: []`). |
| Abono posterior | Nuevo `AbonarDeudaUseCase` + migración `cajaId` en pagos_transaccion + ruta POST. Patrón conservador `min(abono, montoPendiente)` (mismo que devoluciones). |
| Sección deudas | Base sólida en "Por cobrar". Agregar acción "Cobrar/Abonar" + modal + detalle por registro (opcional). Evaluar separar préstamos. |
| Comisión empleada | Sin cambios (ya paga completo). |
| Arqueo caja | Correcto para venta; corregir abonos con la migración; evaluar anulación + pagos. |
| Reportes | Devengo en venta = correcto. Opcional: columna pendiente en export. |

**Orden**: PR1 backend (abono + cajaId + arqueo), PR2 frontend venta (fiado/parcial),
PR3 frontend deudas (abonar). TDD estricto (config del proyecto).

---

## 6. Riesgos

- R1: Arqueo incorrecto si el abono no se liga a la caja donde se recibe (requiere la migración).
- R2: `cliente.deudaTotal` desnormalizada puede divergir del recomputado (ya visible en dev: clientes con deuda y 0 registros). Definir fuente de verdad para la UI de Clientes.
- R3: Interacción abono ↔ devolución ↔ anulación: mantener el patrón conservador `min()` y actualizar el comentario obsoleto de CuentasCobrarUseCase.
- R4: Confusión visual "Ingresos brutos" de caja con fiado (valor completo vs cajón real) — aclarar en UI.

## Ready for Proposal
Sí. Backend de venta listo (parcial/fiado), faltan: UI de venta, abono (endpoint +
migración cajaId), acciones en "Por cobrar". 3 PRs encadenados recomendados.
