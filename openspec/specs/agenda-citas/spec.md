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

The system MUST enforce valid state transitions. Invalid transitions MUST return 422. Acceptable transitions: `PENDIENTE→CONFIRMADA`, `PENDIENTE→CANCELADA`, `CONFIRMADA→COMPLETADA`, `CONFIRMADA→NO_LLEGO`, `CONFIRMADA→CANCELADA`.

#### Scenario: Confirm pending cita

- GIVEN a cita in PENDIENTE state
- WHEN `PATCH /api/salones/:salonId/agenda/citas/1/estado` with `{ nuevoEstado: "CONFIRMADA" }`
- THEN the cita estado is CONFIRMADA

#### Scenario: Complete confirmed cita

- GIVEN a cita in CONFIRMADA state
- WHEN `PATCH /api/salones/:salonId/agenda/citas/1/completar`
- THEN the cita estado is COMPLETADA

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
