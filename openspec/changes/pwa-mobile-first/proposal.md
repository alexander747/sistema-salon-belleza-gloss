# Proposal: PWA Mobile-First (Phase 1 — Responsive Overhaul)

## Intent

Owner: "Quiero crear un PWA con esta página. Lo primero es que para un celular todo tiene que ser responsive para que no se vea mal." The dashboard (`apps/pos-dashboard`) is desktop-only: permanent sidebar eats 72–260px at 390px viewports, mantenedores are fixed 600–860px tables relying on `overflow-x`, inputs are 38px (below the 44px touch target), modals are centered boxes, and LoginPage's 400px Paper overflows a 390px screen.

**This change = Phase 1 only: make every page responsive for phones.** PWA (Phase 2) and HTTPS/own domain (Phase 3) are follow-up changes, recorded here.

## Scope

### In Scope
- LuxeLayout: temporary Drawer + hamburger < md (900px), permanent Drawer ≥ md; collapse pref persisted desktop-only
- Mantenedores → cards ≤600px (Empleados, Clientes, Préstamos) and stacked ≤640px (Servicios, Productos, Categorías) via CSS media queries — desktop DOM byte-identical
- Registros 13-col: progressive column-hide (≤1024/≤768) + cards ≤600px, sticky actions neutralized; Finanzas Gastos/Devoluciones/Nómina/Cuentas → cards ≤600px
- VentasPage stack (`3fr 2fr`→`1fr`) + ≥40px qty buttons; HorariosPage overflow fix; LoginPage Paper fix
- Global: 44px touch targets, `.formRow` 1-col ≤600px, PaginationBar touch, modal bottom-sheet ≤600px; AgendaPage modal/form stacking
- Verification: Chrome DevTools MCP at 390×844 / 768×1024 / 1440×900

### Out of Scope
- **Phase 2 (follow-up)**: PWA — vite-plugin-pwa, manifest, SW, icons, offline shell, network-first `/api`
- **Phase 3 (follow-up)**: prod HTTPS + own domain — nginx/Caddy, TLS, CORS_ORIGINS, prod Dockerfile
- Superadmin app, backend changes, CajaTab historial / audit tables (keep horizontal scroll)

## Capabilities

### New Capabilities
- `mobile-responsive`: dashboard renders correctly on phones/tablets — responsive shell, touch-target sizes, card lists and column-hiding at defined breakpoints, bottom-sheet modals; desktop behavior and DOM unchanged

### Modified Capabilities
- None (CRUD, API contracts, accessible names unchanged)

## Approach

CSS-media-query-driven, zero conditional JSX: mantenedor DOM stays identical (jsdom can't apply CSS → existing vitest tests green by construction; `useMediaQuery` resolves `false` in jsdom → desktop path). WalkInModal's mobile pattern (full-screen ≤768px, stack ≤480px) is the reference. JS-conditional pieces only: LuxeLayout drawer variant, VentasPage layout, inline-styled modal overlays.

Per page: **table mantenedores → cards ≤600px** · **grid mantenedores → stacked ≤640px** · **Registros → column-hide + cards** · **Agenda week + CajaTab/audit → keep scroll** · **Horarios → scroll escape + cards**.

**Size**: ~4–6 days → 6 implementation batches (R1–R6), each ≤800 changed lines and independently revertable; chained PRs to main.

## Affected Areas

| Area | Change |
|------|--------|
| `components/LuxeLayout.tsx` | Temporary drawer < md + hamburger |
| `pages/{Empleadas,Clientes,Prestamos}Page.*` | Cards ≤600px + `data-label` |
| `pages/{Servicios,Productos,Categorias}Page.tsx` | Inline grid styles → CSS classes, stacked ≤640px |
| `pages/FinanzasPage.*` | Column-hide + cards; Cuentas cards ≤600px |
| `pages/{VentasPage,LoginPage,HorariosPage}.tsx` | Stack / width / overflow fixes |
| `pages/AgendaPage.module.css` | Modal bottom-sheet + form stacking |
| `components/caja/CajaTab.tsx`, `components/PaginationBar.tsx` | Un-clip scroll; ≥40px touch |
| `globals.css` | Shared `.mobileBottomSheet*` utilities, touch targets |
| `pages/__tests__/*.test.tsx` | New mobile-mode tests (matchMedia override) |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Tests asserting `closest('tr')` / table text break | Low | CSS-only: DOM unchanged in jsdom; verify FinanzasPage.test |
| motion.tr churn | Low | No row rewrite — rows stay `motion.tr` |
| Sticky actions overlay card view | Med | `position: static`, shadow off ≤600px |
| Inline styles resist media queries | Med | Grid pages: templates → CSS classes; VentasPage: `useMediaQuery` |
| E2E Desktop 1280×720 breaks | Low | Permanent drawer ≥ md; labels/aria untouched |

## Rollback Plan

Per-batch revert of CSS/JSX diffs; each batch is an independent commit. Worst case `git revert` of the batch — no data migration, no schema, no backend.

## Dependencies

- None; no new packages (Phase 2 adds vite-plugin-pwa).

## Success Criteria

- [ ] No horizontal page overflow at 390×844, 768×1024, 1440×900
- [ ] All vitest suites and Playwright E2E (Desktop Chrome) green
- [ ] Touch targets ≥44px, PaginationBar ≥40px on mobile
- [ ] Mantenedores readable as cards ≤600px; Registros usable via column-hide
- [ ] LuxeLayout: hamburger + temporary drawer < md; permanent ≥ md; collapse persisted desktop-only
