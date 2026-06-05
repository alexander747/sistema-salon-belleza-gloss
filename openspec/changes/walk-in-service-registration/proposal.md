# Proposal: Walk-in Service Registration (Servicios sin Cita)

## Intent

Enable salon staff to register services rendered to walk-in clients (clients without a prior appointment). This is a common real-world scenario where a client arrives spontaneously and an available employee provides a service on the spot.

## Current State

The backend already supports walk-in registrations:
- `POST /salones/:id/registros` accepts `clienteId`, `usuarioId`, `totalServicios`, `totalProductos`, `propina`, `pagos`, `notas`, etc.
- **No `citaId` is required** — the system has no concept of linking a registro to a cita at the data level.

Current frontend flows that create registros:
1. **AgendaPage**: Completes an appointment → creates registro
2. **VentasPage**: Direct product sale → creates registro

**Gap**: There is NO UI to register a walk-in service.

## Scope (IN)

### Frontend
- Add "Registrar servicio" button to FinanzasPage (Registros tab)
- Create a modal/panel for walk-in service registration with:
  - Client selector (search + create new walk-in client)
  - Employee selector (who performed the service)
  - Service catalog picker (multi-select with prices)
  - Optional product add-ons
  - Payment method capture (efectivo, transferencia, débito, crédito)
  - Tip (propina) input
  - Notes field
  - Total calculation (auto-calculated from services + products + tip)
- POST to existing `/salones/:id/registros` endpoint
- Success/error feedback

### Backend
- Make `serviciosIds` field actually functional (currently accepted but ignored by CreateRegistroUseCase)
- Add `descripcionServicio` auto-population from selected service names

## Scope (OUT)

- Commission configuration changes (existing ComisionService logic is sufficient)
- New database tables or entities (existing `registros_servicio` table handles everything)
- Appointment scheduling changes
- Reporting/analytics enhancements
- Multi-employee service splitting (divisiones) — keep simple single-employee for v1

## Approach

### UI Pattern
Follow the **VentasPage** pattern exactly:
- Two-column layout: catalog (left) + checkout summary (right)
- Searchable catalog with category filtering
- Cart-like service selection with editable prices
- Payment panel with method selection and amount validation

### Location
Extend **FinanzasPage** Registros tab:
- Add "+ Registrar servicio" button in the header
- Opens modal overlay with the registration form
- On success: refresh registros list + show success toast

### Data Flow
```
User clicks "Registrar servicio"
  → Modal opens with empty form
  → User selects client (search or create new)
  → User selects employee
  → User adds services from catalog (with editable prices)
  → User adds optional products
  → User sets payment method(s)
  → User sets tip (optional)
  → User clicks "Registrar"
  → POST /salones/:id/registros
  → On success: close modal, refresh list, show success
```

## Success Criteria

- [ ] Staff can register a walk-in service without any appointment
- [ ] Service total auto-calculates from selected services
- [ ] Payment is captured and recorded
- [ ] The new registro appears immediately in the FinanzasPage list
- [ ] Client's visit count increments
- [ ] Works on mobile (responsive)

## Risks

| Risk | Mitigation |
|------|------------|
| FinanzasPage is already ~2700 lines | Extract modal to separate component file |
| `serviciosIds` is currently ignored | Either remove it or make it functional — decision needed |
| Price editing vs catalog prices | Allow override for walk-ins (promotions, discounts) |

## Estimation

- Frontend modal/component: ~300 lines
- Backend `serviciosIds` fix: ~50 lines
- Integration + testing: ~100 lines
- **Total: ~450 lines** (within 800-line budget)

## Decision Needed

**Should `serviciosIds` be made functional?** 
- Option A: Remove it from schema (simplest, no backend changes)
- Option B: Store service IDs in a new `registros_servicios` join table (enables per-service reporting)
- **Recommendation**: Option A for v1 — the monetary fields (`totalServicios`) are sufficient for reporting. We can add per-service tracking later if needed.
