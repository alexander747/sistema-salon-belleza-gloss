# Caja — Specification

## Purpose

Daily cash control per salon: one caja per salon per Colombia business day, opened with an initial float and closed with an arqueo (esperado vs real → diferencia). Golden rule: without an open caja, no sales and no completed citas. API-first for web, mobile, and n8n.

## Requirements

### Requirement: POST Abrir Caja

The system MUST create a caja when `POST /api/salones/:salonId/caja/abrir` is called with `montoInicial`. Only SUPERADMIN, DUEÑA, ADMINISTRADOR, and RECEPCIONISTA MAY open. The caja MUST be created with `fechaCaja = getColombiaDateString()`, `estado = ABIERTA`, and `aperturaPor = req.user.id`. `montoInicial` MUST be required and non-negative. At most one caja per salon and Colombia business day.

#### Scenario: Apertura exitosa
- GIVEN no caja exists for the salon on fechaCaja=2026-08-16
- WHEN POST /api/salones/:salonId/caja/abrir with {montoInicial: 50000} by a DUEÑA
- THEN response MUST be 201 with the caja: estado=ABIERTA, fechaCaja=2026-08-16, aperturaPor=req.user.id

#### Scenario: Caja ya abierta
- GIVEN an ABIERTA caja exists for the salon on 2026-08-16
- WHEN POST /api/salones/:salonId/caja/abrir
- THEN response MUST be 409 with error code CAJA_YA_ABIERTA

#### Scenario: Día ya cerrado
- GIVEN a CERRADA caja exists for the salon on 2026-08-16
- WHEN POST /api/salones/:salonId/caja/abrir
- THEN response MUST be 409 with error code CAJA_YA_CERRADA (one caja per business day; no reapertura)

### Requirement: Regla de Oro — Ventas

The system MUST reject `POST /api/salones/:salonId/registros` with 422 and code CAJA_CERRADA when no ABIERTA caja exists for the salon on the current Colombia business day. When a caja is open, the created registro MUST store the open caja's `cajaId`.

#### Scenario: Registro sin caja abierta
- GIVEN no ABIERTA caja for the salon today
- WHEN POST /api/salones/:salonId/registros with a valid payload
- THEN response MUST be 422 with error code CAJA_CERRADA AND no registro MUST be created

#### Scenario: Registro con caja abierta
- GIVEN an ABIERTA caja (id=5) for the salon today
- WHEN POST /api/salones/:salonId/registros with a valid payload
- THEN response MUST be 201 AND the registro MUST persist cajaId=5

### Requirement: Regla de Oro — Completar Cita

The system MUST reject completing a cita with 422 and code CAJA_CERRADA when no ABIERTA caja exists for the cita's salon on the current Colombia business day. This applies to `POST /api/salones/:salonId/agenda/citas/:id/completar` and to `PATCH /api/salones/:salonId/agenda/citas/:id/estado` when the target estado is COMPLETADA. The cita MUST remain in its previous estado.

#### Scenario: Completar sin caja abierta
- GIVEN a cita in estado CONFIRMADA and no ABIERTA caja for its salon today
- WHEN POST /api/salones/:salonId/agenda/citas/:id/completar
- THEN response MUST be 422 with error code CAJA_CERRADA AND the cita MUST remain CONFIRMADA

#### Scenario: Estado COMPLETADA sin caja abierta
- GIVEN a cita in estado CONFIRMADA and no ABIERTA caja for its salon today
- WHEN PATCH /api/salones/:salonId/agenda/citas/:id/estado with {estado: COMPLETADA}
- THEN response MUST be 422 with error code CAJA_CERRADA AND the cita MUST NOT be COMPLETADA

#### Scenario: Otros estados no bloqueados
- GIVEN no ABIERTA caja for the salon today and a cita in estado PENDIENTE
- WHEN PATCH /api/salones/:salonId/agenda/citas/:id/estado with {estado: CANCELADA}
- THEN response MUST be 200 AND the cita MUST be CANCELADA

