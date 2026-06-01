# Agenda Bloqueos — Time Block Management

## Purpose

Manage time blocks (bloqueos) that prevent appointments. Supports both per-employee and salon-wide blocks with range overlap validation.

## Requirements

### Requirement: List Bloqueos

The system MUST list bloqueos for a salon, optionally filtered by `usuarioId`. Salon-wide bloqueos (`usuarioId=null`) MUST appear in all lists.

#### Scenario: List all bloqueos for a salon

- GIVEN a salón with 2 personal bloqueos and 1 salon-wide bloqueo
- WHEN `GET /api/salones/:salonId/agenda/bloqueos`
- THEN the response contains all 3 bloqueos

#### Scenario: List bloqueos filtered by employee

- GIVEN a salón with 1 bloqueo for usuarioId=2 and 1 salon-wide bloqueo
- WHEN `GET /api/salones/:salonId/agenda/bloqueos?usuarioId=2`
- THEN the response contains the personal and the salon-wide bloqueo

### Requirement: Create Bloqueo

The system MUST create a bloqueo for a specific employee (`usuarioId` set) or salon-wide (`usuarioId=null`). The system MUST reject overlaps with existing bloqueos for the same scope. `fechaFin` MUST be after `fechaInicio`.

#### Scenario: Create personal bloqueo

- GIVEN no existing bloqueos for usuarioId=2 on that range
- WHEN `POST /api/salones/:salonId/agenda/bloqueos` with `{ fechaInicio: "2026-06-01T10:00:00Z", fechaFin: "2026-06-01T12:00:00Z", tipo: "TOTAL", usuarioId: 2, motivo: "Descanso" }`
- THEN the response is 201 with the created bloqueo

#### Scenario: Create salon-wide bloqueo

- GIVEN a valid date range
- WHEN creating a bloqueo without usuarioId
- THEN the bloqueo is created with `usuarioId=null` affecting all employees

#### Scenario: Reject overlapping bloqueo

- GIVEN an existing bloqueo for usuarioId=2 from 10:00-12:00
- WHEN creating a new bloqueo for the same usuario from 11:00-13:00
- THEN the response is 409 with overlap error

#### Scenario: Reject invalid date range

- GIVEN `fechaFin` is before `fechaInicio`
- WHEN creating a bloqueo
- THEN the response is 422

### Requirement: Delete Bloqueo

The system MUST delete a bloqueo by ID. Deleting a non-existent bloqueo MUST return 404.

#### Scenario: Delete existing bloqueo

- GIVEN an existing bloqueo with id=5
- WHEN `DELETE /api/salones/:salonId/agenda/bloqueos/5`
- THEN the response is 204 and the bloqueo is removed

#### Scenario: Delete non-existent bloqueo

- GIVEN a bloqueo id that does not exist
- WHEN attempting to delete it
- THEN the response is 404
