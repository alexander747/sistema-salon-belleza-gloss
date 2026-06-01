# Design: Agenda Citas — Module Architecture

## Technical Approach

Create a single `agenda` module following the existing catalogo/personas pattern: domain ports → TypeORM repos → application use cases → presentation controllers → routes. Inject `DisponibilidadService` as a shared service into `CreateCitaUseCase`, `VerificarDisponibilidadUseCase`, and `ObtenerSlotsDisponiblesUseCase`.

## Architecture Decisions

| Decision | Choice | Alternatives | Rationale |
|----------|--------|-------------|-----------|
| Module granularity | Single `agenda` module with 4 controllers | Separate citas/disponibilidad modules | Citas, disponibilidad, bloqueos, horarios are tightly coupled — they share overlap logic and a unified route prefix `/agenda` |
| Duration calculation | `SUM(servicios.duracionMinutos)` per cita, fetched eagerly at overlap-check time | Store `duracionCalculada` on cita | Dynamic calculation ensures correctness when servicio durations change. Hardcoded 60 min was the pos-ok bug |
| Overlap check order | Horario → Bloqueos → Citas | All checks in parallel | Fail-fast saves DB queries. Horario is cheapest (single row by diaSemana), bloqueos are filtered by scope, citas may be many |
| Bloqueo scope | `usuarioId=null` = salon-wide; `usuarioId={n}` = per-employee | Separate `bloqueos_salon` table | Simpler: one query with `WHERE (usuarioId = :uid OR usuarioId IS NULL)` covers both |
| State machine | `cambiarEstado()` method on `CitaEntity` + guard in use case | External state machine library | 5 states, 5 transitions — no library needed. Entity method keeps domain logic colocated |
| DisponibilidadService | Shared `@injectable()` class, no interface | Port/implementation split | Service is pure logic (no I/O), no benefit from interface. Same pattern as BcryptService |

## Overlap Detection Algorithm

```typescript
// In DisponibilidadService
async isSlotAvailable(salonId, usuarioId, fechaInicio, duracionMinutos) {
  const fechaFin = new Date(fechaInicio.getTime() + duracionMinutos * 60000);

  // 1. Horario comercial (by diaSemana)
  const horario = await horarioRepo.findBySalonAndDay(salonId, fechaInicio.getDay());
  if (!horario?.estaAbierto) return { disponible: false, motivo: "Salón cerrado este día" };
  if (horaInicio < horario.horaApertura || horaFin > horario.horaCierre)
    return { disponible: false, motivo: "Fuera del horario comercial" };

  // 2. Bloqueos (employee + salon-wide)
  const bloqueos = await bloqueoRepo.findOverlapping(salonId, usuarioId, fechaInicio, fechaFin);
  if (bloqueos.length > 0) return { disponible: false, motivo: "Bloqueo de agenda" };

  // 3. Existing citas (PENDIENTE|CONFIRMADA) same usuario
  const citas = await citaRepo.findActiveByUsuario(salonId, usuarioId);
  const overlap = citas.some(c => c.fechaInicio < fechaFin && c.fechaFin > fechaInicio);
  if (overlap) return { disponible: false, motivo: "Conflicto con cita existente" };

  return { disponible: true };
}
```

## State Machine

```
PENDIENTE ──→ CONFIRMADA
PENDIENTE ──→ CANCELADA
CONFIRMADA ──→ COMPLETADA
CONFIRMADA ──→ NO_LLEGO
CONFIRMADA ──→ CANCELADA

Terminal: COMPLETADA, CANCELADA, NO_LLEGO → any transition → 422
```

## File Tree

