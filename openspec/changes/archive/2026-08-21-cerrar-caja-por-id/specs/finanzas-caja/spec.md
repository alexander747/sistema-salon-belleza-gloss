# Delta for finanzas-caja

## ADDED Requirements

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
