# Tasks: Cuentas por Cobrar y Pagar (read-only v1)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~600-750 (PR1 API+tests ~450-550, PR2 UI+tests ~150-200) |
| 400-line budget risk | Medium |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (API + tests) → PR 2 (dashboard tab + tests) |
| Delivery strategy | auto-forecast (orchestrator ya decidió 2 PRs API→UI) |
| Chain strategy | stacked-to-main |

```
Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: Medium
```

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | API: repo + DTOs + use cases + controller + rutas + tests | PR 1 | base=main; cumple spec Req 1-3; incluye todos los tests API |
| 2 | Dashboard: tab Cuentas con sub-vistas + tests | PR 2 | base=main tras merge PR1; cumple spec Req 4 |

## Phase 1: API — Repositorio y DTOs (PR 1)

- [x] 1.1 Agregar `findConDeudaBySalon(salonId)` a `IRegistroServicioRepository`
- [x] 1.2 Implementar en `TypeORMRegistroServicioRepository`: queryBuilder con `leftJoinAndSelect('r.cliente','cliente')` + `where montoPendiente > 0` + `estado != 'ANULADO'`
- [x] 1.3 Crear `CuentasDTO.ts`: `CuentaCobrarDTO`, `CuentaPagarDTO`, `AntiguedadBucket`

## Phase 2: API — Use Cases (PR 1)

- [x] 2.1 Crear `CuentasCobrarUseCase`: agrupa por `clienteId`, suma `montoPendiente`, `min(creadoEn)` → `antiguedadDias`/bucket con `colombia-date.ts`, orden DESC, `paginate()`; comentario de follow-ups (devolución, valorFinal, cobro)
- [x] 2.2 Crear `CuentasPagarUseCase`: inyecta `NominaPendienteUseCase` + `HistorialLiquidacionesUseCase`; suma `totalPagado` por `usuarioId`; unión por `empleadaId` incluyendo solo-historial (nombre vía `IUsuarioRepository.findBySalon`); documento semántica frontera de mes en comentario

## Phase 3: API — Controller, Rutas, DI (PR 1)

- [x] 3.1 Crear `CuentasController` con handlers `cobrar`/`pagar`, `paginationSchema.safeParse` inline (patrón `RegistroController.list`)
- [x] 3.2 Agregar rutas en `finanzas.routes.ts`: `GET /finanzas/cuentas/cobrar` y `GET /finanzas/cuentas/pagar` con `requireRole(SUPERADMIN, DUEÑA, ADMINISTRADOR, CONTADOR)`
- [x] 3.3 Registrar `CuentasCobrarUseCase`, `CuentasPagarUseCase`, `CuentasController` en `apps/api/src/shared/container.ts`

## Phase 4: API — Tests (PR 1)

- [x] 4.1 `CuentasCobrarUseCase.test.ts`: agregación multi-registro, excluye anulado y montoPendiente=0, buckets (0-30/31-60/61-90/90+), orden DESC + paginación (spec Req 1, escenarios 1-4)
- [x] 4.2 `CuentasPagarUseCase.test.ts`: pendiente+acumulado, empleada solo-historial, frontera de mes preservada (spec Req 2)
- [x] 4.3 `CuentasController.test.ts`: 403 para MANICURISTA/RECEPCIONISTA, 200 para CONTADOR, paginación inválida → error (spec Req 3)

## Phase 5: Dashboard — Tab Cuentas (PR 2)

- [x] 5.1 En `FinanzasPage.tsx`: agregar `'cuentas'` a `TabKey` + entrada `'💳 Cuentas'` en `TABS`
- [x] 5.2 Crear `CuentasTab` (patrón sub-tabs de `NominaTab`): sub-vista Cobrar (tabla cliente/deuda/registros/antigüedad, paginación 12) + sub-vista Pagar (tabla empleada/pendiente/liquidado); fetch vía `api.get` con `Promise.allSettled`; sin botones de acción
- [x] 5.3 Renderizar `CuentasTab` en el switch de tabs

## Phase 6: Dashboard — Tests (PR 2)

- [x] 6.1 En `FinanzasPage.test.tsx`: tab Cuentas renderiza sub-vistas con datos mockeados (spec Req 4, escenario 1)
- [x] 6.2 Test: NO hay botones de cobro en sub-vista Cobrar (spec Req 4, escenario 2)

## Dependency Notes

- PR2 depende de PR1 (endpoints deben existir para que el tab cargue).
- Sin cambios en `@pos-final/validation` → no requiere rebuild de `dist/` (evitar gotcha de AGENTS.md).
- `app/api/src/shared/container.ts` (no `container.ts` raíz) es el archivo de DI.
- TDD estricto (`strict_tdd: true`): tests por fase, no al final.
