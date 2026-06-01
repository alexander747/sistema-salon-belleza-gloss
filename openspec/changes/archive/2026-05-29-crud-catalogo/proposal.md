# Proposal: CRUD Catálogo (Categorías, Servicios, Productos)

## Intent

Implement full CRUD for the salon catalog: categorías de servicio, servicios (with seasonal pricing), and productos (inventario with role-filtered costs). This is the backbone every salon needs before appointments or inventory management can work.

## Scope

### In Scope
- **Backend**: Single `modules/catalogo/` with domain ports, 15 use cases, 3 TypeORM repositories, 3 controllers, 1 router
- **Frontend**: 3 dashboard pages (Categorías, Servicios, Inventario) with list/create/edit modals and stock actions (descontar/reabastecer)
- **Testing**: Unit tests for all 15 use cases, integration tests for all API endpoints
- **Security**: Role-based `precioCompra` stripping (hidden from MANICURISTA/RECEPCIONISTA)
- **Validation**: Zod schemas for all inputs, negative stock guard

### Out of Scope
- Seasonal pricing configuration UI (API returns `precioFinal`, no config yet)
- Bulk import/export
- Photo upload (entity field exists, upload deferred)
- Pagination (lists return all records, filtered by salon)

## Capabilities

### New Capabilities
- `catalogo-crud`: CRUD operations for categorías (4), servicios (5), and productos (6 use cases) with role-aware pricing and stock safety guards

### Modified Capabilities
- `api-endpoints`: Add `/api/catalogo/categorias`, `/api/catalogo/servicios`, `/api/catalogo/productos` routes with tenant-scoped access

## Approach

Follow existing hexagonal patterns from the `salon` module:
- **Domain**: 3 repository interfaces (`ICategoriaServicioRepository`, `IServicioRepository`, `IProductoRepository`)
- **Application**: 15 use cases + DTOs (Zod-validated). Stock mutations validate `cantidadStock >= cantidad` before decrement. `precioCompra` stripped at DTO level for non-privileged roles.
- **Infrastructure**: 3 TypeORM repositories + `catalogo.di.ts` for tsyringe registration
- **Presentation**: 3 controllers + `catalogoRoutes.ts`, mounted in `app.ts`

All use cases receive `salonId` from tenant context. Soft-delete via `activo=false` for categorías and servicios.

| Area | Impact | Description |
|------|--------|-------------|
| `apps/api/src/modules/catalogo/` | New | Full hexagonal module |
| `apps/api/src/shared/container.ts` | Modified | Register 15 use cases + 3 controllers + 3 repos |
| `apps/api/src/app.ts` | Modified | Mount `/api/catalogo` routes |
| `packages/validation/src/schemas/` | Modified | Add catalogo Zod schemas |
| `apps/dashboard/src/pages/salon/` | Modified | Add Categorías, Servicios, Inventario pages |
| `apps/dashboard/src/services/` | Modified | Add `catalogoService.ts` API methods |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Stock race conditions (concurrent dec) | Low | Documented limitation; future: pessimistic locking via QueryRunner |
| `precioCompra` leak to unauthorized roles | Low | DTO-level strip, integration test per role |
| Soft-delete cascade confusion | Low | Frontend warns when deactivating category with active servicios |

## Rollback Plan

Revert commit. No DB migration needed — entities already exist. Remove route mount from `app.ts` and DI registration from `container.ts`.

## Dependencies

None. All dependencies (tsyringe, express, typeorm, Zod, @pos-final/types) already in project.

## Success Criteria

- [ ] All 15 use cases pass unit tests with mocked repositories
- [ ] API endpoints return correct schemas (200/201/422)
- [ ] `precioCompra` absent from product responses for MANICURISTA/RECEPCIONISTA
- [ ] Stock decrement rejects when `cantidadStock < cantidad` (422)
- [ ] Frontend pages render list/create/edit for all 3 entities
- [ ] ~600-800 lines changed, single PR under budget
