# Delta Spec: Superadmin Frontend (SuperGloss)

## Domain: superadmin-frontend

### Purpose
The Superadmin frontend provides salon management capabilities for system administrators.

## Requirements

### Requirement 1: Salon Management

The superadmin MUST be able to list, create, edit, and delete salons. They MUST be able to toggle salon active status and search/filter salons.

#### Scenario: List all salons

- GIVEN a superadmin user is authenticated
- WHEN they navigate to `/salones`
- THEN `GET /api/superadmin/salones` is called
- AND all salons are displayed in a table with name, status, plan, and actions

#### Scenario: Search/filter salons

- GIVEN the salon list page is loaded
- WHEN the user types in the search input
- THEN the salon list filters in real-time by name, city, and business name

#### Scenario: Create new salon

- GIVEN the superadmin clicks "Nuevo Salón"
- WHEN the create form is submitted
- THEN `POST /api/superadmin/salones` is called with salon data
- AND the salon appears in the list

#### Scenario: Edit salon details

- GIVEN the superadmin clicks "Editar" on a salon
- WHEN the edit form is submitted
- THEN `PUT /api/superadmin/salones/:id` is called
- AND changes are reflected in the list

#### Scenario: Toggle salon active status

- GIVEN the superadmin clicks the toggle button on a salon
- WHEN the action confirms
- THEN `PATCH /api/superadmin/salones/:id/toggle` is called
- AND the salon's active status updates in the UI

#### Scenario: Delete salon

- GIVEN the superadmin clicks "Eliminar" on a salon
- WHEN the delete is confirmed
- THEN `DELETE /api/superadmin/salones/:id` is called
- AND the salon is removed from the list

### Requirement 2: Salon Detail

The detail page MUST show all salon fields and allow copying the API key to clipboard.

#### Scenario: View salon detail

- GIVEN the superadmin clicks on a salon name
- WHEN the detail page loads
- THEN `GET /api/superadmin/salones/:id` returns full salon data
- AND all fields including branding, WhatsApp number, and API key are displayed

#### Scenario: Copy API key

- GIVEN the salon detail page is displayed
- WHEN the superadmin clicks the copy button next to the API key
- THEN the API key is copied to clipboard
- AND a visual confirmation is shown

### Requirement 3: Superadmin Dashboard

The dashboard MUST show real-time statistics including total salons, active count, and premium count.

#### Scenario: Dashboard shows real stats

- GIVEN the superadmin is on the dashboard
- WHEN the page loads
- THEN `GET /api/superadmin/salones` returns all salons
- AND stats cards display: total salones, activos, and premium counts
