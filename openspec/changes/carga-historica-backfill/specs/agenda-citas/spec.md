# Delta for agenda-citas

## ADDED Requirements

### Requirement: Citas con Fechas Pasadas (UI)

The dashboard MUST allow creating citas with past dates: the agenda date input MUST NOT enforce `min=today`, and the form default MUST be today (not empty). The backend already accepts any ISO `fechaHora`; the created cita MUST store the chosen date (TZ-safe ISO conversion).

#### Scenario: Crear cita para fecha pasada

- GIVEN the owner opens the agenda form
- WHEN selecting 2026-08-16 (past) with a valid hora and confirming
- THEN the input MUST accept the past date AND the created cita MUST have `fechaHora` = 2026-08-16T{hora}:00 (ISO local)

#### Scenario: Default hoy

- GIVEN the owner opens the agenda form without touching the date
- THEN the date input MUST show today (not empty)

### Requirement: Completar Cita Backfilleada usa cita.fechaHora

When completing a cita (atomic path), the created registro MUST default `fechaHora` to `cita.fechaHora` when the payload omits it, and MUST be linked to the ABIERTA caja of that date. Without an ABIERTA caja for that date, the completion MUST be rejected with 409 `CAJA_NO_ABIERTA_EN_FECHA` and the cita MUST remain in its previous estado.

#### Scenario: Completar cita de fecha pasada

- GIVEN a CONFIRMADA cita with `fechaHora=2026-08-16` and an ABIERTA caja for 2026-08-16
- WHEN POST /agenda/citas/:id/completar with a registro payload without `fechaHora`
- THEN the registro MUST persist `fechaHora` from the cita AND `cajaId` = the 16/08 caja

#### Scenario: Completar cita pasada sin caja de esa fecha

- GIVEN a CONFIRMADA cita with `fechaHora=2026-08-16` and no ABIERTA caja for 2026-08-16
- WHEN POST /agenda/citas/:id/completar
- THEN response MUST be 409 `CAJA_NO_ABIERTA_EN_FECHA` AND the cita MUST remain CONFIRMADA
