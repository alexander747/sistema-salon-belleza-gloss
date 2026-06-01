# Tasks: Fix Catálogo CRUD Bugs

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~30 |
| 800-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | auto-forecast |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
800-line budget risk: Low

## Phase 1: Backend — Tenant Guard

- [x] 1.1 In `apps/api/src/presentation/middleware/tenantGuard.ts`: after header impersonation check, add guard — if `req.user?.rol === Rol.SUPERADMIN && req.user?.salonId === 0`, set `req.salonId = Number(req.params.salonId)`
- [x] 1.2 Verify SUPERADMIN with `X-Salon-Id` header still takes priority (existing check at line 23-28 remains first)

## Phase 2: Backend — Servicio LEFT JOIN

- [x] 2.1 In `apps/api/src/modules/catalogo/infrastructure/persistence/TypeORMServicioRepository.ts`: change `innerJoinAndSelect('servicio.categoria', 'categoria')` to `leftJoinAndSelect`
- [x] 2.2 Adjust WHERE clause to handle `categoria.id IS NULL` case — use `(categoria.id IS NULL OR categoria.salonId = :salonId)` as fallback filter when categoria is null

## Phase 3: Frontend — Error Feedback

- [x] 3.1 In `CategoriasPage.tsx`: replace empty `catch {}` blocks with `setActionError('mensaje')` from local error state
- [x] 3.2 In `ServiciosPage.tsx`: same — swap empty catch for `setActionError` state setter
- [x] 3.3 In `ProductosPage.tsx`: same — swap empty catch for `setActionError` state setter

## Phase 4: Verification

- [ ] 4.1 Verify superadmin `eder@gmail.com` can list/create categorías across salones
- [ ] 4.2 Verify servicios with `categoriaId=NULL` appear in GET response (not silently dropped)
- [ ] 4.3 Verify frontend shows error toast/state on failed create/update/delete
- [ ] 4.4 Regression: confirm non-superadmin users are unaffected by tenant guard change
