# Proposal: SalonId Guards Standardization & Superadmin Auto-Assign

## Intent

Fix two salonId issues: (1) brittle `!salonId` guards in 5 frontend pages that silently fail when salonId=0, and (2) superadmins landing with no salon context after login, forcing manual SalonSwitcher use.

## Scope

### In Scope
- Standardize `!salonId` → `salonId == null` guards in 5 dashboard pages (Empleadas, Clientes, Agenda, Dashboard, Finanzas)
- Backend: auto-assign first salon to superadmin in LoginUseCase and RefreshTokenUseCase
- JWT payload and login response must include the resolved salonId

### Out of Scope
- SalonSwitcher UI changes
- Multi-salon superadmin dashboard
- Changing salonId type from `number|null`

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `auth`: JWT Login requirement — superadmin salonId resolution changes from always-0 to first-available-salon (from `findAll()` ordered by `creadoEn DESC`). RefreshTokenUseCase mirrors this behavior.

## Approach

**Backend** (~10 lines): Inject `ISalonRepository` into `LoginUseCase` and `RefreshTokenUseCase`. After successful credential verification, if user is SUPERADMIN (`rol=1`) and `salonId` is 0/null, call `salonRepo.findAll()` and pick the first salon's ID. If DB has zero salons, keep `salonId=0` — don't block login.

**Frontend** (~10 lines per file): Replace `if (!salonId)` with `if (salonId == null)` in data-fetching guards of 5 pages. The `!salonId` pattern treats `0` as falsy and silently blocks data fetch. `salonId == null` only blocks when truly undefined/null. Three pages (Categorias, Productos, Servicios) already use the safe pattern.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `apps/api/src/modules/auth/application/use-cases/LoginUseCase.ts` | Modified | Auto-assign first salon for superadmin |
| `apps/api/src/modules/auth/application/use-cases/RefreshTokenUseCase.ts` | Modified | Mirror salonId resolution on refresh |
| `apps/web/src/pages/dashboard/EmpleadasPage.tsx` | Modified | L187, L204: `!salonId` → `salonId == null` |
| `apps/web/src/pages/dashboard/ClientesPage.tsx` | Modified | L157, L174: same fix |
| `apps/web/src/pages/dashboard/AgendaPage.tsx` | Modified | L262, L288: same fix |
| `apps/web/src/pages/dashboard/DashboardPage.tsx` | Modified | L424: same fix |
| `apps/web/src/pages/dashboard/FinanzasPage.tsx` | Modified | L820, L1151, L1359: same fix |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| First salon in DB is wrong for superadmin | Low | Superadmin can still use SalonSwitcher + `X-Salon-Id` impersonation |
| `salonId==null` changes behavior for undefined vs 0 | Low | 0 is falsy but a valid salon; `null`/`undefined` mean no salon assigned — correct distinction |
| DI container may need registration for ISalonRepository | Low | Verify binding exists before injecting; add if missing |

## Rollback Plan

- **Backend**: Revert to `salonId ?? 0` in both use cases — 2-line revert
- **Frontend**: Revert `salonId == null` back to `!salonId` per file — each revert is 1-2 lines

## Dependencies

None — backend and frontend changes are independent.

## Success Criteria

- [ ] Superadmin logs in, JWT contains `salonId` of first salon in DB (not 0, unless DB has zero salons)
- [ ] Superadmin token refresh preserves resolved `salonId`
- [ ] All 5 pages fetch data correctly when `salonId=0` (currently blocked by `!salonId`)
- [ ] Existing behavior for non-superadmin users is unchanged
