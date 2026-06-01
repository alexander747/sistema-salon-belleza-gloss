# Delta Spec: POS Dashboard Frontend

## Domain: pos-dashboard

### Purpose
The POS dashboard serves as the main interface for salon employees and superadmins.

## Requirements

### Requirement 1: Authentication

The dashboard MUST redirect unauthenticated users to `/login`. Login with valid credentials MUST store JWT tokens and navigate to `/`. Login with invalid credentials MUST show an error message.

#### Scenario: Redirect to login when unauthenticated

- GIVEN the user has no JWT token
- WHEN they navigate to `/`
- THEN they are redirected to `/login`

#### Scenario: Successful login navigates to dashboard

- GIVEN valid credentials
- WHEN the user submits the login form with email and password
- THEN a POST to `/api/auth/login` is made
- AND `accessToken` and `refreshToken` are stored in localStorage
- AND the user is navigated to `/`

#### Scenario: Invalid login shows error

- GIVEN invalid credentials
- WHEN the user submits the login form
- THEN a 401 response is returned
- AND an error message is displayed on the login form

#### Scenario: Token refresh on 401

- GIVEN a valid refresh token exists
- WHEN an API call returns 401
- THEN the interceptor calls POST `/api/auth/refresh`
- AND the original request is retried with the new token

#### Scenario: Expired refresh token logs out

- GIVEN both tokens are expired
- WHEN a 401 triggers the refresh interceptor
- THEN tokens are cleared from localStorage
- AND the user is redirected to `/login`

### Requirement 2: Superadmin Salon Switcher

The dashboard MUST show a salon selector for superadmin users on all pages. Selecting a salon MUST update the `xSalonId` in localStorage and reload page data.

#### Scenario: Superadmin sees SalonSwitcher

- GIVEN the authenticated user has role `SUPERADMIN`
- WHEN any protected page renders
- THEN the `SalonSwitcher` component is displayed

#### Scenario: Non-superadmin does not see SalonSwitcher

- GIVEN the authenticated user has role `DUENIA`
- WHEN any protected page renders
- THEN the `SalonSwitcher` component is NOT displayed

#### Scenario: Salon switch reloads data

- GIVEN the superadmin selects a different salon
- WHEN the selection changes
- THEN `xSalonId` is stored in localStorage
- AND page data is re-fetched for the selected salon

### Requirement 3: Dashboard Stats

The dashboard MUST show real-time statistics from `GET /api/finanzas/resumen` and today's appointments from `GET /api/agenda/citas`. An empty salon MUST show an empty state with a call to action.

#### Scenario: Dashboard loads financial summary

- GIVEN the user is authenticated
- WHEN the dashboard page loads
- THEN `GET /api/finanzas/resumen?fecha={today}` is called
- AND stats cards display ingresos, atenciones, clientes, empleadas activas

#### Scenario: Dashboard loads weekly appointments

- GIVEN the dashboard page loads
- WHEN data is fetched
- THEN `GET /api/agenda/citas?desde={monday}&hasta={saturday}` is called
- AND a weekly bar chart shows appointment counts per day

#### Scenario: Dashboard shows today's appointments

- GIVEN appointments exist for today
- WHEN dashboard loads
- THEN the "Próximas citas" card lists today's appointments sorted by time

#### Scenario: Empty salon shows empty state

- GIVEN a salon with no ingresos, no clientes, and no empleadas
- WHEN the dashboard loads
- THEN an empty state is shown with the message "Tu salón está listo" and a CTA to go to agenda

#### Scenario: Data loading shows skeleton

- GIVEN data is still loading
- WHEN the dashboard renders
- THEN skeleton placeholders are shown for stats cards and charts

#### Scenario: Fetch failure shows retry button

- GIVEN all API requests fail
- WHEN the dashboard finishes loading
- THEN an error state is shown with a "Reintentar" button

### Requirement 4: Agenda Module

The agenda MUST display a weekly calendar with appointments from Monday to Saturday, 08:00 to 20:00 hours. Users MUST be able to create appointments via modal, change appointment status, and filter by employee.

#### Scenario: Weekly calendar renders correctly