### Requirement: POST Cerrar Caja

The system MUST close the salon's open caja when `POST /api/salones/:salonId/caja/cerrar` is called with `montoRealEfectivo`. Only SUPERADMIN, DUEÑA, ADMINISTRADOR, and RECEPCIONISTA MAY close. The caja MUST be ABIERTA (else 409 CAJA_YA_CERRADA). The system MUST compute `montoEsperado` at runtime from the caja's registros (pagos by metodoPago) and gastos, set `diferencia = montoRealEfectivo - montoEsperado`, and mark the caja CERRADA with `cierrePor = req.user.id` and `cierreEn`. Concurrent closes MUST NOT double-close (conditional update on estado=ABIERTA).

#### Scenario: Cierre exitoso
- GIVEN ABIERTA caja with pagos=180000 and gastos=20000; montoRealEfectivo=160000
- WHEN POST /api/salones/:salonId/caja/cerrar with {montoRealEfectivo: 160000}
- THEN montoEsperado MUST be 160000, diferencia MUST be 0, estado MUST be CERRADA AND the full report MUST be returned

#### Scenario: Cierre con diferencia
- GIVEN montoEsperado=180000 and montoRealEfectivo=175000
- WHEN POST /api/salones/:salonId/caja/cerrar
- THEN diferencia MUST be -5000 AND the report MUST include it

#### Scenario: Caja ya cerrada
- GIVEN the caja is already CERRADA
- WHEN POST /api/salones/:salonId/caja/cerrar
- THEN response MUST be 409 with error code CAJA_YA_CERRADA

#### Scenario: Cierre concurrente
- GIVEN two close requests for the same ABIERTA caja arrive simultaneously
- WHEN both call POST /api/salones/:salonId/caja/cerrar
- THEN exactly one MUST succeed AND the other MUST return 409 CAJA_YA_CERRADA

### Requirement: POST Reabrir Caja

The system MUST allow reopening the salon's caja for today when `POST /api/salones/:salonId/caja/reabrir` is called, IF today's caja is already CERRADA (e.g. closed for lunch, reopened in the afternoon). Only SUPERADMIN, DUEÑA, ADMINISTRADOR, and RECEPCIONISTA MAY reopen. The system MUST find today's caja (fecha_caja = getColombiaDateString()), set estado back to ABIERTA, and CLEAR the close data: montoEsperado, montoRealEfectivo, diferencia, cierrePorId, cierreEn. It MUST NOT create a new caja — the SAME caja is reopened (one caja per day is preserved). The close data from the previous (interim) close is replaced by the final close at end of day.

#### Scenario: Reabrir caja cerrada hoy
- GIVEN today's caja (id=5) is CERRADA with montoEsperado=60000, montoRealEfectivo=60000, diferencia=0, cierrePorId=2, cierreEn set
- WHEN POST /api/salones/:salonId/caja/reabrir
- THEN response MUST be 200 with the caja in estado ABIERTA, montoEsperado=NULL, montoRealEfectivo=NULL, diferencia=NULL, cierrePorId=NULL, cierreEn=NULL AND no new caja row created (caja id stays 5)

#### Scenario: Reabrir cuando ya está abierta
- GIVEN today's caja is ABIERTA
- WHEN POST /api/salones/:salonId/caja/reabrir
- THEN response MUST be 409 with error code CAJA_YA_ABIERTA

#### Scenario: Reabrir sin caja de hoy
- GIVEN no caja exists for today (fecha_caja)
- WHEN POST /api/salones/:salonId/caja/reabrir
- THEN response MUST be 404 with error code CAJA_NO_ABIERTA

### Requirement: Reporte de Cierre

The close report MUST include: total servicios, total productos, ingresos brutos, descuentos, ingresos netos, breakdown by metodoPago (EFECTIVO, TARJETA, TRANSFERENCIA), comisiones, total gastos, montoEsperado, montoReal, diferencia, and cantidad de movimientos (registros + gastos).

