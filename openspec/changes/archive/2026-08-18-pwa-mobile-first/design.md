# Design: PWA Mobile-First — Phase 1 Responsive Overhaul

## Technical Approach

CSS-media-query-driven, zero conditional JSX. Desktop DOM is the single source of truth; mobile is a pure CSS transformation. jsdom cannot apply CSS and the vitest setup mocks `window.matchMedia` → `matches: false`, so `useMediaQuery` resolves `false` in tests → desktop path. Existing tests stay green **by construction**, with no `motion.tr` churn. JS conditionals only where CSS cannot reach: MUI Drawer variant, VentasPage inline layouts, inline-styled modal overlays.

## Architecture Decisions

| # | Decision | Choice | Alternatives | Rationale |
|---|----------|--------|--------------|-----------|
| 1 | Breakpoints | MUI default: xs <600, sm 600–899, md 900–1199, lg 1200+. CSS mirrors px: 600 (cards), 640 (grids), 768 (hides), 900 (drawer) | Custom breakpoints | Theme already MUI; zero config; px match MUI `down('md')` |
| 2 | Layout shell | Single `Drawer` in LuxeLayout: `variant={isMobile ? 'temporary' : 'permanent'}` with `useMediaQuery(theme.breakpoints.down('md'))`, `keepMounted`, hamburger in AppBar < md; collapse toggle/`sidebarCollapsed` only ≥ md | Two Drawers | One markup source; `keepMounted` keeps nav labels in DOM (LuxeLayout.test safe); E2E desktop unchanged |
| 3 | **Table→card strategy** | **CSS media queries only** — ≤600px: hide `.tableHead`, `.tableRow { display:block }` as card, `td::before { content: attr(data-label) }` labels, `nth-child` hides low-value cells, actions become footer | useMediaQuery + CardList component | Test-critical: `closest('tr')` in FinanzasPage.test and all `getByText` need unchanged DOM; CSS never touches jsdom DOM. Zero motion.tr churn; ~10 pages × ~80 CSS lines instead of duplicated card components |
| 4 | Grid mantenedores | Move inline `tableHeaderStyle`/`tableRowStyle` (`gridTemplateColumns`) → CSS module classes `.gridHeader/.gridRow`; ≤640px `grid-template-columns: 1fr` + span `data-label`/`nth-child` | useMediaQuery swap | Inline styles resist media queries; class move is mechanical (same template), DOM/text unchanged |
| 5 | Registros (13 col) | Column-hide: ≤1024px hide `#`,`Hora`,`Dto.%`,`Ajustado`; ≤768px also `Productos`,`Método`; ≤600px card layout; `.stickyActions { position:static; box-shadow:none }` ≤600px | CardList only | Sticky right column must not overlay cards; progressive reduction keeps tablet usable |
| 6 | VentasPage | `useMediaQuery` down('md'): layout `'1fr'`, product grid `repeat(auto-fill,minmax(140px,1fr))`, qty buttons 40px | CSS class migration | Heavy inline styles; jsdom → desktop path; cart logic untouched |
| 7 | HorariosPage | `.tableWrapper { overflow:hidden }` → `overflow-x:auto`; ≤600px table→card (4 fields) | Full scroll | Escape hatch + readable mobile |
| 8 | LoginPage | `width: 400` → `width:'100%', maxWidth:400` | — | One-line fix for 390px overflow |
| 9 | Touch targets | Per-module `@media (max-width:600px)`: `.formInput/.formSelect/.formTextarea/.searchInput/.timeInput { min-height:44px }`; PaginationBar buttons `0.55rem 1.1rem`; `.formRow { grid-template-columns:1fr }` ≤600px (Agenda already has it) | Global element rules | Hashed module classes can't be targeted globally; per-module MQ is explicit and desktop-neutral |
| 10 | Modal bottom-sheet | Shared utility classes `.mobileBottomSheet` (overlay) + `.mobileBottomSheetContent` added to each form modal; ONE global MQ ≤600px in globals.css: overlay `padding:0; align-items:flex-end`, content `max-width:100% !important; max-height:92vh; radius top-only` | Per-module MQs | Utility classes are plain (non-hashed) → one global rule; `!important` beats hashed `max-width`. Applied to: mantenedor modals, cita, completar, auditoría, CajaTab modals. **WalkInModal excluded** (already full-screen ≤768px) |
| 11 | Scroll-by-design | Agenda week view (896px), CajaTab historial (640px), audit tables keep `overflow-x:auto`; CajaTab: verify parent `overflow:hidden` (L165) doesn't clip → allow scroll | Card conversion | Calendar/history tables are read-mostly; conversion cost > value (Phase 1) |
| 12 | Test strategy | Existing: green by construction (CSS unapplied in jsdom; useMediaQuery false; nothing unmounted). New: `setMobileMedia()` helper re-mocks matchMedia `matches:true` for ≤600/≤900 — tests LuxeLayout (temporary drawer + hamburger, collapse not persisted), VentasPage (1fr layout), utility class presence. CSS card/hide behavior is NOT jsdom-assertable → Chrome DevTools MCP visual checks | — | Honest split: JS behavior unit-tested, CSS behavior visually verified |

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/components/LuxeLayout.tsx` | Modify | Drawer variant switch, hamburger, SidebarContent extraction |
| `src/globals.css` | Modify | `.mobileBottomSheet*` MQ, touch-target rules |
| `src/pages/{Empleadas,Clientes,Prestamos}Page.*` | Modify | Card MQ + `data-label` |
| `src/pages/{Servicios,Productos,Categorias}Page.tsx` | Modify | Grid styles → classes, `data-label` |
| `src/pages/FinanzasPage.*` | Modify | Column-hide MQ, cards, sticky reset |
| `src/pages/{VentasPage,LoginPage,HorariosPage}.tsx`, `HorariosPage.module.css` | Modify | Stack/width/overflow |
| `src/pages/AgendaPage.module.css` | Modify | Bottom-sheet on cita/completar modals |
| `src/components/caja/CajaTab.tsx`, `src/components/PaginationBar.tsx` | Modify | Scroll un-clip; touch sizing |
| `src/pages/__tests__/` mobile helper + LuxeLayout/VentasPage tests | Modify | Mobile-mode tests |

## Testing Strategy

| Layer | What | How |
|-------|------|-----|
| Unit (jsdom) | Drawer variant/hamburger/collapse persistence; VentasPage stack; utility classes present | `setMobileMedia()` matchMedia override; existing suites green unchanged |
| Visual (Chrome DevTools MCP) | CSS behavior: cards ≤600px, column-hide, bottom-sheet, no overflow | 390×844, 768×1024, 1440×900; `scrollWidth ≤ innerWidth` per page |
| E2E (Playwright) | Desktop regression | Existing suite, Desktop Chrome 1280×720, must stay green |

## Migration / Rollout

No data migration. Batches R1→R5 merge in order; R6 verifies. Each batch independently revertable.

## Open Questions

- None blocking.
