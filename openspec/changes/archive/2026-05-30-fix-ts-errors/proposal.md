# Proposal: Fix Remaining TypeScript Compilation Errors

## Intent

The `verificar-modulos-pos` verification found 9 TypeScript compilation errors across 7 files. The 3 critical runtime bugs are already fixed. This change addresses the remaining 6 errors (9 instances) so the API compiles cleanly with `tsc --noEmit`.

## Scope

### In Scope
- Fix 2 top-level `await` in test files (move to `beforeAll()`)
- Fix 5 nullable ID assignments in auth DTOs (`salonId` on LoginUseCase, RefreshTokenUseCase, GetCurrentUserUseCase) — use `?? 0`
- Fix 1 nullable `categoriaId` in `ServicioDTO` — use `?? 0`
- Fix 1 nullable `salonId` in `EmpleadaDTO` — use `?? 0`
- Fix missing constructor args in `SalonController.test.ts` — add mocks

### Out of Scope
- Changing DTO types from `number` to `number | null` (cascading changes)
- UI adjustments for nullable IDs
- Refactoring auth use-cases beyond the `?? 0` fix

## Capabilities

### New Capabilities
None

### Modified Capabilities
None

## Approach

Three fix patterns, all trivial:

1. **Top-level await → `beforeAll()`**: Replace `const { createApp } = await import('../app.js')` with `let createApp: any; beforeAll(async () => { ({ createApp } = await import('../app.js')); });`
2. **`?? 0` fallback for nullable FK IDs**: Add `?? 0` where nullable entity fields (e.g., `user.salonId`, `entity.categoriaId`) are assigned to non-nullable DTO fields.
3. **Missing constructor args**: Add mock instances for the 3 missing params in `SalonController` instantiation.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `apps/api/src/__tests__/health.test.ts` | Modified | Top-level await → beforeAll |
| `apps/api/src/presentation/middleware/__tests__/authGuard.test.ts` | Modified | Top-level await → beforeAll |
| `apps/api/src/modules/auth/application/use-cases/LoginUseCase.ts` | Modified | `salonId ?? 0` (2 sites) |
| `apps/api/src/modules/auth/application/use-cases/RefreshTokenUseCase.ts` | Modified | `salonId ?? 0` |
| `apps/api/src/modules/auth/application/use-cases/GetCurrentUserUseCase.ts` | Modified | `salonId ?? 0` |
| `apps/api/src/modules/catalogo/application/dtos/ServicioDTO.ts` | Modified | `categoriaId ?? 0` |
| `apps/api/src/modules/personas/application/dtos/EmpleadaDTO.ts` | Modified | `salonId ?? 0` |
| `apps/api/src/modules/salon/presentation/controllers/__tests__/SalonController.test.ts` | Modified | Add constructor mocks |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| None — all changes are one-liners | N/A | Review diff, run `tsc --noEmit` |

## Rollback Plan

`git revert` the single commit. All changes are mechanical and reversible.

## Dependencies

None. All files are already present in the working tree.

## Success Criteria

- [ ] `tsc --noEmit` passes with zero errors in the API project
- [ ] All existing vitest tests continue to pass
