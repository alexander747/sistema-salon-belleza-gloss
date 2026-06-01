# Tasks: Fix Remaining TypeScript Compilation Errors

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~25 |
| 400-line budget risk | Low |
| 800-line review budget | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | auto-forecast |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Fix top-level awaits in test files | PR 1 (single) | Move to `beforeAll()` in both test files |
| 2 | Fix nullable ID assignments in DTOs/use-cases | PR 1 (single) | `?? 0` fallback across 5 files |
| 3 | Fix SalonController test constructor args | PR 1 (single) | Add mock params, 1 file |
| 4 | Verify compilation and tests | PR 1 (single) | `tsc --noEmit` + vitest |

## Phase 1: Test Infrastructure Fixes

- [x] 1.1 `apps/api/src/__tests__/health.test.ts` — Replace top-level `await import()` with `let createApp; beforeAll(async () => { ... })`
- [x] 1.2 `apps/api/src/presentation/middleware/__tests__/authGuard.test.ts` — Same `beforeAll()` pattern for top-level await

## Phase 2: Nullable ID Fallbacks

- [x] 2.1 `apps/api/src/modules/auth/application/use-cases/LoginUseCase.ts` — Add `?? 0` to 2 `salonId` assignments
- [x] 2.2 `apps/api/src/modules/auth/application/use-cases/RefreshTokenUseCase.ts` — Add `?? 0` to `salonId`
- [x] 2.3 `apps/api/src/modules/auth/application/use-cases/GetCurrentUserUseCase.ts` — Add `?? 0` to `salonId`
- [x] 2.4 `apps/api/src/modules/catalogo/application/dtos/ServicioDTO.ts` — Add `?? 0` to `categoriaId`
- [x] 2.5 `apps/api/src/modules/personas/application/dtos/EmpleadaDTO.ts` — Add `?? 0` to `salonId`

## Phase 3: Controller Test Wiring

- [x] 3.1 `apps/api/src/modules/salon/presentation/controllers/__tests__/SalonController.test.ts` — Add missing mock constructor arguments

## Phase 4: Verification

- [x] 4.1 Run `tsc --noEmit` and confirm zero errors in the API project
- [x] 4.2 Run `vitest` and confirm all existing tests pass
