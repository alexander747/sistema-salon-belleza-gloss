# Proposal: Agenda de Citas — Core Booking System

## Intent

The system lacks appointment booking logic despite having DB tables (`citas`, `bloqueos_agenda`, `horarios_comerciales`). The old `pos-ok` project has this in a flat n8n controller without clean architecture. This change delivers the full booking engine as a hexagonal module reusable by both the web API and the WhatsApp n8n bot.

## Scope

### In Scope
- CRUD for citas (list with filters, get with servicios, create with overlap check, state machine transitions)
- Availability verification (employee, date, hour, duration) and slot generation for a day
- Bloqueos CRUD (employee-specific or salon-wide time blocks)
- Horarios comerciales upsert (7-day schedule per salon)
- 12 use cases across 4 controllers, 3 repositories, Zod validation schemas
- Routes under `/api/salones/:salonId/agenda`

### Out of Scope
- Frontend agenda UI (deferred — `apps/web` does not exist yet)
- Pagination (MVP data volume does not require it)
- Push notifications for appointment reminders

## Capabilities

### New Capabilities
- `agenda-citas`: Appointment CRUD with state machine (PENDIENTE → CONFIRMADA → COMPLETADA/NO_LLEGO; cancellations allowed from PENDIENTE or CONFIRMADA)
- `agenda-disponibilidad`: Slot availability verification and daily slot listing, shared by web and n8n
- `agenda-bloqueos`: Time block management per employee or salon-wide
- `agenda-horarios`: Business hours configuration per day of week

### Modified Capabilities
None — this is a greenfield module. Existing specs (`servicios-crud`, `backend-hexagonal`, `api-endpoints`) are referenced but their requirements remain unchanged.

## Approach

Full clean architecture module (`apps/api/src/modules/agenda/`) mirroring `catalogo/` and `personas/`. Cita duration is computed from M:N servicios sum (`SUM(s.duracionMinutos)`). Zoned overlap detection replaces the old hardcoded 60-min check. Concurrency uses optimistic locking (`version` column on `citas`). TypeORM repositories with eager-loaded servicios prevent N+1 queries. Routes mount in `app.ts`; n8n endpoints reuse the same use cases via DI.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `apps/api/src/modules/agenda/` | New | Full module: domain, application, infrastructure, presentation |
| `apps/api/src/shared/container.ts` | Modified | Register agenda dependencies |
| `apps/api/src/app.ts` | Modified | Mount `agendaRouter` |
| `packages/validation/src/` | Modified | New `agenda.schema.ts` + exports |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Overlap detection misses edge cases (multi-day, DST) | Medium | Zoned date math with UTC storage; integration tests for boundary cases |
| Race condition on concurrent bookings | Medium | Optimistic locking with version column retry |
| n8n API key auth bypass on new agenda routes | Low | Reuse existing `apiKeyGuard` pattern for n8n-mounted copies |

## Rollback Plan

Remove `agendaRouter` from `app.ts`, delete `modules/agenda/` directory, revert `container.ts` registrations. No DB migration needed (tables already exist).

## Dependencies

- Existing DB tables (already migrated)
- `tsyringe` DI container
- `zod` validation package

## Success Criteria

- [ ] Overlap detection prevents double-booking for multi-service citas
- [ ] State machine rejects all 12 invalid transitions out of 15 possible combinations
- [ ] Same availability use case serves both web API and n8n bot
- [ ] Module follows hexagonal layering (linter passes)
- [ ] ~800-1200 lines total, deliverable in 2 PRs
