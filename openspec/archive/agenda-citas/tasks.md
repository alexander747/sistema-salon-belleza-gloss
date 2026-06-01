# Tasks: Agenda Citas — Module

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 1400–1600 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (foundation) → PR 2 (use cases) → PR 3 (wiring+tests) |
| Delivery strategy | auto-chain |
| Chain strategy | feature-branch-chain |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Ports, DTOs, DisponibilidadService, repos, entity method | PR 1 | Base: `feature/agenda-citas`. No routes, no controllers |
| 2 | All 11 use cases (cita/bloqueo/horario) | PR 2 | Base: PR #1 branch. Depends on repos + service from PR 1 |
| 3 | 4 controllers, routes, container.ts, app.ts, tests | PR 3 | Base: PR #2 branch. Depends on use cases from PR 2 |

## Phase 1: Foundation

- [x] 1.1 Create 3 domain ports: `ICitaRepository`, `IBloqueoAgendaRepository`, `IHorarioComercialRepository`
- [x] 1.2 Create 4 DTOs: `CitaDTO`, `BloqueoAgendaDTO`, `HorarioComercialDTO`, `DisponibilidadResultDTO`
- [x] 1.3 Add `cambiarEstado(nuevoEstado)` + valid transitions to `CitaEntity` (in `state-machine.ts`)
- [x] 1.4 Create `DisponibilidadService` with overlap detection (horario→bloqueos→citas order)
- [x] 1.5 Create `TypeORMCitaRepository` with `list`, `findById`, `findActiveByUsuario`, `save`
- [x] 1.6 Create `TypeORMBloqueoAgendaRepository` with `list`, `findOverlapping`, `create`, `delete`
- [x] 1.7 Create `TypeORMHorarioComercialRepository` with `findBySalonAndDay`, `upsertAll`

## Phase 2: Core Use Cases

- [x] 2.1 `ListCitasUseCase` — filter by estado/usuarioId/fecha range
- [x] 2.2 `GetCitaUseCase` — fetch by id with servicios eager
- [x] 2.3 `CreateCitaUseCase` — validate cliente/usuario, check disponibilidad, calc duración
- [x] 2.4 `CambiarEstadoUseCase` — delegate to CitaEntity state machine
- [x] 2.5 `CancelarCitaUseCase` — guard terminal states, set motivoCancelacion
- [x] 2.6 `CompletarCitaUseCase` — transition CONFIRMADA→COMPLETADA
- [x] 2.7 `ListBloqueosUseCase` — optional usuarioId filter, include salon-wide
- [x] 2.8 `CreateBloqueoUseCase` — validate range, reject scope overlap
- [x] 2.9 `DeleteBloqueoUseCase` — find-or-404, delete
- [x] 2.10 `GetHorarioUseCase` — return 7-day schedule with defaults
- [x] 2.11 `UpsertHorarioUseCase` — accept 7-day array, upsert all

## Phase 3: Presentation + Wiring

- [x] 3.1 `CitaController` — list, get, create, cambiarEstado, cancelar, completar
- [x] 3.2 `DisponibilidadController` — verificar, obtenerSlots
- [x] 3.3 `BloqueoController` — list, create, delete
- [x] 3.4 `HorarioController` — get, upsert
- [x] 3.5 `agenda.routes.ts` — 13 routes with guards per design table
- [x] 3.6 Register all repos, service, use cases, controllers in `container.ts`
- [x] 3.7 Mount `agendaRouter` in `app.ts` after personas

## Phase 4: Tests

- [x] 4.1 Unit: `DisponibilidadService` — all overlap scenarios (horario, bloqueo, cita)
- [x] 4.2 Unit: `CambiarEstadoUseCase` — all 5 transitions + terminal rejection
- [ ] 4.3 Integration: Create cita — success, overlap 409, missing cliente 404
- [ ] 4.4 Integration: Bloqueo CRUD — create, overlap reject, delete, 404
- [ ] 4.5 Integration: Horario — upsert 7 days, partial update, closed day
- [ ] 4.6 Route/guard: supertest with mock JWT per role requirement
