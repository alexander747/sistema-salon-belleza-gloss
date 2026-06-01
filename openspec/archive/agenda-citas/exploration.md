## Exploration: Agenda de Citas — Core Booking System

### Current State

El sistema ya tiene las entidades y tablas creadas en la migración inicial (`1700000000000-InitialSchema.ts`):

- **`citas`** — tabla completa con FK a salones, usuarios, clientes; enum de estado con 5 valores; join table `citas_servicios` para M:N con servicios.
- **`bloqueos_agenda`** — soporta bloqueos parciales/totales, con `usuarioId` nullable (bloqueo global del salón).
- **`horarios_comerciales`** — 7 filas por salón (diaSemana 0-6), horaApertura/horaCierre como string "HH:mm".
- **`citas_servicios`** — join table con unique index en (citaId, servicioId).

Las entidades TypeORM (`CitaEntity`, `BloqueoAgendaEntity`, `HorarioComercialEntity`) están definidas pero **no hay módulo de agenda** — no existen repositorios, casos de uso, controladores, ni rutas. Toda la lógica de agenda vive en el viejo proyecto `pos-ok` como controlador plano (`n8nControlador.ts`) sin clean architecture.

El proyecto actual sigue **Clean Architecture** con módulos en `apps/api/src/modules/`:
- Cada módulo tiene `domain/ports/`, `application/use-cases/`, `infrastructure/persistence/`, `presentation/`
- DI con tsyringe, registrado centralizadamente en `shared/container.ts`
- Validación con Zod en `packages/validation/`
- Rutas montadas en `app.ts` bajo `/api/salones/:salonId/`

### Affected Areas

- `apps/api/src/modules/agenda/` — **nuevo módulo completo** (domain, application, infrastructure, presentation)
- `apps/api/src/shared/container.ts` — registrar nuevas dependencias
- `apps/api/src/app.ts` — montar `agendaRouter` en `/api/salones/:salonId/agenda`
- `packages/validation/src/` — nuevos schemas de validación (agenda.schema.ts)
- `packages/validation/src/index.ts` — exportar nuevos schemas
- `apps/web/` — pendiente de definir (no existe aún; frontend es trabajo futuro)
- `apps/api/src/infrastructure/persistence/entities/CitaEntity.ts` — ya existe, sin cambios necesarios
- `apps/api/src/infrastructure/persistence/entities/BloqueoAgendaEntity.ts` — ya existe
- `apps/api/src/infrastructure/persistence/entities/HorarioComercialEntity.ts` — ya existe
- El controlador de referencia `n8nControlador.ts` (pos-ok) contiene la lógica de disponibilidad a portar/refinar

### Use Case Inventory

#### 1. Citas (CRUD + State Machine)

| Use Case | Description | Input | Output |
|----------|-------------|-------|--------|
| `ListCitasUseCase` | Listar citas con filtros | salonId, desde?, hasta?, usuarioId?, estado?, clienteId? | CitaDTO[] |
| `GetCitaUseCase` | Obtener cita por ID | salonId, id | CitaDTO |
| `CreateCitaUseCase` | Crear cita + validar disponibilidad | salonId, fechaHora, clienteId, usuarioId, serviciosIds[], notas? | CitaDTO |
| `CambiarEstadoCitaUseCase` | Transición de estado (state machine) | salonId, id, nuevoEstado, motivoCancelacion? | CitaDTO |
| `CancelCitaUseCase` | Cancelar con motivo | salonId, id, motivo | CitaDTO |
| `CompletarCitaUseCase` | Marcar como completada | salonId, id | CitaDTO |

**State Machine** (transiciones válidas):
```
PENDIENTE ──► CONFIRMADA
PENDIENTE ──► CANCELADA
CONFIRMADA ──► COMPLETADA
CONFIRMADA ──► NO_LLEGO
CONFIRMADA ──► CANCELADA
CANCELADA, COMPLETADA, NO_LLEGO → terminal (sin transiciones salientes)
```

#### 2. Disponibilidad

| Use Case | Description | Input | Output |
|----------|-------------|-------|--------|
| `VerificarDisponibilidadUseCase` | Verificar slot específico | salonId, usuarioId, fecha, hora, duracionMinutos | { disponible, motivo? } |
| `ObtenerSlotsDisponiblesUseCase` | Generar slots libres para un día | salonId, usuarioId, fecha | DisponibilidadDTO[] |

**Lógica de verificación** (basada en n8nVerificarDisponibilidad, mejorada):
1. Parsear fecha/hora cuidando zona horaria
2. Verificar horario comercial (diaSemana coincide, estaAbierto=true, slot dentro de horaApertura-horaCierre)
3. Verificar bloqueos (usuarioId específico OR usuarioId IS NULL para el salón, overlap de rangos)
4. Verificar citas existentes (estado IN (PENDIENTE, CONFIRMADA), overlap de rangos con duración real)
5. **Mejora respecto al original**: calcular duración real de cada cita existente desde sus servicios (no hardcodear 60 min)

