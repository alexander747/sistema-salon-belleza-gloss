# Design: Cuentas por Cobrar y Pagar (read-only v1)

## Technical Approach

Dos endpoints GET read-only + tab de dashboard, sin cambios de schema. **Cobrar**: nuevo método de repo `findConDeudaBySalon` (query con join a `cliente`, filtro `montoPendiente > 0` y `estado != 'ANULADO'`); agregación en JS por `clienteId`; antigüedad desde `min(creadoEn)` con timezone Colombia; orden DESC + `paginate()`. **Pagar**: composición de `NominaPendienteUseCase` (pendiente actual) + `HistorialLiquidacionesUseCase` (suma `totalPagado` por empleada). Ambos detrás de `requireRole(SUPERADMIN, DUEÑA, ADMINISTRADOR, CONTADOR)`.

## Architecture Decisions

| # | Decisión | Alternativas | Elección | Rationale |
|---|----------|--------------|----------|-----------|
| D1 | Fuente de deuda | `cliente.deudaTotal` (columna) vs `SUM(montoPendiente)` | `SUM(montoPendiente)` computado | La columna deriva: devoluciones no la tocan y descuentos inflan `montoPendiente`. Computar es self-healing (D7 follow-ups). |
| D2 | Dónde agregar | SQL `GROUP BY` vs JS | JS en use case | Datos por salón son acotados; query única sin SQL nativo; reutiliza DTOs existentes. |
| D3 | Repo query | Extender `findBySalon` (cargar relaciones a todos los callers) | Nuevo método `findConDeudaBySalon` | `findBySalon` no carga `cliente` (solo pagos/divisiones) y lo usan nómina y reportes; no tocar callers existentes. |
| D4 | Pagar: fuente | Query nueva de liquidaciones + usuarios | Composición de use cases existentes | Reusa lógica de roles/frontera de mes de nómina; cero duplicación. |
| D5 | Enforce de roles | Check inline en controller | `requireRole` en rutas | Patrón ya usado en `finanzas.routes.ts`; 403 automático. |
| D6 | Antigüedad tz | Fecha local del servidor | Helpers `colombia-date.ts` | Día de negocio es Colombia (UTC-5); helpers ya existen y evitan skew. |
| D7 | Consistencia deuda | Corregir bugs ahora | Documentar como follow-ups | Fuera de scope v1; comentario en use case + sección FOLLOW-UP del proposal. |

## Data Flow

```
GET /salones/:id/finanzas/cuentas/cobrar?page&limit
  requireRole(S,D,A,C) → CuentasController.cobrar
    → CuentasCobrarUseCase.execute({ salonId, page, limit })
        → registroRepo.findConDeudaBySalon(salonId)   [SQL: montoPendiente>0 AND estado!=ANULADO + cliente]
        → Map<clienteId, { sum, count, minCreadoEn }>
        → antiguedadDias/bucket (colombia-date)
        → sort deuda DESC → paginate()
    → { data: CuentaCobrarDTO[], meta }

GET /salones/:id/finanzas/cuentas/pagar
  requireRole(S,D,A,C) → CuentasController.pagar
    → CuentasPagarUseCase.execute({ salonId })
        → NominaPendienteUseCase.execute({ salonId })     [pendienteActual por empleada]
        → HistorialLiquidacionesUseCase.execute({ salonId }) → sum totalPagado por usuarioId
        → unión por empleadaId (incluye solo-historial vía usuarioRepo.findBySalon para nombre)
    → CuentaPagarDTO[]
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `apps/api/src/modules/finanzas/domain/ports/IRegistroServicioRepository.ts` | Modify | +`findConDeudaBySalon(salonId): Promise<RegistroServicioEntity[]>` |
| `apps/api/src/modules/finanzas/infrastructure/persistence/TypeORMRegistroServicioRepository.ts` | Modify | QueryBuilder: `leftJoinAndSelect('r.cliente','cliente')` + `where montoPendiente > 0` + `estado != 'ANULADO'` |
| `apps/api/src/modules/finanzas/application/dtos/CuentasDTO.ts` | Create | `CuentaCobrarDTO`, `CuentaPagarDTO`, `AntiguedadBucket` |
| `apps/api/src/modules/finanzas/application/use-cases/cuentas/CuentasCobrarUseCase.ts` | Create | Agregación + buckets + paginación; comentario de follow-ups |
| `apps/api/src/modules/finanzas/application/use-cases/cuentas/CuentasPagarUseCase.ts` | Create | Compone nómina + historial; unión por empleadaId |
| `apps/api/src/modules/finanzas/presentation/controllers/CuentasController.ts` | Create | Handlers `cobrar`/`pagar`; `paginationSchema.safeParse` inline |
| `apps/api/src/modules/finanzas/presentation/routes/finanzas.routes.ts` | Modify | +2 rutas GET con `requireRole(S,D,A,C)` |
| `apps/api/src/shared/container.ts` | Modify | Registro de use cases + controller |
| `apps/pos-dashboard/src/pages/FinanzasPage.tsx` | Modify | TabKey `'cuentas'`, entrada TABS, `CuentasTab` (sub-vistas Cobrar/Pagar) |
| `apps/api/.../cuentas/__tests__/CuentasCobrarUseCase.test.ts` | Create | Unit |
| `apps/api/.../cuentas/__tests__/CuentasPagarUseCase.test.ts` | Create | Unit |
| `apps/api/.../controllers/__tests__/CuentasController.test.ts` | Create | Unit (roles) |
| `apps/pos-dashboard/src/pages/__tests__/FinanzasPage.test.tsx` | Modify | Tab Cuentas |

## Interfaces / Contracts

```ts
type AntiguedadBucket = '0-30' | '31-60' | '61-90' | '90+';

interface CuentaCobrarDTO {
  clienteId: number; nombre: string;
  deudaTotal: number; cantidadRegistros: number;
  antiguedadDias: number; antiguedadBucket: AntiguedadBucket;
}
// Response: PaginatedResult<CuentaCobrarDTO>  (shared/pagination.ts)

interface CuentaPagarDTO {
  empleadaId: number; nombre: string;
  sueldoFijo: number; porcentajeComisionServicio: number;
  pendienteActual: number; liquidadoAcumulado: number;
}
// Response: CuentaPagarDTO[]
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `CuentasCobrarUseCase` — agregación, exclusión anulados/cero, buckets, orden+paginación | Mock `IRegistroServicioRepository` con fechas fijas (spec Req 1, escenarios 1-4) |
| Unit | `CuentasPagarUseCase` — unión, suma acumulada, empleada solo-historial, frontera de mes | Mock `NominaPendienteUseCase` + `HistorialLiquidacionesUseCase` (spec Req 2) |
| Unit | `CuentasController` — 403 roles restringidos, 200 privilegiados, paginación inválida → ValidationError | Mock use cases, assert status (spec Req 3) |
| Frontend | `FinanzasPage.test.tsx` — tab renderiza sub-vistas, sin botones de cobro, paginación 12 | Mock `api.get` (spec Req 4) |

## Migration / Rollout

Sin migración, sin feature flag. Orden: PR1 API (endpoints + tests) → PR2 dashboard (tab + tests). Ambos read-only; reversión trivial removiendo rutas y el tab.

## Open Questions

Ninguna bloqueante. Semántica de frontera de mes de nómina se preserva como está (documentada, no corregida) — decisión del owner.