```
apps/api/src/modules/agenda/
├── domain/ports/
│   ├── ICitaRepository.ts
│   ├── IBloqueoAgendaRepository.ts
│   └── IHorarioComercialRepository.ts
├── application/
│   ├── dtos/
│   │   ├── CitaDTO.ts
│   │   ├── BloqueoAgendaDTO.ts
│   │   ├── HorarioComercialDTO.ts
│   │   └── DisponibilidadResultDTO.ts
│   ├── services/
│   │   └── DisponibilidadService.ts
│   └── use-cases/
│       ├── cita/
│       │   ├── ListCitasUseCase.ts
│       │   ├── GetCitaUseCase.ts
│       │   ├── CreateCitaUseCase.ts
│       │   ├── CambiarEstadoUseCase.ts       # state machine guard
│       │   ├── CancelarCitaUseCase.ts         # sets motivoCancelacion
│       │   └── CompletarCitaUseCase.ts        # alias + sets estado
│       ├── bloqueo/
│       │   ├── ListBloqueosUseCase.ts
│       │   ├── CreateBloqueoUseCase.ts
│       │   └── DeleteBloqueoUseCase.ts
│       └── horario/
│           ├── GetHorarioUseCase.ts
│           └── UpsertHorarioUseCase.ts
├── infrastructure/persistence/
│   ├── TypeORMCitaRepository.ts
│   ├── TypeORMBloqueoAgendaRepository.ts
│   └── TypeORMHorarioComercialRepository.ts
└── presentation/
    ├── controllers/
    │   ├── CitaController.ts
    │   ├── DisponibilidadController.ts
    │   ├── BloqueoController.ts
    │   └── HorarioController.ts
    └── routes/
        └── agenda.routes.ts
```

## Routes

| Method | Path | Guards | Handler |
|--------|------|--------|---------|
| GET | `/agenda/citas` | authGuard+tenantGuard | CitaController.list |
| POST | `/agenda/citas` | +requireRole(DUEÑA,ADMIN,RECEPCIONISTA) | CitaController.create |
| GET | `/agenda/citas/:id` | authGuard+tenantGuard | CitaController.get |
| PATCH | `/agenda/citas/:id/estado` | +requireRole(DUEÑA,ADMIN,RECEPCIONISTA) | CitaController.cambiarEstado |
| PATCH | `/agenda/citas/:id/cancelar` | +requireRole(DUEÑA,ADMIN,RECEPCIONISTA) | CitaController.cancelar |
| PATCH | `/agenda/citas/:id/completar` | +requireRole(DUEÑA,ADMIN,RECEPCIONISTA) | CitaController.completar |
| GET | `/agenda/disponibilidad` | authGuard+tenantGuard | DisponibilidadController.verificar |
| GET | `/agenda/disponibilidad/slots` | authGuard+tenantGuard | DisponibilidadController.obtenerSlots |
| GET | `/agenda/bloqueos` | authGuard+tenantGuard | BloqueoController.list |
| POST | `/agenda/bloqueos` | +requireRole(DUEÑA,ADMIN) | BloqueoController.create |
| DELETE | `/agenda/bloqueos/:id` | +requireRole(DUEÑA,ADMIN) | BloqueoController.delete |
| GET | `/agenda/horarios` | authGuard+tenantGuard | HorarioController.get |
| PUT | `/agenda/horarios` | +requireRole(DUEÑA,ADMIN) | HorarioController.upsert |

Mount in `app.ts`: `app.use('/api/salones/:salonId', agendaRouter)` after personas.

## DI Container Additions (container.ts)

```
// Repositories
container.register('ICitaRepository', { useClass: TypeORMCitaRepository });
container.register('IBloqueoAgendaRepository', { useClass: TypeORMBloqueoAgendaRepository });
container.register('IHorarioComercialRepository', { useClass: TypeORMHorarioComercialRepository });

// Services
container.register(DisponibilidadService, { useClass: DisponibilidadService });

// Use Cases — Cita
container.register(ListCitasUseCase, { useClass: ListCitasUseCase });
container.register(GetCitaUseCase, { useClass: GetCitaUseCase });
container.register(CreateCitaUseCase, { useClass: CreateCitaUseCase });
container.register(CambiarEstadoUseCase, { useClass: CambiarEstadoUseCase });
container.register(CancelarCitaUseCase, { useClass: CancelarCitaUseCase });
container.register(CompletarCitaUseCase, { useClass: CompletarCitaUseCase });

// Use Cases — Bloqueo (3)
// Use Cases — Disponibilidad (2)
// Use Cases — Horario (2)

// Controllers (4)
```

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit | DisponibilidadService overlap math | Pure function tests with stubbed repos |
| Unit | State machine transitions | CambiarEstadoUseCase test with CitaEntity in each state |
| Integration | Full create/verify/slots flow | Test containers with MySQL, real repos |
| Integration | Route guards | Supertest with mock JWT |
