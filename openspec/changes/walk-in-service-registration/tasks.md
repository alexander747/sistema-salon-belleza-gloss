# Tasks: Walk-in Service Registration

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~620 |
| 400-line budget risk | Medium |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | auto-chain |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Schema fix + modal + integration + tests | PR 1 | Single PR — within 800-line budget |

## Phase 1: Schema Cleanup

- [ ] 1.1 Remove `serviciosIds` from `createRegistroSchema` in `packages/validation/src/finanzas.schema.ts`
- [ ] 1.2 Rebuild validation dist: `cd packages/validation && npx tsc`

## Phase 2: WalkInModal Component

- [ ] 2.1 Create `apps/pos-dashboard/src/components/WalkInModal.tsx` with type defs and `WalkInModalProps`
- [ ] 2.2 Create `apps/pos-dashboard/src/components/WalkInModal.module.css` (wide modal + two-column styles)
- [ ] 2.3 Implement data fetch (GET servicios, clientes, empleadas, categorias) on modal open
- [ ] 2.4 Build catalog panel: search input, category filter, service cards with add-to-cart
- [ ] 2.5 Build checkout panel: selected services cart with editable prices and remove button
- [ ] 2.6 Add client + employee dropdown selectors
- [ ] 2.7 Add payment section: method tabs (EFECTIVO/TARJETA/TRANSFERENCIA), amount, ref, tip, notas
- [ ] 2.8 Implement submit: validate required fields, POST payload shape, error/success display
- [ ] 2.9 Auto-calculate `totalServicios` + `descripcionServicio` from cart state

## Phase 3: FinanzasPage Integration

- [ ] 3.1 Add "Registrar servicio" button to RegistrosTab toolbar
- [ ] 3.2 Import `WalkInModal`, add `walkInOpen` state, render in RegistrosTab
- [ ] 3.3 Wire `onSuccess` to call `fetchData()` and refresh registros list

## Phase 4: Testing

- [ ] 4.1 Unit tests: cart add/remove/total, price override, validation rules
- [ ] 4.2 Integration test: mock API calls, verify POST payload matches schema
