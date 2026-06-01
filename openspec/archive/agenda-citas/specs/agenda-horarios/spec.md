# Agenda Horarios — Business Hours Configuration

## Purpose

Manage the salon's weekly business hours. The schedule (7 days) is used by the disponibilidad check to determine if a slot falls within open hours.

## Requirements

### Requirement: Upsert Horarios

The system MUST accept a complete 7-day schedule in a single `PUT` request. For each `diaSemana` (0=Sunday..6=Saturday), the caller provides `horaApertura`, `horaCierre`, and `estaAbierto`. The operation MUST upsert (insert or update) each day's record.

#### Scenario: Upsert full weekly schedule

- GIVEN a salon with no existing horarios
- WHEN `PUT /api/salones/:salonId/agenda/horarios` with 7 entries including Monday-Friday 09:00-18:00, Saturday 09:00-14:00, Sunday closed
- THEN all 7 records are created/updated and the response contains the full schedule

#### Scenario: Update existing schedule

- GIVEN existing horarios with Monday 09:00-18:00
- WHEN `PUT /api/salones/:salonId/agenda/horarios` with Monday changed to 10:00-19:00
- THEN Monday's record is updated to 10:00-19:00

#### Scenario: Mark a day as closed

- GIVEN existing horarios with `diaSemana=2` open
- WHEN upserting with `{ diaSemana: 2, estaAbierto: false }`
- THEN that day's record has `estaAbierto=false` and disponibilidad will reject slots on Tuesday

### Requirement: Get Horarios

The system MUST return the salon's current horarios schedule (7 records).

#### Scenario: Get existing schedule

- GIVEN a salon with 7 horario records configured
- WHEN `GET /api/salones/:salonId/agenda/horarios`
- THEN the response contains 7 objects with `diaSemana`, `horaApertura`, `horaCierre`, `estaAbierto`

#### Scenario: Get schedule for salon with no horarios

- GIVEN a salon with no horario records yet
- WHEN `GET /api/salones/:salonId/agenda/horarios`
- THEN the response contains 7 default entries with `estaAbierto: false` and null hours