#### Scenario: Reporte completo
- GIVEN caja with montoInicial=50000 and 3 registros: servicios=240000, productos=60000, descuentos=10000, comisiones=96000, pagos EFECTIVO=200000 + TARJETA=90000; and 2 gastos=30000 (EFECTIVO)
- WHEN the caja is closed
- THEN report MUST show ingresosBrutos=300000, descuentos=10000, ingresosNetos=290000, porMetodoPago={EFECTIVO:200000, TARJETA:90000}, comisiones=96000, gastos=30000, montoEsperado=220000, cantidadMovimientos=5

> **Nota (decisión owner)**: el arqueo audita SOLO efectivo y el cajero cuenta el cajón COMPLETO al cerrar (incluye el fondo inicial). `montoEsperado = montoInicial + Σ pagos EFECTIVO − Σ gastos EFECTIVO = 50000 + 200000 − 30000 = 220000`. El desglose por método completo (TARJETA etc.) se muestra como información, pero no suma al arqueo.

### Requirement: GET Caja Actual

The system MUST return the salon's current ABIERTA caja via `GET /api/salones/:salonId/caja/actual`. If no caja is open, the response MUST be 404 with error code CAJA_NO_ABIERTA.

#### Scenario: Caja abierta
- GIVEN an ABIERTA caja (id=5) for the salon
- WHEN GET /api/salones/:salonId/caja/actual
- THEN response MUST be 200 with the caja data

#### Scenario: Sin caja abierta
- GIVEN no ABIERTA caja for the salon
- WHEN GET /api/salones/:salonId/caja/actual
- THEN response MUST be 404 with error code CAJA_NO_ABIERTA

### Requirement: GET Historial de Cajas

The system MUST return paginated cajas of ALL estados via `GET /api/salones/:salonId/caja/cierres?page=&limit=`, ordered by `fechaCaja` DESC, with the envelope `{ ok, data: { data, meta } }` and meta `{ page, limit, total, totalPages }`. When the `estado` param is absent or `estado=TODAS`, the response MUST include cajas of every estado. When `estado=ABIERTA` or `estado=CERRADA`, the response MUST include only that subset AND `meta.total` MUST count only the filtered rows.

#### Scenario: Historial paginado

- GIVEN 5 cajas for the salon (mixed estados)
- WHEN GET /api/salones/:salonId/caja/cierres?page=1&limit=2
- THEN response MUST have data length 2, meta.total=5, meta.totalPages=3 AND the first item MUST be the most recent fechaCaja

#### Scenario: Historial incluye cajas abiertas por defecto

- GIVEN 2 ABIERTA cajas (fechaCaja 2026-08-16 and 2026-08-17) and 0 CERRADA cajas for the salon
- WHEN GET /api/salones/:salonId/caja/cierres?page=1&limit=12
- THEN response MUST have data length 2, meta.total=2 AND every item MUST have estado=ABIERTA

#### Scenario: Filtro por estado

- GIVEN 2 ABIERTA and 3 CERRADA cajas for the salon
- WHEN GET /api/salones/:salonId/caja/cierres?estado=CERRADA&page=1&limit=12
- THEN response MUST have meta.total=3 AND every item MUST have estado=CERRADA

#### Scenario: Caja de hoy abierta listada

- GIVEN today's caja is ABIERTA and the previous day's caja is CERRADA
- WHEN GET /api/salones/:salonId/caja/cierres
- THEN the first item MUST be today's caja with estado=ABIERTA

### Requirement: API-First

All caja endpoints MUST return the envelope `{ ok, data, error }`; errors MUST be `{ error: { code, message, details } }`. The operations MUST be consumable by n8n via X-API-Key on `/api/n8n/:salonId/caja/*` mirror endpoints returning the same shapes.

