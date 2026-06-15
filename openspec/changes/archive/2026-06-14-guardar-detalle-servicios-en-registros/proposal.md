# Proposal: Guardar detalle de servicios en registros financieros

## Intent

`RegistroServicioEntity` stores only `descripcionServicio` (text) and `totalServicios` (aggregate). Users can't see which services were rendered per registro or their individual prices in the detail modal. We need a detail table mirroring `RegistroProductoEntity` for per-service audit trail and UI drill-down.

## Scope

### In Scope
- New `RegistroServicioItemEntity` (TypeORM, table `registros_servicio_items`)
- TypeORM migration: create table + FKs to `registros_servicio` and `servicios`
- Add `serviciosItems` to `CreateRegistroInput` Zod schema
- Add `serviciosItems` to `RegistroServicioDTO` with mapper
- Save items in `CreateRegistroUseCase` transaction
- Frontend: send `serviciosItems` from WalkInModal and AgendaPage completar
- Frontend: render service items in FinanzasPage detail modal

### Out of Scope
- Commission logic changes (`totalServicios` stays as aggregate)
- Historical data migration for existing registros
- Service catalog or price adjustment changes

## Capabilities

### New Capabilities
- `servicio-items`: Per-service detail tracking — snapshot of servicioId, nombre, precio at registration time

### Modified Capabilities
- `finanzas-registros`: creation now accepts `serviciosItems[]` with service snapshots

## Approach

Follow `RegistroProductoEntity` pattern: lightweight entity with FK + snapshot columns. `RegistroServicioItemEntity` stores: `registroServicioId`, `servicioId`, `nombreServicio` (snapshot varchar), `precioServicio` (snapshot decimal). Saved in same `CreateRegistroUseCase` transaction. `totalServicios` stays as aggregate for commissions; items are audit-only detail.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `.../entities/RegistroServicioItemEntity.ts` | New | Entity mirroring RegistroProductoEntity |
| `.../entities/RegistroServicioEntity.ts` | Modified | Add OneToMany serviciosItems |
| `.../migrations/...-CreateRegistroServicioItem.ts` | New | Migration for registros_servicio_items |
| `.../dtos/RegistroServicioItemDTO.ts` | New | DTO + mapper |
| `.../dtos/RegistroServicioDTO.ts` | Modified | Add serviciosItems to DTO |
| `.../CreateRegistroUseCase.ts` | Modified | Save items in transaction |
| `packages/validation/src/finanzas.schema.ts` | Modified | Add serviciosItems schema |
| `apps/pos-dashboard/src/components/WalkInModal.tsx` | Modified | Send serviciosItems |
| `apps/pos-dashboard/src/pages/AgendaPage.tsx` | Modified | Send serviciosItems on completar |
| `apps/pos-dashboard/src/pages/FinanzasPage.tsx` | Modified | Show items in detail modal |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Frontend sends serviciosIds (old) | Low | Add serviciosItems alongside; deprecate old field |
| Walk-in change not merged yet | Med | Task ordering: walk-in modal must exist first |
| Existing registros lack items | Med | Items optional; modal shows empty state gracefully |

## Rollback Plan

Drop `registros_servicio_items` via down migration. Revert schema, DTO, and entity changes.

## Dependencies

- `walk-in-service-registration` change should be merged first (provides WalkInModal)

## Success Criteria

- [ ] New registros persist servicio items with servicioId, nombre, precio snapshot
- [ ] `totalServicios` aggregate unchanged (commissions unaffected)
- [ ] Detail modal shows per-service breakdown
- [ ] All existing API and validation tests pass
