# Dashboard Role Access Specification

## Purpose

Define which dashboard sections MANICURISTA and RECEPCIONISTA may reach: the
page-visibility matrix, sidebar filtering, the role-aware route-guard default,
the login landing page, and the Finanzas tab set. Privileged roles and CONTADOR
keep their current matrices.

## Requirements

### Requirement: Restricted Sections for Operational Roles

MANICURISTA and RECEPCIONISTA MUST NOT access Dashboard (`/`), Empleados
(`/empleadas`), Productos (`/productos`), Categorías (`/categorias`), Préstamos
(`/prestamos`), or Horarios (`/horarios`). Allowed pages MUST be: MANICURISTA →
`/agenda`, `/clientes`, `/servicios`, `/finanzas`; RECEPCIONISTA → `/agenda`,
`/clientes`, `/ventas`, `/finanzas`. Every other role's matrix MUST NOT change.

#### Scenario: MANICURISTA matrix

- GIVEN a user with `rol = MANICURISTA`
- WHEN `canAccessPage` is evaluated for each page
- THEN `/`, `/empleadas`, `/productos`, `/categorias`, `/prestamos`, `/horarios` MUST be `false`
- AND `/agenda`, `/clientes`, `/servicios`, `/finanzas` MUST be `true`

#### Scenario: RECEPCIONISTA matrix

- GIVEN a user with `rol = RECEPCIONISTA`
- WHEN `canAccessPage` is evaluated for each page
- THEN `/`, `/empleadas`, `/productos`, `/categorias`, `/prestamos`, `/horarios` MUST be `false`
- AND `/agenda`, `/clientes`, `/ventas`, `/finanzas` MUST be `true`

#### Scenario: Privileged matrix unchanged

- GIVEN a user with `rol = DUEÑA`
- WHEN `canAccessPage` is evaluated
- THEN `/` and `/empleadas` MUST still be `true`

### Requirement: Sidebar Hides Restricted Sections

The sidebar MUST render only navigation items for which `canAccessPage(rol, href)`
is `true`; restricted items MUST NOT be rendered for MANICURISTA/RECEPCIONISTA.

#### Scenario: Restricted sidebar

- GIVEN a MANICURISTA session
- WHEN `LuxeLayout` renders
- THEN "Dashboard", "Empleados", "Productos", "Categorías", "Préstamos", "Horarios" MUST NOT be present
- AND "Finanzas" MUST be present

#### Scenario: Privileged sidebar unchanged

- GIVEN a DUEÑA session
- WHEN `LuxeLayout` renders
- THEN all eleven navigation items MUST be present

### Requirement: Role-Aware Route Guard Default

`resolveRouteGuard(rol, pathname)` MUST return `null` when the page is allowed;
otherwise the role's default landing page. The default MUST be `/finanzas` for
MANICURISTA and RECEPCIONISTA, and `/` for every other role (replacing the
hardcoded `/` fallback).

#### Scenario: Hidden page resolves to Finanzas

- GIVEN `rol = RECEPCIONISTA` and `pathname = /empleadas`
- WHEN `resolveRouteGuard` runs
- THEN it MUST return `/finanzas`

#### Scenario: Allowed page resolves to null

- GIVEN `rol = MANICURISTA` and `pathname = /agenda`
- WHEN `resolveRouteGuard` runs
- THEN it MUST return `null`

#### Scenario: Privileged fallback stays at root

- GIVEN `rol = DUEÑA` and a `pathname` not in the matrix
- WHEN `resolveRouteGuard` runs
- THEN it MUST return `/`

### Requirement: Direct URL Navigation Redirects

`ProtectedLayout` MUST enforce `resolveRouteGuard` on every navigation: a
restricted role landing on a forbidden URL (including `/`) MUST be redirected to
the role default with history replacement.

#### Scenario: Direct URL to a hidden page

- GIVEN an authenticated RECEPCIONISTA
- WHEN the address bar loads `/productos`
- THEN the router MUST replace the location with `/finanzas`

#### Scenario: Root URL for a restricted role

- GIVEN an authenticated MANICURISTA
- WHEN the app loads `/`
- THEN the router MUST redirect to `/finanzas`

### Requirement: Login Lands on Role Default

After a successful login the app MUST navigate to the role default: `/finanzas`
for MANICURISTA/RECEPCIONISTA and `/` for every other role.

#### Scenario: Operational role login

- GIVEN valid credentials for a MANICURISTA
- WHEN `POST /api/auth/login` succeeds
- THEN the app MUST navigate to `/finanzas`

#### Scenario: Privileged login unchanged

- GIVEN valid credentials for a DUEÑA
- WHEN `POST /api/auth/login` succeeds
- THEN the app MUST navigate to `/`

### Requirement: Finanzas Tabs Restricted

The Finanzas page MUST render only the tabs allowed for the role. For
MANICURISTA and RECEPCIONISTA only `registros` MUST be visible; `gastos`,
`devoluciones`, `nomina`, `caja`, `cuentas` and `reportes` MUST NOT be. CONTADOR
and privileged roles MUST keep their current tab sets.

#### Scenario: RECEPCIONISTA tabs

- GIVEN a user with `rol = RECEPCIONISTA`
- WHEN `puedeVerTab` is evaluated for each tab
- THEN only `registros` MUST be `true`
- AND `caja`, `gastos`, `devoluciones`, `nomina`, `cuentas`, `reportes` MUST be `false`

#### Scenario: MANICURISTA tabs

- GIVEN a user with `rol = MANICURISTA`
- WHEN `puedeVerTab` is evaluated for each tab
- THEN only `registros` MUST be `true`

#### Scenario: CONTADOR tabs unchanged

- GIVEN a user with `rol = CONTADOR`
- WHEN `puedeVerTab` is evaluated
- THEN `caja` MUST be `false` and `registros` MUST be `true`
