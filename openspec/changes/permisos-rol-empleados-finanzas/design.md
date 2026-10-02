# Design: Permisos de rol — Empleados y Finanzas

## Context

MANICURISTA and RECEPCIONISTA see admin/inventory sections and over-broad
Finanzas tabs. The UI hides them today only for pages they never see; the
redirect fallback is hardcoded to `/`. Sensitive reads (`gastos`,
`devoluciones`, `caja`) are API-open. Goal: restrict UI, land these roles on
`/finanzas`, and enforce sensitive reads server-side.

## Approach

`apps/pos-dashboard/src/utils/roles.ts` stays the single role matrix. A new
role-aware default page feeds both `resolveRouteGuard` and `LoginPage`.
`LuxeLayout` is untouched (already filters via `canAccessPage`). `FinanzasPage`
narrows `puedeVerTab`. The API adds the existing `requireRole` guard to two GETs
and removes `RECEPCIONISTA` from `/caja/*`.

No schema, migration, or new endpoint. `GET /productos` and `GET /categorias`
are already unguarded and MUST stay that way.

## Frontend Decisions

### `utils/roles.ts`

- Add `defaultPageForRol(rol: number | null | undefined): string` →
  `/finanzas` for `MANICURISTA`/`RECEPCIONISTA`, else `/`. Used by the guard and
  the login redirect so both share one rule.
- `ROLE_PAGES`:
  - `MANICURISTA` = `[PAGE_CITAS, PAGE_CLIENTES, PAGE_SERVICIOS, PAGE_FINANZAS]`
  - `RECEPCIONISTA` = `[PAGE_CITAS, PAGE_CLIENTES, PAGE_VENTAS, PAGE_FINANZAS]`
  - Drop `PAGE_DASHBOARD`, `PAGE_EMPLEADOS`, `PAGE_PRODUCTOS`,
    `PAGE_CATEGORIAS`, `PAGE_PRESTAMOS`, `PAGE_HORARIOS` from both.
  - CONTADOR and privileged rows unchanged.
- `resolveRouteGuard(rol, pathname)` → `null` if `canAccessPage`, else
  `defaultPageForRol(rol)` (replaces hardcoded `/`).

### `pages/FinanzasPage.tsx`

`puedeVerTab` (≈266): if role is `MANICURISTA` or `RECEPCIONISTA`, return
`tabKey === 'registros'`. CONTADOR (all but `caja`) and privileged behavior
unchanged. `isPrivilegedRole` stays for `cuentas`/`reportes`.

### `pages/LoginPage.tsx`

Line 25: read `data.user.rol` and `navigate(defaultPageForRol(rol))` instead of
`navigate('/')`. Response shape confirmed by `AuthOutput.user.rol` and
`AuthController.login`.

## Backend Decisions

### `apps/api/.../finanzas/presentation/routes/finanzas.routes.ts`

- `GET /gastos` (≈51) and `GET /devoluciones` (≈65): add
  `requireRole(...PRIVILEGED_ROLES_LIST)` (SUPERADMIN, DUEÑA, ADMINISTRADOR,
  CONTADOR) — matches the finanzas-gastos delta.
- `/caja/*` — remove `Rol.RECEPCIONISTA`:
  - `POST /caja/abrir | /cerrar | /reabrir` → SUPERADMIN, DUEÑA, ADMINISTRADOR
  - `GET /caja/actual | /actual/esperado | /cierres` → SUPERADMIN, DUEÑA, ADMINISTRADOR
  - `GET /caja/:id/cierre` → SUPERADMIN, DUEÑA, ADMINISTRADOR, CONTADOR
- POST `/registros`, POST `/devoluciones`, `/registros/:id/pagos` unchanged.
- `catalogo.routes.ts` untouched: `GET /productos` / `GET /categorias` remain unguarded.

## Test Strategy (strict TDD)

RED → GREEN per slice. Frontend: `roles.test.ts` (matrix, `defaultPageForRol`,
guard), `LuxeLayout.test.tsx`, `FinanzasPage.test.tsx`, `App.test.tsx`.
Backend: extend `finanzas.routes.test.ts` (guard lists via router stack) and add
real-`requireRole` 403/200 cases in `finanzas.reportes-role.test.ts` for
gastos/devoluciones. Add a catalogo route-stack test asserting zero guards on
product reads.

Exact commands:
- Dashboard: `cd apps/pos-dashboard && npx vitest run` + `npx tsc --noEmit`
- API: `cd apps/api && npx vitest run` + `npx tsc --noEmit`

Baseline: dashboard ≈391 tests, ≤2 known pre-existing failures; API ≈623 tests,
5 known date-dependent failures.

## Risks / Tradeoffs

- Removing RECEPCIONISTA from `/caja/*` breaks the "who opens the caja?"
  workflow — owner-approved requirement (proposal risk #1).
- `/finanzas` route already exists for both roles, so the redirect target is
  always accessible.
- Guard runs in `ProtectedLayout` effect; a hidden page may mount briefly before
  `replace` navigation. Accepted (proposal risk #2).
- `GET /agenda/horarios` stays API-open; UI-hidden only. Accepted.

## Rollback

Code-only: restore `ROLE_PAGES` rows and `/` fallback, revert `LoginPage`,
restore `puedeVerTab` RECEPCIONISTA branch, remove the two guards and re-add
`RECEPCIONISTA` to `/caja/*`. No data changes.
