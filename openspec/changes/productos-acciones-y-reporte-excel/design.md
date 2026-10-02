# Design: productos-acciones-y-reporte-excel

## Context

Two independent, owner-approved slices on the Products page:

- **A)** Replace the ~5 inline per-row action buttons with a single "⋮" trigger (responsive).
- **B)** Add a two-sheet `.xlsx` product/inventory export.

No schema changes. `marca`/`tipoInventario` only (products have **no** `categoria`).

---

## A) Responsive Product Actions (UI)

### Approach

- One "⋮" trigger per row. Detection with MUI `useMediaQuery('(max-width:600px)')` (MUI is already used in `LuxeLayout.tsx`; theme breakpoints available).
  - `>600px` → MUI `Menu` + `MenuItem` (icon + text).
  - `≤600px` → global `.mobileBottomSheet` / `.mobileBottomSheetContent` (defined in `src/globals.css:157-173`).
- The menu/sheet holds the same **5 labeled actions**, running the **existing handlers** unchanged: Re-stock (`setStockModal(...restock)`), Descontar (`setStockModal(...descontar)`), Editar (`openEdit`), Historial (`openHistory`), Eliminar (`setDeleting`).
- Choosing an action closes the overlay first, then runs the handler.
- Keep `data-label="Acciones"` on the action cell so the stacked-grid contract test (`ROW_LABELS`, 10 labels) keeps passing.

### Files

`apps/pos-dashboard/src/pages/ProductosPage.tsx`
- Imports: `Menu`, `MenuItem`, `useMediaQuery` from `@mui/material`; icons (`Inventory2`, `RemoveCircleOutline`, `Edit`, `History`, `DeleteOutline`) from `@mui/icons-material`.
- State: `actionsAnchor: HTMLElement | null`, `actionsProducto: Producto | null`.
- Functions: `openActions(e, prod)`, `closeActions()`, `runAction(cb)` (close → `cb`).
- Action cell (currently lines 776–829): single `<button aria-label="Acciones" title="Acciones">⋮</button>`.
- Render `Menu` (desktop) and `.mobileBottomSheet` overlay (mobile), each with the 5 `MenuItem`s.
- Remove `iconActionBtn` (only used by the old inline buttons).

`apps/pos-dashboard/src/pages/ProductosPage.module.css`
- In `.gridHeader` and `.gridRow` change the final grid track `150px` → `44px` (lines 8 and 22). The `≤640px` stacked block is untouched.

### Tests

`apps/pos-dashboard/src/pages/__tests__/ProductosPage.test.tsx`
- Migrate the existing action tests (edit/historial/restock/eliminar) to open the row "⋮" first.
- Add: desktop click "⋮" → MUI `Menu` with 5 items; mobile (`setMobileMedia(true)`) → `.mobileBottomSheet` with 5 actions, selection runs handler and closes.

---

## B) Excel Export (API + UI)

### Approach

Mirror the Finanzas export stack: `ExcelExportService` → `ReporteController.exportar` → `FinanzasPage.downloadExcel`.

### Files

**New** `apps/api/src/modules/catalogo/application/services/ProductoExcelExportService.ts`
- Copy `HEADER_FILL` (`FF4F46E5`), `COP_FORMAT` (`$#,##0`), `estiloHeader` from `ExcelExportService.ts`.
- `interface ProductoInventarioRow`.
- `buildProductosWorkbook(rows): ExcelJS.Workbook` — pure (unit-testable).
  - Sheet `Productos` headers: Nombre, Marca, Código de barras, Color, Tamaño, Tipo, Precio compra (PMP), Precio venta, Margen %, Stock, Stock mínimo, Valor inventario compra, Valor inventario venta.
  - Per row `valorInventarioCompra = precioCompra × cantidadStock`, `valorInventarioVenta = precioVenta × cantidadStock`; money cols use `COP_FORMAT`.
  - Sheet `Totales`: `Total de productos` (count), `Valor inventario a compra = Σ(precioCompra × cantidadStock)`, `Valor inventario a venta = Σ(precioVenta × cantidadStock)`. Empty salon → header-only `Productos`, totals `0`.
