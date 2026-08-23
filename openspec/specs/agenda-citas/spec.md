# Agenda Citas — Appointment CRUD + State Machine

## Purpose

Manage appointments (citas) with a state machine, overlap validation, and M:N service assignment. Serves as the core booking engine for both web API and n8n WhatsApp bot.

## Requirements

### Requirement: List and Get Citas

The system MUST list citas for a salon with optional filters (`desde`, `hasta`, `usuarioId`, `estado`, `clienteId`) and MUST return a single cita by ID with its associated servicios eagerly loaded.

#### Scenario: List citas filtered by usuario and estado

- GIVEN a salon with 5 citas for 3 different employees
- WHEN `GET /api/salones/:salonId/agenda/citas?usuarioId=1&estado=PENDIENTE`
- THEN the response contains only PENDIENTE citas for usuarioId=1

#### Scenario: Get cita by ID includes servicios

- GIVEN a cita with 2 associated servicios
- WHEN `GET /api/salones/:salonId/agenda/citas/42`
- THEN the response includes `servicios` array with both service details

### Requirement: Create Cita with Overlap Validation

The system MUST create a cita only when the requested slot is available (no horario, bloqueo, or cita overlap conflicts). The system MUST validate that `clienteId` and `usuarioId` reference existing entities. Duration MUST be calculated as `SUM(servicios.duracionMinutos)`.

#### Scenario: Create cita successfully

- GIVEN a valid cliente and usuario, and the slot is available
- WHEN `POST /api/salones/:salonId/agenda/citas` with `{ clienteId: 1, usuarioId: 2, fechaHora: "2026-06-01T10:00:00Z", serviciosIds: [1, 2], notas: "Corte y tinte" }`
- THEN the response is 201 with the created cita in PENDIENTE state

#### Scenario: Reject creation on overlap

- GIVEN an existing CONFIRMADA cita for usuarioId=2 at 10:00-11:00 (servicios sum=60min)
- WHEN creating a new cita for the same usuario at 10:30 same day
- THEN the response is 409 with `{ disponible: false, motivo: "Conflicto con cita existente" }`

#### Scenario: Validate cliente and usuario existence

- GIVEN a non-existent clienteId
- WHEN creating a cita with that clienteId
- THEN the response is 404 with appropriate error message

### Requirement: State Machine Transitions

The system MUST enforce valid state transitions. Invalid transitions MUST return 422. Acceptable transitions: `PENDIENTE→CONFIRMADA`, `PENDIENTE→CANCELADA`, `CONFIRMADA→COMPLETADA`, `CONFIRMADA→NO_LLEGO`, `CONFIRMADA→CANCELADA`. Completar via `/completar` is atomic: with a registro payload, transition validation and registro creation share one transaction; any failure rolls back both.

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

### Requirement: Cancel Cita with Motivo

The system MUST allow cancellation from PENDIENTE or CONFIRMADA with a required `motivoCancelacion`. Terminal states MUST reject cancellation with 422.

#### Scenario: Cancel pending cita with motivo

- GIVEN a cita in PENDIENTE state
- WHEN `PATCH /api/salones/:salonId/agenda/citas/1/cancelar` with `{ motivo: "Cliente canceló" }`
- THEN the cita is CANCELADA with motivoCancelacion set

#### Scenario: Reject cancel on completed cita

- GIVEN a cita in COMPLETADA state
- WHEN attempting to cancel it
- THEN the response is 422 with `{ error: "Transición inválida: COMPLETADA → CANCELADA" }`

### Requirement: Invalid Transition Returns 422

The system MUST reject any transition from terminal states (COMPLETADA, CANCELADA, NO_LLEGO) with HTTP 422.

#### Scenario: Confirm completed cita rejected

- GIVEN a cita in COMPLETADA state
- WHEN `PATCH /api/salones/:salonId/agenda/citas/1/estado` with `{ nuevoEstado: "CONFIRMADA" }`
- THEN the response is 422

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
