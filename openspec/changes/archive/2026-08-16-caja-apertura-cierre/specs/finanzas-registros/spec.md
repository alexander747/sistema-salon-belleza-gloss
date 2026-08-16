# Delta for finanzas-registros

## ADDED Requirements

### Requirement: Regla de Oro — Caja Abierta

The system MUST reject `POST /api/salones/:salonId/registros` with 422 and code CAJA_CERRADA when no ABIERTA caja exists for the salon on the current Colombia business day. When a caja is open, the created registro MUST persist the open caja's `cajaId`. `cajaId` MUST be nullable: legacy registros without a caja MUST remain valid and existing operations (listar, obtener, anular) MUST continue to work on them.

#### Scenario: Registro sin caja abierta
- GIVEN no ABIERTA caja exists for the salon today
- WHEN POST /api/salones/:salonId/registros with a valid payload
- THEN response MUST be 422 with error code CAJA_CERRADA AND no registro MUST be created

#### Scenario: Registro con caja abierta
- GIVEN an ABIERTA caja (id=5) for the salon today
- WHEN POST /api/salones/:salonId/registros with a valid payload
- THEN response MUST be 201 AND the registro MUST persist cajaId=5

#### Scenario: Registro legado sin caja
- GIVEN an existing registro with cajaId=NULL
- WHEN GET /api/salones/:salonId/registros/:id
- THEN response MUST be 200 with the registro intact