- `exportar({ salonId, userRol })`: inject `ListProductosUseCase`; `execute({ salonId, limit: 0, userRol })` (limit 0 = all active, `precioCompra` present for privileged roles); serialize to `Buffer.from(await workbook.xlsx.writeBuffer())`; filename `productos_<YYYY-MM-DD>.xlsx`.

`apps/api/src/modules/catalogo/presentation/controllers/ProductoController.ts`
- Inject `@inject(ProductoExcelExportService)`.
- Add `exportar(req,res,next)` mirroring `ReporteController.exportar` (lines 168–196): xlsx `Content-Type`, attachment `Content-Disposition`, `res.send(buffer)`, errors → `next`.

`apps/api/src/modules/catalogo/presentation/routes/catalogo.routes.ts`
- Import `PRIVILEGED_ROLES_LIST`.
- Register `router.get('/productos/exportar', requireRole(...PRIVILEGED_ROLES_LIST), productoController.exportar);` **before** `/productos/:id` (line 73).

`apps/api/src/shared/container.ts`
- Import + `container.register(ProductoExcelExportService, { useClass: ProductoExcelExportService });` in the Catalogo services section.

`apps/pos-dashboard/src/pages/ProductosPage.tsx`
- `exportando` / `exportError` state + `downloadExcel` mirroring `FinanzasPage.tsx:4318-4358` (`api.get('/salones/${salonId}/productos/exportar', { responseType: 'blob' })`, createObjectURL → anchor download → `productos_<date>.xlsx`, blob-error JSON parse).
- Toolbar button `📥 Exportar Excel` next to `+ Nuevo Producto`.

### Sheet contract (tests)

| Sheet | Assertions |
|-------|-----------|
| Productos | one row per active product; `precioCompra=0` shows `0` (never blank); zero-stock rows still present |
| Totales | A(100,150,2)+B(200,300,10) → count 2, compra 2200, venta 3300; empty → 0/0/0 |

### Route-order rationale

Express matches in registration order, so `/productos/:id` would capture `exportar` as an id. The guard test locks `/productos/exportar` index `<` `/productos/:id` index.

### Tests

- New `.../services/__tests__/ProductoExcelExportService.test.ts` (pure builder: sheet names, headers, formulas, empty salon, zero-cost/zero-stock rows; `exportar` orchestration + filename + valid PK bytes).
- Extend `ProductoController.test.ts` with `exportar` (headers set, `res.send(buffer)`, error → `next`).
- New `.../routes/__tests__/catalogo.routes.test.ts` — route-order + `requireRole(...PRIVILEGED_ROLES_LIST)` guard, mirroring `finanzas.routes.test.ts` (mock `tsyringe`, `requireRole`, controllers).
- Extend `ProductosPage.test.tsx` export success (blob get + download) and error (message, no download).

---

## Baselines (recorded 2026-10-01)

- API `npx vitest run`: 2 failed files / 13 failed tests / 651 passed (pre-existing: `catalogo.schema.test.ts` 8, `NominaPendienteUseCase.test.ts` 5).
- API `npx tsc --noEmit`: 6 errors in 2 files (`seed.ts`, `catalogo.schema.test.ts`) — must not grow.
- Dashboard `npx vitest run`: 1 failed file / 1 failed test / 415 passed (`mobileBottomSheet.test.ts`, pre-existing).
- Dashboard `npx tsc --noEmit`: 0 errors.

## Risks

- Route-order regression (`exportar` parsed as `:id`).
- `precioCompra` gating: always pass `userRol` from the privileged request so cost is present.
- Existing action tests must be migrated in the same change (buttons move behind the trigger).