#### 3. Bloqueos de Agenda

| Use Case | Description | Input | Output |
|----------|-------------|-------|--------|
| `ListBloqueosUseCase` | Listar bloqueos | salonId, usuarioId? | BloqueoDTO[] |
| `CreateBloqueoUseCase` | Crear bloqueo | salonId, fechaInicio, fechaFin, tipo, motivo?, usuarioId? | BloqueoDTO |
| `DeleteBloqueoUseCase` | Eliminar bloqueo | salonId, id | void |

#### 4. Horarios Comerciales

| Use Case | Description | Input | Output |
|----------|-------------|-------|--------|
| `ListHorariosUseCase` | Obtener horarios del salón | salonId | HorarioDTO[] |
| `UpdateHorarioUseCase` | Actualizar/crear horario para un día | salonId, diaSemana, horaApertura?, horaCierre?, estaAbierto? | HorarioDTO |

### Proposed Routes

Todas bajo el prefix `/api/salones/:salonId/agenda`:

```
# Citas
GET      /citas                         → ListCitasUseCase (filtros: desde, hasta, usuarioId, estado, clienteId)
GET      /citas/:id                     → GetCitaUseCase
POST     /citas                         → CreateCitaUseCase (validar disponibilidad primero)
PATCH    /citas/:id/estado              → CambiarEstadoCitaUseCase
PATCH    /citas/:id/cancelar            → CancelCitaUseCase
PATCH    /citas/:id/completar           → CompletarCitaUseCase

# Disponibilidad
GET      /disponibilidad                → VerificarDisponibilidadUseCase (query: usuarioId, fecha, hora, duracionMinutos)
GET      /disponibilidad/slots          → ObtenerSlotsDisponiblesUseCase (query: usuarioId, fecha)

# Bloqueos
GET      /bloqueos                      → ListBloqueosUseCase (query: usuarioId?)
POST     /bloqueos                      → CreateBloqueoUseCase
DELETE   /bloqueos/:id                  → DeleteBloqueoUseCase

# Horarios Comerciales
GET      /horarios                      → ListHorariosUseCase
PUT      /horarios/:diaSemana           → UpdateHorarioUseCase
```

### n8n Integration

El módulo de agenda debe exponer la misma funcionalidad que el WhatsApp bot necesita. Dado que las rutas n8n (`/api/n8n`) ya están montadas con `apiKeyGuard` en `app.ts`, hay dos enfoques:

1. **Reutilizar los mismos controladores**: Las rutas de agenda bajo `/api/n8n/agenda` pueden usar los mismos casos de uso inyectados. Esto evita duplicación.
2. **Controladores separados**: Crear `AgendaN8nController` que delegue a los mismos casos de uso.

**Recomendación**: Opción 1 — los casos de uso son reutilizables. Las rutas n8n pueden ser simplemente alias que usen los mismos controllers del módulo agenda, o podemos agregar las rutas n8n dentro del módulo agenda montadas bajo otro path. Lo más limpio es que los endpoints n8n existentes redirijan o usen los mismos casos de uso.

### Frontend Page Inventory

⚠️ **Nota**: `apps/web` no existe actualmente — no hay frontend implementado. El frontend de agenda será parte de un trabajo separado. Lo que sigue es el inventario de páginas necesarias:

1. **Agenda Page** (`/agenda`): Calendario day/week view con citas del salón
   - Filtro por empleada (dropdown)
   - Cada cita muestra: hora, cliente, servicios, estado (con color)
   - Click en cita → modal con detalle y acciones (confirmar, cancelar, completar)
   - Click en slot vacío → modal de nueva cita
   - Navegación entre días

2. **Nueva Cita Modal**: Selector de empleada, cliente, servicios, fecha/hora, con verificación de disponibilidad en tiempo real

3. **Bloqueos Page** (modal o sección): CRUD rápido de bloqueos

4. **Horarios Page** (settings): Editor de horario comercial, 7 días de la semana

### Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| **Overlap detection incorrecto**: el n8n original hardcodea 60 min para citas existentes en lugar de calcular duración real desde servicios M:N | **HIGH** | Calcular `SUM(s.duracionMinutos)` de servicios asociados en la query de overlap; eager-load servicios en todas las queries de citas |
| **Concurrent booking race condition**: dos requests simultáneas pueden crear citas en el mismo slot | **MEDIUM** | Usar `SELECT ... FOR UPDATE` (pessimistic lock) en la transacción de creación de cita, o manejar con unique constraint sobre (usuarioId, fechaHora) si se permite |
| **Timezone handling**: fechas almacenadas como DATETIME sin timezone info | **MEDIUM** | Estandarizar a UTC en backend; el frontend convierte a timezone local; mantener la estrategia de parseo manual de `n8nVerificarDisponibilidad` |
| **Manejo de duración**: CitaEntity no tiene `duracionMinutos` propio; depende enteramente de la suma de servicios | **MEDIUM** | Crear helper `calcularDuracionCita(cita: CitaEntity)` que sume `servicios[].duracionMinutos`. Cachear en una property computada si el rendimiento lo requiere |
| **State machine enforcement**: transiciones inválidas (ej. COMPLETADA → PENDIENTE) | **LOW** | `CambiarEstadoCitaUseCase` implementa mapa estricto de transiciones válidas y lanza `UnprocessableEntityError` |
| **N+1 queries**: al listar citas con servicios para calcular duración | **LOW** | Usar `leftJoinAndSelect('c.servicios', 'servicios')` en todas las queries de lista |
| **Bloqueos sin fin**: bloqueo con fechaFin < fechaInicio o bloqueos que abarcan días completos vs parciales | **LOW** | Validar en `CreateBloqueoUseCase` que `fechaFin > fechaInicio`. Para bloqueos totales, definir semántica clara (todo el día = 00:00-23:59) |
| **Rendimiento en agenda con muchos datos**: consultar slots disponibles requiere múltiples queries | **LOW** | Optimizar con índices compuestos en (salonId, usuarioId, fechaHora, estado). Cachear horarios comerciales (solo 7 filas) |

