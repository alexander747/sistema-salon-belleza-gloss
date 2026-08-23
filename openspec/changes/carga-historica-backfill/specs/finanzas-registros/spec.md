# Delta for finanzas-registros

## ADDED Requirements

### Requirement: POST Crear Registro con fechaHora

The system MUST accept an optional `fechaHora` (ISO datetime string) in `POST /api/salones/:salonId/registros`. When provided, the created registro MUST persist it as the business date. When absent, `fechaHora` MUST default to the current time. The registro MUST be linked to the ABIERTA caja of the payload's date (via `findAbiertaBySalonYFecha(salonId, fechaDelPayload)`), not today's caja. The `RegistroServicioDTO` MUST expose `fechaHora`.

#### Scenario: Venta backfilleada con fechaHora

- GIVEN an ABIERTA caja (id=5) with `fechaCaja=2026-08-16` and a payload with `fechaHora=2026-08-16T15:00:00`
- WHEN POST /api/salones/:salonId/registros
- THEN response MUST be 201 with `fechaHora=2026-08-16T15:00:00` AND the registro MUST persist `cajaId=5` (caja de la fecha del payload, no la de hoy)

#### Scenario: Sin fechaHora → ahora

- GIVEN a valid payload without `fechaHora` and today's ABIERTA caja (id=9)
- WHEN POST /api/salones/:salonId/registros
- THEN response MUST be 201 with `fechaHora` ≈ now AND `cajaId=9`

#### Scenario: fechaHora pasada sin caja de esa fecha

- GIVEN a payload with `fechaHora=2026-08-16` and no ABIERTA caja for 2026-08-16
- WHEN POST /api/salones/:salonId/registros
- THEN response MUST be 409 with code `CAJA_NO_ABIERTA_EN_FECHA` AND no registro MUST be created (integridad: no venta sin la caja de su día)

### Requirement: Reportes filtran por fechaHora

The system MUST filter registros by `fechaHora`, falling back to `creadoEn` (COALESCE) for legacy rows without it, in: listar registros, P&L mensual, resumen del día, nómina pendiente (período QUINCENAL/SEMANAL), liquidar empleada, detalle de cierre (fecha de movimientos) y cuentas por cobrar (antigüedad de la deuda).

#### Scenario: Registro backfilleado cuenta en su período

- GIVEN a registro with `fechaHora=2026-08-16` created today (22/08)
- WHEN GET P&L for 2026-08-01..2026-08-31
- THEN the registro MUST count in August's P&L (not in August 22 only)

#### Scenario: Registro legacy sin fechaHora

- GIVEN a pre-existing registro with `fechaHora=NULL` and `creadoEn=2026-08-15`
- WHEN a range filter includes 2026-08-15
- THEN the registro MUST be included via `COALESCE(fechaHora, creadoEn)`

#### Scenario: Nómina quincenal con backfill

- GIVEN a QUINCENAL empleada with a registro `fechaHora=2026-08-05` (created 22/08) and período [01,15]
- WHEN GET nómina pendiente
- THEN the registro MUST count in the quincena del 05/08 (período [01,15]) AND the anti-double-pay guard MUST keep comparing against the last liquidación
