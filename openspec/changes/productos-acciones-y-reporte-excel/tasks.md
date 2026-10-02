# Tasks: productos-acciones-y-reporte-excel

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~780–900 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (API export) → PR 2 (UI actions) → PR 3 (UI export button) |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | API two-sheet export + route/order tests | PR 1 | base = `feat/fix-restock-precio-configurado`; tests included |
| 2 | Responsive "⋮" actions + migrated/added UI tests | PR 2 | base = PR 1 branch (same page file) |
| 3 | Exportar Excel button + UI tests | PR 3 | base = PR 2 branch |

## Phase 1: API export service (TDD)

- [x] 1.1 RED: create `apps/api/src/modules/catalogo/application/services/__tests__/ProductoExcelExportService.test.ts` — sheets `['Productos','Totales']`; A(100,150,2)+B(200,300,10)→2/2200/3300; empty→0; `precioCompra=0` present.
- [x] 1.2 GREEN: create `ProductoExcelExportService.ts` with `HEADER_FILL`/`COP_FORMAT`/`estiloHeader` (copy `ExcelExportService.ts`) + `buildProductosWorkbook(rows)` (13 `Productos` cols, `Totales`).
- [x] 1.3 GREEN: add `exportar({salonId,userRol})` injecting `ListProductosUseCase` with `limit:0`; `productos_<YYYY-MM-DD>.xlsx`.
- [x] 1.4 Verify: `cd apps/api && npx vitest run src/modules/catalogo/application/services`.

## Phase 2: API wiring + route order (TDD)

- [ ] 2.1 RED: create `presentation/routes/__tests__/catalogo.routes.test.ts` — assert `/productos/exportar` layer index `<` `/productos/:id`, and `requireRole(...PRIVILEGED_ROLES_LIST)` (mirror `finanzas.routes.test.ts`).
- [ ] 2.2 GREEN: `catalogo.routes.ts` — import `PRIVILEGED_ROLES_LIST`; register `GET /productos/exportar` **before** `/productos/:id`.
- [ ] 2.3 RED+GREEN: extend `presentation/controllers/__tests__/ProductoController.test.ts` for `exportar` (Content-Type, Content-Disposition, `res.send(buffer)`, error→`next`); add `exportar` to `ProductoController.ts`.
- [ ] 2.4 GREEN: `shared/container.ts` — import + `container.register(ProductoExcelExportService)`.
- [ ] 2.5 Verify: `cd apps/api && npx vitest run && npx tsc --noEmit`.

## Phase 3: UI actions (TDD)

- [ ] 3.1 RED: extend `apps/pos-dashboard/src/pages/__tests__/ProductosPage.test.tsx` — desktop `⋮`→MUI `Menu` (5 items); mobile (`setMobileMedia(true)`)→`.mobileBottomSheet` (5 actions, runs+closes); migrate existing edit/historial/restock/eliminar tests to open `⋮` first.
- [ ] 3.2 GREEN: `ProductosPage.tsx` — `actionsAnchor`/`actionsProducto` state, `useMediaQuery('(max-width:600px)')`, single `⋮` button (`aria-label="Acciones"`), MUI `Menu`+`MenuItem` reusing existing handlers.
- [ ] 3.3 GREEN: mobile `.mobileBottomSheet` overlay with the 5 labeled actions; keep `data-label="Acciones"`; remove `iconActionBtn`.
- [ ] 3.4 GREEN: `ProductosPage.module.css` — both grid templates final track `150px`→`44px`.
- [ ] 3.5 Verify: `cd apps/pos-dashboard && npx vitest run`.

## Phase 4: UI export button + final verification

- [ ] 4.1 RED: extend `ProductosPage.test.tsx` — success calls `api.get('/salones/1/productos/exportar',{responseType:'blob'})` + download; error shows message, no download.
- [ ] 4.2 GREEN: `ProductosPage.tsx` — `exportando`/`exportError`, `downloadExcel` (mirror `FinanzasPage.tsx:4318-4358`), toolbar `📥 Exportar Excel`.
- [ ] 4.3 Verify baselines (no new failures): `cd apps/api && npx vitest run` (≤2 files/13 tests), `npx tsc --noEmit` (≤6 errors); `cd apps/pos-dashboard && npx vitest run` (≤1 file/1 test), `npx tsc --noEmit` (0).
