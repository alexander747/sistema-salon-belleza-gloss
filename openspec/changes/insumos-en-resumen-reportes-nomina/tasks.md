# Tasks: Insumos en resumen, reportes y nómina

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~780 (backend ~230, frontend ~290, nómina ~250, spec ~10) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR1 backend → PR2 frontend → PR3 nómina |
| Delivery strategy | auto-chain |
| Chain strategy | feature-branch-chain |
| Decision needed before apply | Resolved — owner decision 2026-09-29 (Reportes = privileged vía 403; `resumen` omite insumos+balanceNeto; sin stripping) |

Decision needed before apply: Resolved (owner decision)
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | PR | Base branch | Notes |
|------|------|----|-------------|-------|
| 1 | Backend role-gating policy | PR 1 | `feat/insumos-reportes-tracker` | Branch `feat/insumos-reportes-pr1-backend`; tests with code |
| 2 | Frontend card/export gating | PR 2 | `feat/insumos-reportes-pr1-backend` | helper + types + cards |
| 3 | Nómina informational insumo | PR 3 | `feat/insumos-reportes-pr2-frontend` | use case + UI + tests |

## Phase 1: Backend role policy (PR1)

Owner decision (supersedes earlier field-omission on `pyl`):
- Reportes completo = DUEÑA, ADMINISTRADOR, CONTADOR, SUPERADMIN.
- `GET /finanzas/pyl` y `GET /finanzas/exportar` → `requireRole(PRIVILEGED)` (403 al resto). Sin stripping de columnas.
- `GET /finanzas/resumen` → sigue accesible; para no privilegiados omite `totalCostoBaseInsumos` **y** `balanceNeto` (derivable).
- UNA sola fuente de roles privilegiados reutilizada por las tres compuertas.

- [x] 1.1 RED: `privilegedRoles.test.ts` (true 4 roles, false others/null); `ReporteController.test.ts` absence assertions for resumen; `finanzas.reportes-role.test.ts` (supertest 403/200); guard assertions en `finanzas.routes.test.ts`.
- [x] 1.2 Create `apps/api/src/presentation/middleware/privilegedRoles.ts` with `PRIVILEGED_ROLES_LIST`, `PRIVILEGED_ROLES` (derivado) y `isPrivilegedRole(rol)`.
- [x] 1.3 Replace duplicated sets in `RegistroController.ts:11` / `ReporteController.ts:16` with imports; use `isPrivilegedRole(req.user?.rol)`.
- [x] 1.4 `ReporteController.resumenDia`: omit `totalCostoBaseInsumos` + `balanceNeto` for non-privileged (clave ausente).
- [x] 1.5 `finanzas.routes.ts`: guard `/finanzas/pyl` con `requireRole(...PRIVILEGED_ROLES_LIST)` (403 al resto). Sin omisión de campos.
- [x] 1.6 `finanzas.routes.ts`: guard `/finanzas/exportar` con `requireRole(...PRIVILEGED_ROLES_LIST)`; tests de ruta actualizados.
- [x] 1.7 `ResumenDiaUseCase.test.ts`: reconciliación 555000−267600−84000=203400 (fixture lucía), ANULADO=0, sin registros=0.
- [x] 1.8 Artifact sync: delta specs `finanzas-reportes` (resumen omite 2 claves; pyl/exportar 403; nuevo requirement exportar), `design.md`, `tasks.md`, `proposal.md`.
- [x] 1.9 GREEN: `cd apps/api && npx vitest run` + `npx tsc --noEmit`.

## Phase 2: Frontend role gating (PR2)

- [x] 2.1 RED: extend `roles.test.ts`; add FinanzasPage card/export gate tests; update `FinanzasPage.test.tsx:475` to assert button absent.
- [x] 2.2 Extend `utils/roles.ts` with `PRIVILEGED_ROLES` + `isPrivilegedRole(user)`; `ROLES_CUENTAS` references it.
- [x] 2.3 `FinanzasPage.tsx`: optional HTTP types (`FinanzasResumen:30`, `PyLData:183-191`).
- [x] 2.4 Replace inline `isPrivileged` (`:642-646`, `:4153-4158`) with helper.
- [x] 2.5 Registros: render `🧴 Total insumos` only when privileged, value `resumen.totalCostoBaseInsumos ?? 0`.
- [x] 2.6 Reportes: hide the whole tab for non-privileged (owner decision: Reportes = privileged); hide `📥 Exportar Excel`.
- [x] 2.7 GREEN: `cd apps/pos-dashboard && npx vitest run` (384 passed / 2 fallas pre-existentes) + `tsc --noEmit` (0 errores).

Commit: 907df06 (feat frontend).

## Phase 3: Nómina informational insumo (PR3) — DONE

- [x] 3.1 RED: `NominaPendienteUseCase.test.ts` — 84000 (fixture lucía), ANULADO/sin items=0, scoping por `delPeriodo`, fuera de período 50000 excluido, `totalAPagar` unchanged.
- [x] 3.2 Add optional `totalCostoBaseInsumos?: number` to `NominaPendienteEmpleada` and `NominaPendienteDTO`.
- [x] 3.3 `NominaPendienteUseCase`: reduce same `delPeriodo`, `Math.round`, push; `totalAPagar` untouched.
- [x] 3.4 `FinanzasPage.tsx`: optional `NominaEmpleado` type; employee card `Insumos (ya descontados de la comisión)` when present; summary card `🧴 Total insumos` over `pendientesFiltrados`; ambas solo para roles privilegiados (`isPrivilegedRole`).
- [x] 3.5 RED/GREEN component tests: label present with value (DUEÑA), absent for MANICURISTA, absent when field missing.
- [x] 3.6 GREEN: api (611 passed / 5 pre-existentes) + dashboard (387 passed / 2 pre-existentes) `npx vitest run` + both `tsc --noEmit` (api: 1 pre-existente seed.ts; dashboard: 0).