#### Scenario: Formato de error
- GIVEN a CERRADA caja for the salon
- WHEN POST /api/salones/:salonId/caja/cerrar
- THEN error body MUST be { ok: false, data: null, error: { code: "CAJA_YA_CERRADA", message: string, details: ... } }

#### Scenario: Consumo desde n8n
- GIVEN a valid X-API-Key
- WHEN GET /api/n8n/:salonId/caja/actual
- THEN response MUST match the web endpoint shape

### Requirement: Alerta Caja Pendiente de Cierre

The dashboard Caja tab MUST show a prominent warning banner when the salon has at least one ABIERTA caja whose `fechaCaja` precedes the current Colombia business day (an orphaned open caja). The banner MUST state the count of pending cajas and provide an action to view the most recent one. The banner MUST NOT appear when every ABIERTA caja belongs to today.

#### Scenario: Huérfana de día anterior

- GIVEN an ABIERTA caja with fechaCaja=2026-08-17 and today is 2026-08-20
- WHEN the Caja tab loads
- THEN a warning banner MUST appear stating 1 caja pending closure

#### Scenario: Sin huérfanas

- GIVEN only CERRADA cajas and today's ABIERTA caja for the salon
- WHEN the Caja tab loads
- THEN no pending-closure banner MUST appear

### Requirement: Detalle de Caja Abierta

`GET /api/salones/:salonId/caja/:id/cierre` for an ABIERTA caja MUST return the caja with `estado=ABIERTA` and a reporte whose `montoReal` and `diferencia` are null (an open caja has no arqueo). It MUST NOT fabricate `montoReal=0` or a negative `diferencia`.

#### Scenario: Detalle de caja abierta

- GIVEN an ABIERTA caja (id=9) with registros in EFECTIVO
- WHEN GET /api/salones/:salonId/caja/9/cierre
- THEN response MUST include caja.estado=ABIERTA, reporte.montoReal=null, reporte.diferencia=null AND the list of movimientos

### Requirement: Historial de Cajas en el Dashboard

The dashboard Caja tab historial MUST render every caja returned by the endpoint with a per-row estado badge (ABIERTA green, CERRADA amber), the full column set (fecha, abierta por, cerrada por, inicial, esperado, real, diferencia, estado, acción), and `—` for null arqueo values (esperado/real/diferencia) and for `cierrePorId` on open cajas.

#### Scenario: Lista mixta renderizada

- GIVEN the endpoint returns an ABIERTA and a CERRADA caja for the salon
- WHEN the historial renders
- THEN both badges MUST be visible AND the open caja row MUST show `—` for cerrada por, esperado, real and diferencia

#### Scenario: Reapertura intacta

- GIVEN today's caja is CERRADA and an older ABIERTA orphan exists for the salon
- WHEN the Caja tab loads
- THEN the "Reabrir caja" action MUST still be offered

### Requirement: POST Cerrar Caja por ID

The system MUST accept an optional `cajaId` in the body of `POST /caja/cerrar`. When provided, it MUST close THAT caja (verify `salonId`; 404 if missing/foreign; MUST be ABIERTA else 409). When absent, it closes today's ABIERTA caja (existing behavior).

#### Scenario: Cierre de huérfana por id

- GIVEN an ABIERTA caja (id=9, fechaCaja 2026-08-16) and none today
- WHEN POST /caja/cerrar with {cajaId: 9, montoRealEfectivo: 175000}
- THEN caja 9 MUST be CERRADA with the arqueo AND the report returned

#### Scenario: cajaId inexistente o de otro salón

- GIVEN an ABIERTA caja of another salon, or no caja with id=999
- WHEN POST /caja/cerrar with that cajaId
- THEN 404 CAJA_NO_ENCONTRADA AND no caja modified

#### Scenario: cajaId ya cerrada

- GIVEN a CERRADA caja (id=9) for the salon
- WHEN POST /caja/cerrar with {cajaId: 9, montoRealEfectivo: 100000}
- THEN 409 CAJA_YA_CERRADA

