# Proposal: Permisos de rol — Empleados y Finanzas

## Intent

MANICURISTA and RECEPCIONISTA currently see the Dashboard plus admin/inventory
sections (Empleados, Productos, Categorías, Préstamos, Horarios) and, inside
Finanzas, tabs beyond their operational scope (RECEPCIONISTA even gets Caja).
The owner wants these two operational roles to see only the sections they need,
to land on **Finanzas**, and — inside Finanzas — to see only the **Registros**
tab. Sensitive reads (gastos, devoluciones, caja) must be enforced server-side,
not merely hidden in the UI.

## Scope

### In Scope
- `ROLE_PAGES` matrix: hide Dashboard, Empleados, Productos, Categorías, Préstamos, Horarios for MANICURISTA/RECEPCIONISTA.
- Role-aware route-guard default: `resolveRouteGuard` returns `/finanzas` for these roles instead of the hardcoded `/`.
- Login landing by role (`LoginPage` → `/finanzas` for these roles).
- Sidebar keeps filtering through `canAccessPage` (no new list).
- Finanzas tabs: `puedeVerTab` → only `registros` for MANICURISTA/RECEPCIONISTA.
- Backend: `requireRole(...PRIVILEGED_ROLES_LIST)` on `GET /gastos` and `GET /devoluciones`; exclude RECEPCIONISTA from `/caja/*`.

### Out of Scope
- Backend guards already present for Empleados, Préstamos, Nómina, Cuentas, Reportes/P&L/Export.
- `GET /productos` and `GET /categorias` MUST stay unguarded (Ventas, Agenda and Registros depend on them).
- Backend guard for `GET /agenda/horarios` (UI-hidden only) and new legacy endpoints.
- CONTADOR and privileged roles' page/tab matrices (unchanged).

## Capabilities

### New Capabilities
- `dashboard-role-access`: page visibility matrix, sidebar filtering, role-aware route guard default, login landing, and Finanzas tab gating.

### Modified Capabilities
- `finanzas-gastos`: `GET /gastos` and `GET /devoluciones` become privileged-only (403 for MANICURISTA/RECEPCIONISTA).
- `finanzas-caja`: `/caja/*` excludes RECEPCIONISTA (403).
- `productos-crud`: `GET /productos` explicitly MUST NOT be role-guarded.
- `categorias-crud`: `GET /categorias` explicitly MUST NOT be role-guarded.

## Approach

Keep `apps/pos-dashboard/src/utils/roles.ts` as the single role matrix. Add a
role-aware default page used by both `resolveRouteGuard` and the login redirect.
`LuxeLayout` keeps deriving nav from `canAccessPage`. `FinanzasPage.puedeVerTab`
returns `registros`-only for the two operational roles. On the API, add the
existing `requireRole(...PRIVILEGED_ROLES_LIST)` guard to the two open GETs and
drop `Rol.RECEPCIONISTA` from every `/caja/*` route.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `apps/pos-dashboard/src/utils/roles.ts` | Modified | Matrix rows, `defaultPageForRol`, guard fallback |
| `apps/pos-dashboard/src/components/LuxeLayout.tsx` | Unchanged | Already filters via `canAccessPage` |
| `apps/pos-dashboard/src/App.tsx` | Modified | Guard redirect target (reads from helper) |
| `apps/pos-dashboard/src/pages/LoginPage.tsx` | Modified | Navigate to role default |
| `apps/pos-dashboard/src/pages/FinanzasPage.tsx` | Modified | `puedeVerTab` registros-only |
| `apps/api/.../routes/finanzas.routes.ts` | Modified | Guards on gastos/devoluciones; Caja excluye RECEPCIONISTA |
| `apps/pos-dashboard` tests | Modified | roles, LuxeLayout, FinanzasPage, App |
| `apps/api` tests | Modified | finanzas.routes role coverage |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Removing RECEPCIONISTA from `/caja/*` breaks the "regla de oro" workflow (who opens the caja?) | High | Flag for design sign-off; owner-approved requirement |
| Direct URL to a hidden page still reaches the page component before redirect | Low | Guard runs in `ProtectedLayout` effect; test with `replace` navigation |
| Accidentally guarding `GET /productos`/`/categorias` breaks Ventas/Agenda/Registros | Med | Explicit non-guard requirement + integration tests |
| `GET /agenda/horarios` remains API-open while UI-hidden | Low | Accepted: section is UI-only in this change |

## Rollback Plan

Revert the commit(s): restore the previous `ROLE_PAGES` rows and hardcoded `/`
fallback, revert `LoginPage` navigation, restore `puedeVerTab`'s RECEPCIONISTA
branch, and remove the two `requireRole` guards plus the Caja role edits. No
schema or migration changes, so rollback is code-only.

## Dependencies

- None new. Reuses `Rol`, `PRIVILEGED_ROLES_LIST`, `requireRole`, and `canAccessPage`.

## Success Criteria

- [ ] MANICURISTA/RECEPCIONISTA sidebar has no Dashboard, Empleados, Productos, Categorías, Préstamos, Horarios.
- [ ] Login and direct-URL access land these roles on `/finanzas`; hidden URLs redirect there.
- [ ] Finanzas shows only the Registros tab for these roles.
- [ ] `GET /gastos`, `GET /devoluciones` and `/caja/*` return 403 for these roles; `GET /productos`/`/categorias` still return 200.