### Approaches

1. **Modular completo con Clean Architecture (recomendado)**
   - Nuevo módulo `agenda/` siguiendo el patrón exacto de `catalogo/` y `personas/`
   - Repositorios, use cases, DTOs, controller, routes
   - Reusa la lógica de disponibilidad del n8n original pero con overlap corregido
   - Pros: Consistente con el resto del códigobase, testeable, extensible
   - Cons: Mayor cantidad de archivos (pero es el estándar del proyecto)
   - Effort: **High** (~12-15 archivos de use cases + repos + dtos + controllers + routes + schemas)

2. **Controlador plano (como n8n original)**
   - Un solo controlador con toda la lógica, similar al `n8nControlador.ts`
   - Pros: Rápido de escribir, menos archivos
   - Cons: Rompe la arquitectura del proyecto, no testeable, difícil de mantener
   - Effort: **Low** (~3-4 archivos)

3. **Híbrido: use cases ligeros + lógica de disponibilidad en un helper**
   - CRUD de citas con use cases simples; lógica de disponibilidad como servicio separado
   - Pros: Balance entre arquitectura limpia y pragmatismo
   - Cons: Inconsistencia interna del módulo
   - Effort: **Medium** (~8-10 archivos)

### Approach Comparison

| Criterio | Clean Architecture | Controlador Plano | Híbrido |
|----------|-------------------|-------------------|---------|
| Consistencia con el proyecto | ✅ Excelente | ❌ Mala | ⚠️ Parcial |
| Testeabilidad | ✅ Alta (use cases puros) | ❌ Baja (acoplamiento HTTP) | ⚠️ Media |
| Mantenibilidad | ✅ Alta (separación clara) | ❌ Baja (todo mezclado) | ⚠️ Media |
| Velocidad inicial | ❌ Más archivos | ✅ Rápido | ⚠️ Medio |
| Riesgo de bugs | ✅ Bajo (código organizado) | ⚠️ Medio (lógica manual) | ⚠️ Medio |
| Reutilización n8n | ✅ Los use cases sirven a ambos | ❌ Duplicación | ⚠️ Parcial |

### Recommendation

**Approach 1 — Clean Architecture completa.** El proyecto ya tiene este patrón establecido en 4 módulos (catalogo, personas, auth, salon). Crear un módulo `agenda/` con la misma estructura es la única opción que mantiene consistencia arquitectónica. La lógica de disponibilidad debe ir en un `VerificarDisponibilidadUseCase` con un helper `SlotCalculator` para la matemática de overlaps. El controlador original de n8n sirve como especificación viva de la lógica esperada.

### Effort Estimation

- Domain ports: 3 interfaces (~1h)
- TypeORM repositories: 3 implementaciones (~2h)
- Use cases: ~12 use cases (~6h)
- DTOs: 4 clases (~1h)
- Validation schemas: ~8 schemas Zod (~1h)
- Controllers: 4 controladores (~2h)
- Routes + DI registration: ~1h
- State machine logic + slot calculator helper: ~2h
- Tests (unit + integration): ~4h
- **Total estimado: ~20h de desarrollo**

### Ready for Proposal
**Yes** — el exploration tiene suficiente profundidad para pasar a proposal. El orchestrator debe presentar el use case inventory y el approach recomendado al usuario para confirmar alcance antes de pasar a spec.

### Key Technical Decisions to Confirm in Proposal

1. ¿CitaEntity necesita un campo `duracionMinutos` calculado/cacheado o siempre se calcula desde servicios M:N?
2. ¿Estrategia de concurrencia para evitar booking duplicado? (optimistic locking vs FOR UPDATE)
3. ¿Los endpoints n8n existentes se migran a usar los mismos casos de uso del módulo agenda?
4. ¿Frontend de agenda se incluye en este cambio o se difiere? (apps/web no existe)
5. ¿Se necesita paginación en `ListCitasUseCase` o el volumen de datos lo permite sin paginar?
