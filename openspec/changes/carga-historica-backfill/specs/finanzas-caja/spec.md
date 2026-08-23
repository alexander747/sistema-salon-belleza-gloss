# Delta for finanzas-caja

## ADDED Requirements

### Requirement: POST Abrir Caja con fechaCaja opcional

The system MUST accept an optional `fechaCaja` (YYYY-MM-DD) in `POST /api/salones/:salonId/caja/abrir`. When absent, it MUST default to the current Colombia business day. The one-caja-per-day rule (`findBySalonYFecha`, 409 `CAJA_YA_CERRADA`) and the any-open rule (409 `CAJA_YA_ABIERTA`) MUST apply to the passed date. The `ER_DUP_ENTRY` backstop MUST work with the passed date.

#### Scenario: Abrir caja de fecha pasada

- GIVEN no ABIERTA caja and no caja for 2026-08-16
- WHEN POST /caja/abrir with {montoInicial: 50000, fechaCaja: "2026-08-16"}
- THEN response MUST be 201 with `fechaCaja=2026-08-16`, estado=ABIERTA

#### Scenario: Sin fechaCaja → hoy

- GIVEN no caja for today
- WHEN POST /caja/abrir with {montoInicial: 50000}
- THEN response MUST be 201 with `fechaCaja` = today

#### Scenario: Día pasado ya cerrado

- GIVEN a CERRADA caja for 2026-08-16
- WHEN POST /caja/abrir with {fechaCaja: "2026-08-16"}
- THEN response MUST be 409 with code `CAJA_YA_CERRADA`

### Requirement: Backfill Secuencial de Cajas

The any-open rule MUST remain unchanged: opening a past caja requires closing any ABIERTA caja first. The owner backfills sequentially per day (abrir 16/08 → registrar ventas → cerrar 16/08 → abrir 17/08 → …). An ABIERTA caja of a past date MUST block opening another caja and MUST block today's sales (regla de oro).

#### Scenario: Secuencia completa por día

- GIVEN no ABIERTA caja
- WHEN abrir 16/08 → registrar ventas 16/08 → cerrar 16/08 → abrir 17/08
- THEN every step MUST succeed AND at no point MUST two cajas be ABIERTA simultaneously

#### Scenario: Caja pasada abierta bloquea operar hoy

- GIVEN an ABIERTA caja with `fechaCaja=2026-08-16` and today is 2026-08-22
- WHEN POST /caja/abrir {fechaCaja: "2026-08-22"} or POST /registros today
- THEN abrir MUST return 409 `CAJA_YA_ABIERTA` AND registros MUST return 422 `CAJA_CERRADA`

### Requirement: Cerrar Caja sin Pedir Fecha

`POST /caja/cerrar` MUST NOT accept a date. The caja's `fechaCaja` is authoritative for reports; `cierreEn` is the audit timestamp of the physical close (now). The arqueo MUST remain date-agnostic (computed by `cajaId`).

#### Scenario: Cerrar caja de fecha pasada hoy

- GIVEN an ABIERTA caja (id=9) with `fechaCaja=2026-08-16` and registros/gastos by cajaId
- WHEN POST /caja/cerrar with {montoRealEfectivo}
- THEN the caja MUST be CERRADA with the arqueo computed from its registros/gastos AND `cierreEn` = now (the physical close happens today)
