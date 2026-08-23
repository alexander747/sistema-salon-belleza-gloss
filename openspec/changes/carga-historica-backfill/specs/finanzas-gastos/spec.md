# Delta for finanzas-gastos

## ADDED Requirements

### Requirement: POST Crear Gasto Honra fecha

The system MUST honor the optional `fecha` (YYYY-MM-DD) already accepted by `POST /api/salones/:salonId/gastos` (`createGastoSchema`): the gasto MUST be persisted with that `fecha` and MUST be linked to the ABIERTA caja of that date (so the arqueo of that caja includes it). When `fecha` is absent, both `fecha` and `cajaId` MUST default to today.

#### Scenario: Gasto backfilleado

- GIVEN an ABIERTA caja (id=5) with `fechaCaja=2026-08-16`
- WHEN POST /gastos with {descripcion, monto, fecha: "2026-08-16"}
- THEN the gasto MUST persist `fecha=2026-08-16` AND `cajaId=5` (el arqueo del 16/08 lo incluye)

#### Scenario: Sin fecha → hoy

- GIVEN today's ABIERTA caja (id=9)
- WHEN POST /gastos without `fecha`
- THEN the gasto MUST persist `fecha` = today AND `cajaId=9`
