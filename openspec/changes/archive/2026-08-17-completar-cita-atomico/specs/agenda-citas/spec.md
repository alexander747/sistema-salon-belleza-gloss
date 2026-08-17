# Delta for Agenda Citas

## ADDED Requirements

### Requirement: Completar Cita Atómico con Registro

When `POST /api/salones/:salonId/agenda/citas/:id/completar` receives a `registro` payload, the system MUST create the `RegistroServicio` AND complete the cita in a SINGLE database transaction. Any failure MUST roll back everything — no partial persistence. On success the response MUST contain `{ cita, registro }`. The registro's `salonId` MUST come from the cita, never the client payload.

#### Scenario: Completar cita con registro en una transacción

- GIVEN a CONFIRMADA cita with an open caja and a valid registro payload
- WHEN `POST /api/salones/:salonId/agenda/citas/1/completar` with `{ registro: { clienteId, usuarioId, totalServicios, pagos, ... } }`
- THEN the response is 200 with `{ cita: { estado: COMPLETADA }, registro: { id } }`
- AND the registro MUST be persisted with `citaId` referencing the completed cita

#### Scenario: Fallo intermedio revierte todo

- GIVEN a registro payload that fails validation inside the transaction
- WHEN the completar request is executed
- THEN no registro is created AND the cita remains CONFIRMADA
- AND no pagos, divisiones, productos or servicio items are persisted

### Requirement: Reintento No Duplica

The system MUST reject a second completar attempt on an already-COMPLETADA cita with HTTP 422 and MUST NOT create another registro.

#### Scenario: Reintento tras éxito

- GIVEN a cita already in COMPLETADA state
- WHEN `POST /api/salones/:salonId/agenda/citas/1/completar` is retried with the same registro payload
- THEN the response is 422 (invalid transition COMPLETADA → COMPLETADA)
- AND no second registro is created

### Requirement: Completar Cita PENDIENTE Rechazado

The system MUST reject completar on a PENDIENTE cita with HTTP 422 and MUST NOT create a registro.

#### Scenario: Cita pendiente no se completa

- GIVEN a cita in PENDIENTE state
- WHEN `POST /api/salones/:salonId/agenda/citas/1/completar` with a registro payload
- THEN the response is 422
- AND no registro is created AND the cita remains PENDIENTE

### Requirement: Caja Cerrada Bloquea Todo

The system MUST reject the atomic completar with HTTP 422 code `CAJA_CERRADA` when no caja ABIERTA exists for the salon's business day, and MUST NOT create a registro.

#### Scenario: Sin caja abierta

- GIVEN no ABIERTA caja for the salon today
- WHEN `POST /api/salones/:salonId/agenda/citas/1/completar` with a registro payload
- THEN the response is 422 with code `CAJA_CERRADA`
- AND no registro is created AND the cita stays unchanged

### Requirement: Registro con citaId (Linkage Go-Forward)

Registros created through the atomic completar MUST persist the originating cita's id in `registros_servicio.citaId`. Registros created via the legacy `POST /registros` endpoint SHALL leave `citaId` NULL.

#### Scenario: Vinculación de registro a cita

- GIVEN a successful atomic completar of cita id=42
- WHEN the created registro is fetched
- THEN the registro MUST have `citaId = 42`

### Requirement: Compatibilidad Legacy sin Registro

The system MUST keep the legacy behavior when `POST /citas/:id/completar` is called WITHOUT a `registro` payload: complete the cita only, create no registro, return the cita DTO.

#### Scenario: Completar sin registro

- GIVEN a CONFIRMADA cita with an open caja
- WHEN `POST /api/salones/:salonId/agenda/citas/1/completar` with an empty body
- THEN the response is 200 with the cita in COMPLETADA state
- AND no registro is created

## MODIFIED Requirements

### Requirement: State Machine Transitions

The system MUST enforce valid state transitions. Invalid transitions MUST return 422. Acceptable transitions: `PENDIENTE→CONFIRMADA`, `PENDIENTE→CANCELADA`, `CONFIRMADA→COMPLETADA`, `CONFIRMADA→NO_LLEGO`, `CONFIRMADA→CANCELADA`. Completar via `/completar` is atomic: with a registro payload, transition validation and registro creation share one transaction; any failure rolls back both.
(Previously: completar only validated/persisted the state change; registro creation was a separate frontend call with no transaction boundary.)

#### Scenario: Confirm pending cita

- GIVEN a cita in PENDIENTE state
- WHEN `PATCH /api/salones/:salonId/agenda/citas/1/estado` with `{ nuevoEstado: "CONFIRMADA" }`
- THEN the cita estado is CONFIRMADA

#### Scenario: Complete confirmed cita atomically

- GIVEN a cita in CONFIRMADA state and an open caja
- WHEN `POST /api/salones/:salonId/agenda/citas/1/completar` (with optional `{ registro }`)
- THEN the cita estado is COMPLETADA AND, when a registro was provided, it is created in the same transaction and returned as `{ cita, registro }`

#### Scenario: Mark confirmed as no-show

- GIVEN a cita in CONFIRMADA state
- WHEN `PATCH /api/salones/:salonId/agenda/citas/1/estado` with `{ nuevoEstado: "NO_LLEGO" }`
- THEN the cita estado is NO_LLEGO
