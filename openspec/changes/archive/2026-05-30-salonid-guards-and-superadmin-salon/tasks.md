# Tasks: SalonId Guards Standardization & Superadmin Auto-Assign

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~40–55 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | single-pr |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Backend + Frontend | PR 1 (single) | Both changes are independent but tiny (~50 lines); single PR is safe |

## Status

- [x] Phase 1: Backend — Superadmin salon resolution
- [x] Phase 2: Frontend — Guard standardization
- [ ] Phase 3: Manual verification

## Phase 1: Backend — LoginUseCase + RefreshTokenUseCase salonId resolution

- [x] 1.1 Add `ISalonRepository` import and injection to `LoginUseCase` constructor
- [x] 1.2 Insert salon resolution block after password verification: if `rol === SUPERADMIN && !salonId`, call `salonRepo.findAll()` and use first salon's ID (keep 0 if no salons)
- [x] 1.3 Replace `user.salonId ?? 0` token payload with resolved `salonId`
- [x] 1.4 Add `ISalonRepository` import and injection to `RefreshTokenUseCase` constructor
- [x] 1.5 Insert identical salon resolution block after `usuarioRepo.findById()` in `RefreshTokenUseCase`
- [x] 1.6 Replace `user.salonId ?? 0` in `RefreshTokenUseCase` with resolved `salonId`

## Phase 2: Frontend — Guard standardization across 5 pages

- [x] 2.1 `EmpleadasPage.tsx`: Replace `!salonId` → `salonId == null` (L187) and `salonId` → `salonId != null` (L204)
- [x] 2.2 `ClientesPage.tsx`: Replace `!salonId` → `salonId == null` (L157) and `salonId` → `salonId != null` (L174)
- [x] 2.3 `AgendaPage.tsx`: Replace `!salonId` → `salonId == null` (L262, L288)
- [x] 2.4 `DashboardPage.tsx`: Replace `!salonId` → `salonId == null` (L424)
- [x] 2.5 `FinanzasPage.tsx`: Replace `!salonId` → `salonId == null` (L820, L1151, L1359)

## Phase 3: Manual verification (no test framework)

- [ ] 3.1 Verify superadmin login returns `user.salonId > 0` with 1+ salons in DB
- [ ] 3.2 Verify superadmin login returns `user.salonId === 0` with 0 salons in DB
- [ ] 3.3 Verify non-superadmin login behavior unchanged (uses their assigned salonId)
- [ ] 3.4 Verify superadmin refresh token returns resolved salonId matching login
- [ ] 3.5 Verify all 5 pages fetch data correctly when `salonId = 0`
- [ ] 3.6 Verify all 5 pages gracefully show empty state when `salonId` is `null`
