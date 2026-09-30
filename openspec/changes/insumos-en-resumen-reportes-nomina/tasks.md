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

## Phase 3: Nómina informational insumo (PR3)

- [ ] 3.1 RED: `NominaPendienteUseCase.test.ts` — 84000 (105 g × 800), out-of-period 50000 excluded, no items=0, `totalAPagar`=267600.
- [ ] 3.2 Add optional `totalCostoBaseInsumos?: number` to `NominaPendienteEmpleada` and `NominaPendienteDTO`.
- [ ] 3.3 `NominaPendienteUseCase`: reduce same `delPeriodo` (`:302`/`:316`), `Math.round`, push; `totalAPagar` untouched.
- [ ] 3.4 `FinanzasPage.tsx`: optional `NominaEmpleado` type; employee card `Insumos (ya descontados de la comisión)` when present; summary card `🧴 Total insumos` over `pendientesFiltrados`.
- [ ] 3.5 RED/GREEN component tests: label present with value, absent when field missing.
- [ ] 3.6 GREEN: api + dashboard `npx vitest run` + both `tsc --noEmit`.

## Phase 4: Spec sync + archive note

- [x] 4.1 Update `specs/finanzas-reportes/spec.md`: `resumen` omite `totalCostoBaseInsumos`+`balanceNeto`; `pyl`/`exportar` 403; nuevo requirement de exportación. (Done in PR1.)
- [ ] 4.2 Confirm rollback code-only (no migration) and proposal success criteria.
