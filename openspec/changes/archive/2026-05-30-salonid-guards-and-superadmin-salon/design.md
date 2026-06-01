# Design: SalonId Guards Standardization & Superadmin Auto-Assign

## Technical Approach

**Backend**: Inject `ISalonRepository` into `LoginUseCase` and `RefreshTokenUseCase`. After credential verification, if user's `rol === Rol.SUPERADMIN` and `salonId` is falsy, call `salonRepo.findAll()` (already ordered by `creadoEn DESC`) and use the first salon's ID. If DB has zero salons, keep `salonId = 0`.

**Frontend**: Replace `!salonId` → `salonId == null` (guard) and `salonId` → `salonId != null` (condition) in data-fetching paths of 5 pages. `0` is a valid salon but falsy; `== null` catches only `null`/`undefined`.

## Architecture Decisions

| Decision | Choice | Alternatives | Rationale |
|----------|--------|-------------|-----------|
| Superadmin salon resolution | `findAll()` → first by `creadoEn DESC` | Specific salon ID from config/env | Zero-config. Superadmin can still use SalonSwitcher to override. `findAll()` already has the right sort order. |
| Refresh mirroring | Same `findAll()` call in RefreshTokenUseCase | Skip resolution on refresh | Token must be consistent with login behavior. Salons could change between login and refresh — resolving again keeps it fresh. |
| Error on no salons | Silently return `salonId = 0`, don't block login | Throw error / block login | Superadmin creates salons themselves. Blocking login when there are no salons creates a chicken-and-egg problem. |
| `== null` over `=== null` | `salonId == null` | `salonId === null \|\| salonId === undefined` | `== null` catches both `null` and `undefined` in one check, idiomatic JS/TS. Same semantics, less noise. |
| DI token | String token `'ISalonRepository'` | Class token | Consistent with existing pattern in container.ts (line 119). Zero DI config changes needed. |

## Data Flow

```
POST /api/auth/login
        │
        ▼
  LoginUseCase.execute()
        │
        ▼
  usuarioRepo.findByEmail() ──→ user (with rol, salonId)
        │
        ▼
  user.rol === SUPERADMIN && !user.salonId?
        │
   YES  │              NO
        ▼               │
  salonRepo.findAll()    │
        │               │
  0 salons? ──YES──→ salonId=0
        │
   NO
        ▼
  salonId = salons[0].id
        │
        ▼
  tokenService.generateAccessToken({ ..., salonId })
        │
        ▼
  Return { accessToken, refreshToken, user: { salonId } }
```

Same flow in `RefreshTokenUseCase` after `usuarioRepo.findById()`.

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `apps/api/src/modules/auth/application/use-cases/LoginUseCase.ts` | Modify | Inject `ISalonRepository`; add salon resolution block between credential verification and token generation |
| `apps/api/src/modules/auth/application/use-cases/RefreshTokenUseCase.ts` | Modify | Same injection and resolution logic mirroring LoginUseCase |
| `apps/api/src/modules/auth/domain/ports/ITokenService.ts` | Verify | TokenPayload already has `salonId: number` — no change needed |
| `apps/pos-dashboard/src/pages/EmpleadasPage.tsx` | Modify | L187: `if (!salonId) return;` → `if (salonId == null) return;`, L204: `!authLoading && salonId` → `!authLoading && salonId != null` |
| `apps/pos-dashboard/src/pages/ClientesPage.tsx` | Modify | L157, L174: same replacements |
| `apps/pos-dashboard/src/pages/AgendaPage.tsx` | Modify | L262: `if (!salonId) return;` → `if (salonId == null) return;`, L288: `if (!salonId) return;` → same |
| `apps/pos-dashboard/src/pages/DashboardPage.tsx` | Modify | L424: `if (!salonId)` → `if (salonId == null)` |
| `apps/pos-dashboard/src/pages/FinanzasPage.tsx` | Modify | L820, L1151, L1359: `if (!salonId) return;` → `if (salonId == null) return;` |

**Total**: 2 backend files modified (~20 lines added), 5 frontend files modified (~10 lines changed each). **No new files, no DI container changes.**

## Interfaces / Contracts

No new interfaces. Existing `ISalonRepository.findAll()` returns `Promise<SalonEntity[]>` — used as-is.

**LoginUseCase constructor changes** (add 4th injection):

```typescript
@inject('ISalonRepository') private readonly salonRepo: ISalonRepository,
```

New import:
```typescript
import type { ISalonRepository } from '../../../salon/domain/ports/ISalonRepository';
```

Same pattern for `RefreshTokenUseCase`.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Auth (manual) | Superadmin login with 1+ salons | `curl POST /api/auth/login` → verify `user.salonId > 0` |
| Auth (manual) | Superadmin login with 0 salons | `curl POST /api/auth/login` → verify `user.salonId === 0`, status 200 |
| Auth (manual) | Non-superadmin login | `curl POST /api/auth/login` → verify `user.salonId` unchanged |
| Auth (manual) | Superadmin refresh | `curl POST /api/auth/refresh` → verify new token's `salonId` matches login |
| Frontend (manual) | Pages render with salonId=0 | Log in as superadmin, verify all 5 pages fetch data without being blocked |
| Frontend (manual) | Pages handle null salonId | Clear `xSalonId` from localStorage, verify pages show empty state without errors |

No automated test framework in project — manual verification via curl and browser.

## Migration / Rollout

No migration required. No DB schema changes, no config changes.

**Rollback**: Revert `user.salonId ?? 0` in both use cases (2 lines). Revert `salonId == null` → `!salonId` per page (1-2 lines each).

## Open Questions

None — all design decisions are resolved.
