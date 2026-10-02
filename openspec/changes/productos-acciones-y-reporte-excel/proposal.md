# Proposal: productos-acciones-y-reporte-excel

## Intent

Two owner-approved Products-page improvements:

- **A)** The table renders ~5 inline action buttons per row (Re-stock 📦, Descontar ➖, Editar ✏️, Historial 📜, Eliminar 🗑️), forcing horizontal scroll and confusion on mobile/tablet. Replace them with a single "⋮" trigger.
- **B)** Add a downloadable `.xlsx` product/inventory report, mirroring the Finanzas→Reportes export.

## Scope

- **A**: one "⋮" per row → MUI `Menu` with labeled items on desktop/tablet (>600px), `.mobileBottomSheet` on small screens (≤600px). All 5 actions stay reachable. Remove the ~150px action column from the CSS grid template.
- **B**: `GET /salones/:salonId/productos/exportar` guarded by `requireRole(...PRIVILEGED_ROLES_LIST)`, registered **before** `/productos/:id`. Workbook with two sheets: "Productos" and "Totales". Frontend Export button using the Finanzas blob-download pattern.

## Capabilities

### New Capabilities

- `productos-acciones-ui`: responsive per-row action trigger for the Products page.

### Modified Capabilities

- `productos-crud`: ADD the Excel export endpoint (existing list/CRUD behavior unchanged).

## Approach

- **UI**: `ProductoPage` adds MUI `Menu`/`MenuItem` (icon+text) and reuses `.mobileBottomSheet`/`.mobileBottomSheetContent` (`globals.css`); grid template drops the 150px action column for a compact trigger column.
- **API**: new `ProductoExcelExportService` copying `ExcelExportService` (two-sheet builder, `HEADER_FILL`/`COP_FORMAT`/`estiloHeader`); controller mirrors `ReporteController.exportar` (xlsx Content-Type/Disposition, `res.send(buffer)`); route ordered before `/productos/:id`; reuses `ListProductosUseCase` with `limit=0` and a privileged role so `precioCompra` is present.
- **Frontend**: Export button on `ProductosPage` replicating `FinanzasPage` blob download.

## Non-goals

No changes to product CRUD/stock semantics or P&L cost treatment. No `categoria` field (products only have `marca`/`tipoInventario`).

## Rollback

Revert controller/route/service (B) and restore the 5 inline buttons + grid column (A). No schema/migration changes, so rollback is code-only.

## Risks

- Route-order regression: `/productos/exportar` MUST precede `/productos/:id` or `exportar` is parsed as an id.
- Cost gating: export MUST NOT reuse a role-filtered list that drops `precioCompra`; totals MUST sum all products.
