# Proposal: Fix Catálogo CRUD Bugs

## Intent

Superadmin users cannot manage categorías/servicios/productos — LIST returns `[]` and CREATE fails with FK violations. Additionally, category-less servicios silently disappear from lists, and frontend operations fail without any user feedback.

## Scope

### In Scope
- Fix tenant guard for SUPERADMIN with `salonId=null` (encoded as 0 in JWT)
- Fix LEFT JOIN so servicios without categoría appear in lists
- Add error feedback (toast/state) in 3 frontend CRUD pages

### Out of Scope
- Paginated lists
- Photo upload
- Bulk operations

## Capabilities

### New Capabilities
None. All fixes restore existing spec compliance.

### Modified Capabilities
- `middleware`: Tenant middleware MUST detect SUPERADMIN with null `salonId` (0 in JWT) and fall back to `req.params.salonId`.
- `servicios-crud`: List Servicios MUST include rows with NULL `categoriaId` via LEFT JOIN.

## Approach

Three mechanical fixes, no architecture changes:

1. **tenantGuard.ts**: Add guard clause — if `req.user?.rol === 'SUPERADMIN'` and `req.user?.salonId === 0`, use `req.params.salonId`
2. **TypeORMServicioRepository.ts**: Replace `innerJoinAndSelect('servicio.categoria')` with `leftJoinAndSelect('servicio.categoria', 'categoria')`, adjust WHERE if needed
3. **Frontend pages**: Replace empty `catch {}` blocks with `setError(mensaje)` in CategoriasPage, ServiciosPage, ProductosPage

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `apps/api/src/presentation/middleware/tenantGuard.ts` | Modified | SUPERADMIN fallback to URL param |
| `apps/api/src/modules/catalogo/infrastructure/persistence/TypeORMServicioRepository.ts` | Modified | LEFT JOIN for nullable categoria |
| `apps/pos-dashboard/src/pages/CategoriasPage.tsx` | Modified | Error feedback on catch |
| `apps/pos-dashboard/src/pages/ServiciosPage.tsx` | Modified | Error feedback on catch |
| `apps/pos-dashboard/src/pages/ProductosPage.tsx` | Modified | Error feedback on catch |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| LEFT JOIN may dupe rows if servicios have multiple relations | Low | Verify query output; add `.distinct()` if needed |
| SUPERADMIN with salonId=0 for non-superadmin role | Low | Strict `rol === 'SUPERADMIN'` check prevents false positives |
| Toast/error state may clash with existing UI patterns | Low | Follow pattern from existing error handling components |

## Rollback Plan

Revert commit. Changes are isolated to 5 files, no DB migration required.

## Dependencies

None. No new packages, schema changes, or external services.

## Success Criteria

- [ ] Superadmin `eder@gmail.com` can list/create categorías in any salon
- [ ] Servicios with `categoriaId=NULL` appear in GET response
- [ ] Frontend shows error message on failed create/update/delete
- [ ] Regression: non-superadmin users unchanged behavior
- [ ] ~30 lines changed across 5 files