### Requirement: Arqueo al Cerrar por ID

When closing by `cajaId`, the system MUST compute `montoEsperado` from the caja's registros and gastos, set `diferencia = real − esperado`, and mark it CERRADA with `cierrePor`/`cierreEn`. Conditional update (estado=ABIERTA) MUST prevent double-closing.

#### Scenario: Reporte de huérfana

- GIVEN ABIERTA caja id=9: montoInicial=50000, EFECTIVO=180000, gastos EFECTIVO=20000, real=210000
- WHEN POST /caja/cerrar with {cajaId: 9, montoRealEfectivo: 210000}
- THEN montoEsperado=210000, diferencia=0, estado=CERRADA

#### Scenario: Doble cierre concurrente por id

- GIVEN two close requests for the same ABIERTA caja id=9 arrive simultaneously
- WHEN both call POST /caja/cerrar with {cajaId: 9}
- THEN exactly one succeeds, the other 409 CAJA_YA_CERRADA

### Requirement: Bloqueo de Apertura con Cualquier Caja Abierta

The system MUST reject `POST /caja/abrir` with 409 CAJA_YA_ABIERTA when ANY ABIERTA caja exists for the salon, regardless of `fechaCaja` (including orphans), message "Ya existe una caja abierta — cerrá la caja pendiente antes de abrir una nueva". The one-caja-per-day rule (409 CAJA_YA_CERRADA if today closed) MUST remain.

#### Scenario: Huérfana de día anterior bloquea apertura

- GIVEN an ABIERTA caja fechaCaja=2026-08-16, today 2026-08-20
- WHEN POST /caja/abrir with {montoInicial: 50000}
- THEN 409 CAJA_YA_ABIERTA with the message AND no caja created

#### Scenario: Caja de hoy abierta bloquea apertura

- GIVEN an ABIERTA caja for today
- WHEN POST /caja/abrir
- THEN 409 CAJA_YA_ABIERTA

#### Scenario: Sin abiertas permite abrir

- GIVEN no ABIERTA caja of any date and no CERRADA caja for today
- WHEN POST /caja/abrir
- THEN 201 with the ABIERTA caja

### Requirement: Botón Cerrar en el Historial

The Caja tab historial MUST render a "Cerrar" button on every ABIERTA row (in addition to "Ver"). Clicking it MUST open the arqueo modal pre-targeted to that caja: prefill `montoEsperado` from `GET /caja/:id/cierre` and submit `POST /caja/cerrar` with that `cajaId` and the entered `montoRealEfectivo`.

#### Scenario: Cerrar huérfana desde el historial

- GIVEN an ABIERTA caja (id=9) row in the historial
- WHEN the user clicks "Cerrar" and confirms the arqueo
- THEN the modal shows caja 9's esperado AND POST sends {cajaId: 9, montoRealEfectivo}

#### Scenario: Fila CERRADA sin botón Cerrar

- GIVEN a CERRADA caja row in the historial
- THEN the row MUST NOT offer "Cerrar" (only "Ver")

### Requirement: Apertura Bloqueada en la UI

The dashboard MUST NOT offer "Abrir" when any ABIERTA caja exists (any date): the Caja tab MUST hide it and show "No se puede abrir: hay una caja abierta pendiente de cierre" alongside the warning. CajaBanner likewise shows "Ver caja" instead of "Abrir" with orphans.

#### Scenario: Tab sin Abrir con huérfana

- GIVEN an ABIERTA orphan (fechaCaja < today) and no caja today
- WHEN the Caja tab loads
- THEN no "Abrir" button AND the pending message shown

#### Scenario: Banner sin Abrir con huérfana

- GIVEN an ABIERTA orphan and no caja today
- WHEN the CajaBanner loads
- THEN it shows the pending count with "Ver caja" instead of "Abrir"