- GIVEN the user navigates to `/agenda`
- WHEN the page loads
- THEN a weekly calendar shows 6 day columns (Mon-Sat) with hour rows (08-20)

#### Scenario: Create appointment via modal

- GIVEN the user clicks "+ Nueva Cita"
- WHEN the modal opens
- THEN fields for cliente, servicios, empleada, fecha, and hora are presented
- AND selecting empleada + servicios + fecha fetches disponibility slots via `GET /agenda/disponibilidad/slots`
- AND submitting creates the appointment via `POST /agenda/citas`

#### Scenario: Change appointment status

- GIVEN a selected appointment in the modal
- WHEN the user clicks the appropriate status action (Confirmar, Iniciar, Completar, Cancelar)
- THEN `PATCH /agenda/citas/:id/estado` or the appropriate endpoint is called
- AND the calendar refreshes

#### Scenario: Filter by employee

- GIVEN the user selects an employee from the filter dropdown
- WHEN the selection changes
- THEN only appointments for that employee are shown on the calendar

#### Scenario: Week navigation

- GIVEN the agenda page is open
- WHEN the user clicks ← or → navigation buttons
- THEN the week view shifts by 7 days
- AND appointments are re-fetched for the new week

### Requirement 5: Catálogo Modules

Servicios, Productos, and Categorías MUST support full CRUD operations via API integration.

#### Scenario: Servicios CRUD

- GIVEN the user navigates to `/servicios`
- WHEN the page loads
- THEN `GET /api/salones/:id/servicios` returns the list
- AND the user can create, edit, and toggle active/inactive state

#### Scenario: Productos CRUD with stock management

- GIVEN the user navigates to `/productos`
- WHEN the page loads
- THEN `GET /api/salones/:id/productos` returns the list
- AND the user can create, edit, delete products
- AND stock can be adjusted via `POST /productos/:id/descontar` and `POST /productos/:id/reabastecer`

#### Scenario: Categorías CRUD

- GIVEN the user navigates to `/categorias`
- WHEN the page loads
- THEN `GET /api/salones/:id/categorias` returns the list
- AND the user can create, edit, and delete categories

### Requirement 6: Personas Modules

Clientes and Empleadas MUST support CRUD operations with search and activate/deactivate functionality.

#### Scenario: Clientes CRUD with search

- GIVEN the user navigates to `/clientes`
- WHEN the page loads
- THEN `GET /api/salones/:id/clientes` returns the list
- AND the user can search clients by name
- AND the user can create, edit, view details, and delete clients

#### Scenario: Empleadas CRUD with activate/deactivate

- GIVEN the user navigates to `/empleadas`
- WHEN the page loads
- THEN `GET /api/salones/:id/empleadas` returns the list
- AND the user can create, edit employees
- AND activate/deactivate via `PATCH /api/salones/:id/empleadas/:id/activar` and `.../desactivar`

### Requirement 7: Finanzas Module

All 5 tabs (Registros, Gastos, Devoluciones, Nómina, Reportes) MUST load data from their respective API endpoints.

#### Scenario: Registros tab loads summary and table

- GIVEN the user clicks the "Registros" tab
- WHEN the tab renders
- THEN the financial summary cards show data from `GET /api/finanzas/resumen`
- AND the registros table contains data from `GET /api/salones/:id/registros`

#### Scenario: Gastos CRUD

- GIVEN the user clicks the "Gastos" tab
- WHEN the tab renders
- THEN `GET /api/salones/:id/gastos` returns the list
- AND the user can create and delete gastos

#### Scenario: Nómina shows pending commissions

- GIVEN the user clicks the "Nómina" tab
- WHEN the tab renders
- THEN `GET /api/salones/:id/finanzas/nomina` shows pending commissions per employee
- AND the user can liquidate via `POST /api/salones/:id/finanzas/nomina/liquidar`
- AND `GET /api/salones/:id/finanzas/nomina/historial` shows liquidation history

#### Scenario: Reportes tab shows daily summary

- GIVEN the user clicks the "Reportes" tab
- WHEN the tab renders
- THEN `GET /api/finanzas/resumen` shows the daily summary
- AND `GET /api/finanzas/roi` shows ROI data
