# Caja — Specification

## Purpose

Daily cash control per salon: one caja per salon per Colombia business day, opened with an initial float and closed with an arqueo (esperado vs real → diferencia). Golden rule: without an open caja, no sales and no completed citas. API-first for web, mobile, and n8n.

## ADDED Requirements

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

### Requirement: GET Historial de Cierres

The system MUST return paginated closed cajas via `GET /api/salones/:salonId/caja/cierres?page=&limit=`, ordered by `fechaCaja` DESC, as `{ data, meta }` with meta `{ page, limit, total, totalPages }`. An optional `estado` filter MAY be applied.

#### Scenario: Historial paginado
- GIVEN 5 closed cajas for the salon
- WHEN GET /api/salones/:salonId/caja/cierres?page=1&limit=2
- THEN response MUST have data length 2, meta.total=5, meta.totalPages=3 AND the first item MUST be the most recent fechaCaja

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
