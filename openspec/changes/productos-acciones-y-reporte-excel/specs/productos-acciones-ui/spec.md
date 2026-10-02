# Delta for Productos Acciones UI

## ADDED Requirements

### Requirement: Responsive Product Actions

The Products table MUST NOT require horizontal scrolling for row actions on mobile or tablet. Each row MUST expose exactly one "⋮" trigger opening the five actions (Re-stock, Descontar, Editar, Historial, Eliminar). Above 600px it MUST open an MUI `Menu` with labeled items (icon + text); at ≤600px it MUST open a `.mobileBottomSheet`. The grid template MUST replace the ~150px action column with a compact trigger column.

#### Scenario: Mobile — no horizontal scroll

- GIVEN a 390px viewport
- WHEN the products table renders
- THEN `scrollWidth <= clientWidth`
- AND each row shows a single "⋮" trigger

#### Scenario: Mobile — bottom sheet

- GIVEN a 390px viewport
- WHEN a row's "⋮" is tapped
- THEN a `.mobileBottomSheet` opens with the five labeled actions
- AND choosing one runs its action and closes the sheet

#### Scenario: Tablet/desktop — Menu

- GIVEN an 834px viewport
- WHEN the "⋮" is clicked
- THEN an MUI `Menu` opens with five labeled `MenuItem`s
- AND no horizontal scroll occurs

#### Scenario: All actions reachable

- GIVEN the menu or bottom sheet is open
- WHEN Re-stock / Descontar / Editar / Historial / Eliminar is chosen
- THEN the same handler as before runs and the overlay closes

#### Scenario: Compact action column

- GIVEN the table grid template
- THEN the action column fits a single compact trigger (not ~150px)
- AND at 601–1024px the row does not exceed its container

### Requirement: Export button on Products page

The Products page MUST provide an "Exportar Excel" button that downloads the `GET /productos/exportar` blob (Finanzas pattern), with loading and error states.

#### Scenario: Download and failure

- GIVEN a privileged user on the Products page
- WHEN Exportar Excel is clicked
- THEN a `productos_*.xlsx` download starts on success
- AND on API error an error message is shown with no file downloaded
