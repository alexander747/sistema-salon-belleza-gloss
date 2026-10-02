# Tasks: Permisos de rol — Empleados y Finanzas

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 300–360 |
| 400-line budget risk | Medium |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Frontend matrix, tabs, login landing | PR 1 | dashboard tests included; standalone |
| 2 | Backend gastos/devoluciones/caja guards | PR 1 | API tests included; combined PR fits budget |

## Baseline (record before RED)

- Dashboard: `cd apps/pos-dashboard && npx vitest run` → ≈391 pass, ≤2 known failures.
- API: `cd apps/api && npx vitest run` → ≈623 pass, 5 known date-dependent failures.

## Phase 1: Role matrix (frontend)

- [ ] 1.1 RED: rewrite `utils/roles.test.ts` — MANICURISTA allowed `[agenda, clientes, servicios, finanzas]`, RECEPCIONISTA allowed `[agenda, clientes, ventas, finanzas]`; both denied `/`, empleadas, productos, categorias, prestamos, horarios; add `defaultPageForRol` and guard→`/finanzas` cases. Run dashboard vitest → fails.
- [ ] 1.2 GREEN: edit `src/utils/roles.ts` — trim both `ROLE_PAGES` rows, add `defaultPageForRol`, use it in `resolveRouteGuard` (fallback `/finanzas`). Target file passes.
- [ ] 1.3 RED: update `components/__tests__/LuxeLayout.test.tsx` — Finanzas present, Dashboard/Empleados/Productos/Categorías/Préstamos/Horarios absent for both roles.
- [ ] 1.4 GREEN: no `LuxeLayout.tsx` change — confirm 1.3 passes via `canAccessPage`.

## Phase 2: Finanzas tabs + login landing (frontend)

- [ ] 2.1 RED: update `pages/__tests__/FinanzasPage.test.tsx` — MANICURISTA/RECEPCIONISTA see only `📋 Registros`; `💰 Caja` absent; CONTADOR keeps `caja=false`.
- [ ] 2.2 GREEN: `FinanzasPage.tsx` `puedeVerTab` (≈266) → both operational roles return `tabKey === 'registros'`; update JSDoc.
- [ ] 2.3 RED: update `src/__tests__/App.test.tsx` — MANICURISTA at `/finanzas` stays (no redirect); `/` → `/finanzas`; `/clientes` allowed with no Finanzas in sidebar.
- [ ] 2.4 GREEN: `LoginPage.tsx:25` → `navigate(defaultPageForRol(data.user.rol))`; rerun guard tests.

## Phase 3: Backend guards

- [ ] 3.1 RED: extend `finanzas.routes.test.ts` — `GET /gastos` and `GET /devoluciones` guards equal `PRIVILEGED_ROLES_LIST`; every `/caja/*` guard excludes RECEPCIONISTA (`:id/cierre` adds CONTADOR). Add real-`requireRole` 403/200 cases for gastos/devoluciones in `finanzas.reportes-role.test.ts`.
- [ ] 3.2 GREEN: `finanzas.routes.ts` — add `requireRole(...PRIVILEGED_ROLES_LIST)` on both GETs; drop `Rol.RECEPCIONISTA` from `/caja/*` routes.
- [ ] 3.3 RED+GREEN: add catalogo route-stack test asserting `GET /productos` and `GET /categorias` have zero guards; no source change (`catalogo.routes.ts` untouched).

## Phase 4: Verify

- [ ] 4.1 `cd apps/pos-dashboard && npx vitest run && npx tsc --noEmit`.
- [ ] 4.2 `cd apps/api && npx vitest run && npx tsc --noEmit`.
- [ ] 4.3 Confirm no regressions beyond baselines; map results to spec scenarios.
