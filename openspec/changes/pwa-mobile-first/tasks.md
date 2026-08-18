# Tasks: PWA Mobile-First — Phase 1 Responsive Overhaul

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~2,400 (6 batches, each ≤800) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | 6 chained PRs (R1→R6) |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Base |
|------|------|-----------|------|
| 1 | Layout shell + global foundation | PR 1 | main |
| 2 | Table mantenedores → cards | PR 2 | main (after PR 1) |
| 3 | Grid mantenedores → stacked | PR 3 | main (after PR 2) |
| 4 | Finanzas column-hide + cards | PR 4 | main (after PR 3) |
| 5 | Ventas/Horarios/Agenda modals | PR 5 | main (after PR 4) |
| 6 | Verification (3 viewports) | PR 6 | main (after PR 5) |

## Batch R1 — Layout + cimientos (~350 lines)

- [x] 1.1 LuxeLayout: `useMediaQuery(down('md'))`; single Drawer `variant={isMobile?'temporary':'permanent'}`, `keepMounted`, `open`/`onClose`
- [x] 1.2 Extract SidebarContent (logo/nav/CTA/logout); hamburger `MenuIcon` < md; hide collapse Chevron < md
- [x] 1.3 Persist `sidebarCollapsed` only ≥ md; content padding `p:{xs:1.5, md:3}`
- [x] 1.4 LoginPage: `width:400` → `width:'100%', maxWidth:400`
- [x] 1.5 globals.css: `.mobileBottomSheet`+`.mobileBottomSheetContent` MQ ≤600px (align-end, 100%, 92vh, top radius)
- [x] 1.6 globals.css: MQ ≤600px inputs/select/textarea `min-height:44px` (aplicado per-module según D9)
- [x] 1.7 Per-module MQ ≤600px: `.formRow`→1fr (Empleadas/Clientes/Prestamos/Finanzas), `.searchInput/.timeInput` 44px
- [x] 1.8 PaginationBar: padding `0.55rem 1.1rem` (+ minHeight 40px)
- [x] 1.9 Tests: `setMobileMedia()` helper; LuxeLayout mobile test (temporary drawer, hamburger, no collapse write)

## Batch R2 — Mantenedores tablas (~450 lines)

- [ ] 2.1 EmpleadasPage CSS: card MQ ≤600px — hide `.tableHead`, `.tableRow{display:block}`, `td::before{content:attr(data-label)}`, hide fechas via `nth-child`
- [ ] 2.2 EmpleadasPage.tsx: `data-label` on 10 `<td>`s; actions → footer row
- [ ] 2.3 ClientesPage CSS+.tsx: same card MQ + `data-label` (9 cols)
- [ ] 2.4 PrestamosPage CSS+.tsx: same card MQ + `data-label` (7 cols)
- [ ] 2.5 Verify Empleadas/Clientes/Prestamos tests green (no DOM change)

## Batch R3 — Mantenedores grids (~500 lines)

- [ ] 3.1 ServiciosPage: `tableHeaderStyle`/`tableRowStyle` inline → `.gridHeader`/`.gridRow` classes (same template)
- [ ] 3.2 ServiciosPage: stacked MQ ≤640px (1fr rows, `nth-child` hide dates) + span `data-label`
- [ ] 3.3 ProductosPage: same migration (9 cols incl. stock/margen)
- [ ] 3.4 CategoriasPage: same migration (7 cols)
- [ ] 3.5 Verify Servicios/Productos/Categorias tests green

## Batch R4 — Finanzas (~650 lines)

- [ ] 4.1 FinanzasPage CSS: Registros column-hide ≤1024px (#,Hora,Dto%,Ajustado) and ≤768px (+Productos,Método)
- [ ] 4.2 Registros card MQ ≤600px; `.stickyActions{position:static;box-shadow:none}`
- [ ] 4.3 FinanzasPage.tsx: `data-label` on Registros `<td>`s
- [ ] 4.4 Gastos/Devoluciones/Nómina: card MQ + `data-label`
- [ ] 4.5 Cuentas subtabs (Cobrar/Pagar): card MQ ≤600px, keep `<tr>` DOM (`closest('tr')` constraint)
- [ ] 4.6 CajaTab: un-clip scroll containers (L165 `overflow:hidden`); historial/audit keep scroll
- [ ] 4.7 Verify FinanzasPage.test + CajaBannerPages.test green

## Batch R5 — Ventas + Horarios + Agenda modals (~400 lines)

- [ ] 5.1 VentasPage: `useMediaQuery` down('md') → layout `'1fr'`; product grid `repeat(auto-fill,minmax(140px,1fr))`; qty buttons 40px
- [ ] 5.2 HorariosPage CSS: `overflow:hidden`→`auto`; card MQ ≤600px (4 fields)
- [ ] 5.3 AgendaPage CSS: `.mobileBottomSheet`+`Content` on cita + completar modals
- [ ] 5.4 AgendaPage: extend ≤600px form stacking (767/600 MQs kept)
- [ ] 5.5 Verify VentasPage/AgendaPage tests green

## Batch R6 — Verificación (~250 lines)

- [ ] 6.1 Chrome DevTools MCP: every page @390×844 — no `scrollWidth>innerWidth`, cards, bottom-sheet
- [ ] 6.2 Audit @768×1024 — column-hide, temporary drawer
- [ ] 6.3 Audit @1440×900 — desktop unchanged
- [ ] 6.4 Full vitest (api + dashboard) + Playwright E2E Desktop Chrome
- [ ] 6.5 Fix regressions, re-run; screenshots in batch report

## Test Inventory

**Stay green (unchanged)**: Empleadas, Clientes, Prestamos, Servicios, Productos, Categorias, Ventas, Agenda, FinanzasPage (`closest('tr')`!), CajaBannerPages, CajaCerradaFlows, LuxeLayout, WalkInModal, PaginationBar, MoneyInput, TableSkeleton.
**New**: LuxeLayout mobile (temporary drawer + hamburger + no collapse persist); VentasPage mobile layout; bottom-sheet utility classes present.

## Dependency Notes

- R1 first (drawer + global utilities unlock all); R2/R3 independent of each other, both need R1's `data-label` convention; R4 depends on R1 only; R5 depends on R1 + R4's CajaTab; R6 last.
- No `packages/validation` rebuild (no schema changes).
- E2E needs running stack: `docker compose up -d`, seed, dashboard :5174.
