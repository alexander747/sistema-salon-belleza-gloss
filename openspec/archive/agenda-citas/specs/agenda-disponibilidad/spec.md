# Agenda Disponibilidad — Slot Availability

## Purpose

Verify whether a specific appointment slot is available and generate a list of available time windows for a given day. Shared by both web API and n8n WhatsApp bot.

## Requirements

### Requirement: Verificar Disponibilidad

The system MUST return `{ disponible: boolean, motivo?: string }` given `usuarioId`, `fecha`, `hora`, and `duracionMinutos`. The check MUST run in this order: horario comercial → bloqueos → citas existentes overlap.

#### Scenario: Slot is available

- GIVEN the salón is open at 10:00, no bloqueos exist for usuarioId=2, and no citas overlap
- WHEN `GET /api/salones/:salonId/agenda/disponibilidad?usuarioId=2&fecha=2026-06-01&hora=10:00&duracionMinutos=60`
- THEN `{ disponible: true }`

#### Scenario: Blocked by horario (closed day)

- GIVEN `diaSemana=0` (Sunday) with `estaAbierto=false` for the salón
- WHEN checking disponibilidad for that Sunday
- THEN `{ disponible: false, motivo: "Salón cerrado este día" }`

#### Scenario: Blocked by horario (outside hours)

- GIVEN horario is 09:00-18:00 and the requested slot starts at 17:30 with 60min duration
- WHEN checking disponibilidad
- THEN `{ disponible: false, motivo: "Fuera del horario comercial" }`

#### Scenario: Blocked by bloqueo de agenda

- GIVEN a TOTAL bloqueo for usuarioId=2 from 10:00 to 12:00 on 2026-06-01
- WHEN checking disponibilidad at 10:30 for usuarioId=2
- THEN `{ disponible: false, motivo: "Bloqueo de agenda" }`

#### Scenario: Blocked by salon-wide bloqueo

- GIVEN a bloqueo with `usuarioId=null` for the salón from 10:00 to 11:00
- WHEN checking disponibilidad for any employee at 10:30
- THEN `{ disponible: false, motivo: "Bloqueo de agenda" }`

#### Scenario: Blocked by existing cita overlap

- GIVEN an existing CONFIRMADA cita for usuarioId=2 from 10:00 to 11:00 (servicios sum=60min)
- WHEN checking disponibilidad at 10:30 for usuarioId=2 with duracionMinutos=60
- THEN `{ disponible: false, motivo: "Conflicto con cita existente" }`

### Requirement: Obtener Slots Disponibles

The system MUST return an array of available time windows for a given `usuarioId`, `fecha`, and `duracionMinutos`. Each slot MUST respect horario comercial hours, exclude bloqueos, and exclude cita overlaps.

#### Scenario: Slots list returns open windows

- GIVEN horario 09:00-17:00, no bloqueos, no citas, duracionMinutos=60
- WHEN `GET /api/salones/:salonId/agenda/disponibilidad/slots?usuarioId=2&fecha=2026-06-01&duracionMinutos=60`
- THEN the response contains slots ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00"]

#### Scenario: Slots exclude blocked windows

- GIVEN a cita from 10:00-11:00 and horario 09:00-17:00
- WHEN `GET /api/salones/:salonId/agenda/disponibilidad/slots?usuarioId=2&fecha=2026-06-01&duracionMinutos=60`
- THEN slot "10:00" is absent from the response