## Phase 4: Spec sync + archive note

- [x] 4.1 Update `specs/finanzas-reportes/spec.md`: `resumen` omite `totalCostoBaseInsumos`+`balanceNeto`; `pyl`/`exportar` 403; nuevo requirement de exportación. (Done in PR1.)
- [x] 4.2 Confirm rollback code-only (no migration) and proposal success criteria.

## Phase 5: Fix B-1 — nómina insumo siempre 0 (PR4) — DONE

`sdd-verify` bloqueó el deploy: `NominaPendienteUseCase` suma `serviciosItems[].costoBaseInsumos`
sobre los registros que devuelve `findBySalon`, pero esa consulta no cargaba la relación →
`totalCostoBaseInsumos` era siempre 0 en runtime. Los tests de PR3 lo enmascaraban inyectando
`serviciosItems` en el mock del repositorio.

- [x] 5.1 Listar consumidores de `IRegistroServicioRepository.findBySalon`: **único** consumidor `NominaPendienteUseCase` (`ResumenDiaUseCase` usa `findBySalonAndDateRange`, que ya carga `serviciosItems`). Opción (a) — agregar la relación — es segura y la menos invasiva.
- [x] 5.2 RED: test de borde de repositorio que asserta que `findBySalon` pasa `relations` incluyendo `serviciosItems` (`TypeORMRegistroServicioRepository.test.ts`).
- [x] 5.3 GREEN: agregar `'serviciosItems'` a las `relations` de `findBySalon` (sin migración, una sola línea + comentario).
- [x] 5.4 TRIANGULATE: segundo caso (salonId distinto) que fija `where: { salonId }` + `order: { creadoEn: 'DESC' }`.
- [x] 5.5 Prueba runtime: `docker restart posfinal-api`; `GET /api/salones/1/finanzas/nomina` (DUEÑA) → lucía período `2026-09-01→09-16`: `totalCostoBaseInsumos = 84000` (antes `0`), `totalAPagar = 297600` sin cambios.
- [x] 5.6 GREEN: `cd apps/api && npx vitest run` (613 passed / 5 fallas baseline en `NominaPendienteUseCase.test.ts`) + `npx tsc --noEmit` (exit 2, 1 error baseline `seed.ts`).

## Phase 6: Fix paginación de Registros (PR5) — DONE

Bug reportado por el owner (verificado con data real): en el período 2026-09-04..2026-09-29
(salón 1) hay **26** registros (15 activos + 11 anulados), pero la pestaña Registros mostraba
"26 registros" en la paginación y ~15 filas: el backend (`search`/`count`) no filtraba por
`estado`/`tipo` y el frontend filtraba client-side sobre una página paginada en servidor.

- [x] 6.1 RED backend: `TypeORMRegistroServicioRepository.test.ts` — `count` ACTIVOS excluye ANULADO, ANULADOS solo ANULADO, TODOS/ausente sin cláusula, `tipo` SERVICIOS/PRODUCTOS; **`search` y `count` aplican criterios idénticos**.
- [x] 6.2 RED backend: `ListRegistrosUseCase.test.ts` (nuevo) — reenvía `estado`/`tipo` a `search` Y `count`; sin params usa `TODOS`; `meta.total` = count del filtro (independiente del recorte de página).
- [x] 6.3 RED backend: `RegistroController.test.ts` — parsea `estado`/`tipo` válidos; inválidos/ausentes ⇒ `TODOS`.
- [x] 6.4 Domain: `IRegistroServicioRepository` — tipos `EstadoRegistroFilter`/`TipoRegistroFilter` y params `estado`/`tipo` en `search` y `count`.
- [x] 6.5 Repo: método privado único `aplicarFiltrosRegistro` usado por `search` y `count` (imposible divergir). Default (`TODOS`/ausente) = sin cláusula.
- [x] 6.6 Use case: `ListRegistrosInput.estado/tipo`, default `TODOS`, mismos valores a `search` y `count`.
- [x] 6.7 Controller: zod inline `REGISTRO_FILTERS_SCHEMA` (`.catch('TODOS')`), defaults y reenvío.
- [x] 6.8 RED/GREEN frontend: `FinanzasPage.test.tsx` (nuevo describe) — envía `estado`/`tipo`; total = `meta.total` del filtro (15/11/26); cambiar Activos→Anulados→Todos re-consulta; NO filtra client-side (renderiza la ANULADA si el server la manda).
- [x] 6.9 Frontend: `regParams.estado/tipo`; eliminado el `useMemo` `filteredRegistros` (se usa `registros`); `registroEstadoFilter` agregado a deps de `fetchData`; el botón de tipo resetea a página 1.
- [x] 6.10 Artifact sync: delta `finanzas-registros` (requirement de paginación server-side + escenarios), `design.md` (D6) y esta Phase 6.
- [x] 6.11 GREEN: `cd apps/api && npx vitest run` (623 passed / 5 baseline) + `npx tsc --noEmit` (1 baseline `seed.ts`); `cd apps/pos-dashboard && npx vitest run` (391 passed / 2 baseline) + `npx tsc --noEmit` (0).
- [x] 6.12 Prueba runtime (API :3001, DB local = prod): `GET /salones/1/registros` período 2026-09-04..09-29 → ACTIVOS `meta.total=15`/15 filas, ANULADOS `11`/11, TODOS `26`/26, SERVICIOS `25`, PRODUCTOS `1`; sin params `26` (compat). `meta.total == filas` en todos.

