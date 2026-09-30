# Design: Insumos en resumen, reportes y nómina

## Technical Approach

Supply cost is already persisted per item (`RegistroServicioItem.costoBaseInsumos`) and already
aggregated by `ResumenDiaUseCase` and `PyLMensualUseCase`. This change adds **one coherent
sensitive-field policy** enforced at the controller boundary, one shared role definition per layer,
and one on-demand nómina figure that reuses the existing `delPeriodo` set. No migration, no new
column, no recompute in the frontend (it renders API values only).

## Architecture Decisions

### D1 — Role-gating policy (OWNER DECISION — supersedes field-omission on pyl)

**Choice**: The Reportes surface is entirely privileged (SUPERADMIN, DUEÑA, ADMINISTRADOR, CONTADOR).
`/finanzas/pyl` and `/finanzas/exportar` are gated at the route with
`requireRole(...PRIVILEGED_ROLES_LIST)`; non-privileged callers get `403` and never reach the use case.
`/finanzas/resumen` stays accessible (it powers the Registros tab those roles can use), but for
non-privileged the HTTP response omits `totalCostoBaseInsumos` **and** `balanceNeto` — the only exact
derivation (`balanceNeto = ingresos − gastos − comisiones − insumos`). Omission is by key absence
(not `null`/`0`) and happens at serialization; the use case keeps computing with the real cost.

**Alternatives**: (a) omit only the named insumo key on pyl — rejected by the owner: the whole Reportes
tab is privileged, so a route guard is stronger and simpler than a field-level policy; (b) strip
columns from the Excel workbook — rejected: incoherent (same leak) and produces a role-dependent
workbook shape; (c) frontend-only gating — rejected, cosmetic.

**Rationale**: one route guard + one serialization filter, both driven by a single shared role source.

| Endpoint | Privileged response | Non-privileged response |
|---|---|---|
| `GET /finanzas/resumen` | all keys present | `200`, omit `totalCostoBaseInsumos`, `balanceNeto` |
| `GET /finanzas/pyl` | `200` full P&L | `403` FORBIDDEN / `INSUFFICIENT_ROLE` (route guard) |
| `GET /finanzas/exportar` | `200` xlsx | `403` FORBIDDEN / `INSUFFICIENT_ROLE` (route guard) |
| `GET /finanzas/nomina` | already route-gated to the 4 roles; returns all rows | cannot call |

Kept on `resumen` on purpose: `totalGastos`, `totalComisiones`, `totalIngresos`, `cobrado`,
`totalFiadoDia`. `comisionCalculada` is already net of insumo but not exactly invertible (needs
percentage + `max(0,…)` clamp) — accepted residual, documented.

### D2 — Excel export

**Choice**: gate the route with `requireRole(...PRIVILEGED_ROLES_LIST)`.
**Alternatives**: strip the `Insumos (costo base)` row for non-privileged — rejected: the P&L sheet
also carries `Margen bruto`/`Utilidad neta` (same leak), so stripping one row is incoherent and adds
a role-dependent workbook shape.
**Rationale**: smallest code, real enforcement; mirror it by hiding the "📥 Exportar Excel" button.

### D3 — Single source of truth for role gating

**Backend (new)** `apps/api/src/presentation/middleware/privilegedRoles.ts`:
```ts
export const PRIVILEGED_ROLES_LIST: readonly Rol[] = [Rol.SUPERADMIN, Rol.DUEÑA, Rol.ADMINISTRADOR, Rol.CONTADOR];
export const PRIVILEGED_ROLES = new Set<number>(PRIVILEGED_ROLES_LIST); // derivado → imposible de divergir
export function isPrivilegedRole(rol: number | null | undefined): boolean {
  return rol != null && PRIVILEGED_ROLES.has(rol);
}
```
Replace the duplicated `REGISTROS_PRIVILEGED_ROLES` in `RegistroController.ts:11` and
`ReporteController.ts:16` with imports; use `isPrivilegedRole(req.user?.rol)`. The route guards on
`/finanzas/pyl` and `/finanzas/exportar` spread the same `PRIVILEGED_ROLES_LIST`, so the controller
and the routes can never drift.

**Frontend** extend the existing `apps/pos-dashboard/src/utils/roles.ts` with `PRIVILEGED_ROLES` and
`isPrivilegedRole(user)`. Replace the two inline `isPrivileged` consts (`FinanzasPage.tsx:642-646`,
`:4153-4158`) and make `ROLES_CUENTAS` reference the same list. This is the ONE notion per layer.

### D4 — Nómina insumo computation (on demand)

In `NominaPendienteUseCase.execute`, inside the `for (const periodo of periodos)` loop, reuse the
**same `delPeriodo` array** used by `totalComisiones` (`:302`/`:316`):
```ts
const totalCostoBaseInsumos = delPeriodo.reduce(
  (sum, r) => sum + (r.serviciosItems ?? []).reduce((s, si) => s + Number(si.costoBaseInsumos ?? 0), 0), 0);
// push: totalCostoBaseInsumos: Math.round(totalCostoBaseInsumos)
```
`totalAPagar` is unchanged (no second subtraction). No `LiquidacionEntity` column / migration.

**Screens**: employee card = **yes** (required); summary card "🧴 Total insumos" = **yes** (sums
`pendientesFiltrados`, same aggregation style as `totalComisiones`); historial/liquidación detail =
**no** (no persisted value; deferred); audit modal = **no functional change** (optional relabel
"Costo base" → "Insumos" deferred).

### D5 — Response-shape safety

Backend use-case output types stay **required** (internal consumers like `ExcelExportService:109`
keep type-safety). Only `resumenDia` destructures-for-omit (two keys) at serialization; `pyl` returns
the full output because it is route-gated. Only **HTTP-facing** frontend types become optional
(`FinanzasResumen.totalCostoBaseInsumos?`, `balanceNeto?`), so existing consumers keep compiling.

## Data Flow

```
RegistroServicioItem.costoBaseInsumos (persisted)
 ├─ ResumenDiaUseCase  ──→ /finanzas/resumen ──→ ReporteController (omite insumos+balanceNeto no-priv) ─→ Registros card (privileged)
 ├─ PyLMensualUseCase  ──→ /finanzas/pyl     ──→ requireRole(PRIVILEGED) → 403 no-priv ───────────────→ Reportes card (privileged)
 │                      └─→ ExcelExportService ─→ /finanzas/exportar (requireRole) → 403 no-priv ──────→ xlsx (privileged)
 └─ NominaPendienteUseCase.delPeriodo ─→ /finanzas/nomina (route-gated) ─→ employee card (informational)
```

## Interfaces / Contracts

```ts
// ReporteController.resumenDia, after use case returns `result`:
if (isPrivilegedRole(req.user?.rol)) res.json(result);
else {
  const { totalCostoBaseInsumos: _i, balanceNeto: _b, ...safe } = result;
  res.json(safe);
}
// pyl / exportar: NO omiten claves; el 403 lo aplica requireRole(...PRIVILEGED_ROLES_LIST) en la ruta.
```
```ts
// NominaPendienteUseCase.ts
export interface NominaPendienteEmpleada { /* … */ totalCostoBaseInsumos?: number; }
// NominaPendienteDTO.ts  (mirror contract; endpoint returns the use-case type)
export interface NominaPendienteDTO { /* … */ totalCostoBaseInsumos?: number; }
```
```ts
// FinanzasPage.tsx types — make optional
FinanzasResumen.totalCostoBaseInsumos?: number   // was required (:30)
PyLData.costoBaseInsumos?: number; margenBruto?: number; utilidadNeta?: number; // (:183-191)
NominaEmpleado.totalCostoBaseInsumos?: number;   // (:133)
```

## UI Changes + Copy

| Screen | Change | Copy |
|---|---|---|
| Registros summary | card, `isPrivilegedRole(user)` only; `resumen.totalCostoBaseInsumos ?? 0` | `🧴 Total insumos` |
| Reportes P&L | gate Insumos **and** Utilidad neta cards (D1) | keep `📦 Insumos`, `📊 Utilidad neta` |
| Reportes toolbar | hide "📥 Exportar Excel" for non-privileged | — |
| Nómina employee card | muted line, only when field present | `Insumos (ya descontados de la comisión)` |
| Nómina summary | card `Σ pendientesFiltrados.totalCostoBaseInsumos` | `🧴 Total insumos` |

Never add the insumo line into `totalAPagar`.

## Edge Cases

- ANULADO excluded (existing use-case); no items → `0` (card still shows `$0`).
- Optional keys guarded with `?? 0`; gated cards never read a missing key.
- `req.user` absent → treated non-privileged (omit).
- `Math.round` per registro, matching `ResumenDiaUseCase:143`.
- Residual documented: `GET /registros` still returns `serviciosItems[].costoBaseInsumos` per line
  (used by the audit modal) — out of scope per proposal.
- Multiple period rows per employee → summary sums rows (consistent with `totalComisiones`).

## Testing Strategy (strict TDD)

| Layer | What | Where |
|---|---|---|
| Unit (api) | resumen: DUEÑA has `totalCostoBaseInsumos`+`balanceNeto`; MANICURISTA/RECEPCIONISTA lack both (clave ausente) | `ReporteController.test.ts` |
| Unit (api) | `isPrivilegedRole` true 4 roles / false resto + null/undefined; set y lista coherentes | `privilegedRoles.test.ts` |
| Route (api) | guards registrados en `/finanzas/pyl` y `/finanzas/exportar`; `/finanzas/resumen` sin guard | `finanzas.routes.test.ts` |
| Route (api) | 403 FORBIDDEN/INSUFFICIENT_ROLE real a no-privilegiado y 200 a privilegiado (supertest + requireRole real) | `finanzas.reportes-role.test.ts` |
| Unit (api) | resumen reconciliation fixture 555000−267600−84000 = 203400; ANULADO=0; empty=0 | `ResumenDiaUseCase.test.ts` |
| Unit (api) | nómina: 84000 from 105 g × 800; out-of-period 50000 excluded; no items=0; `totalAPagar`=267600 unchanged | `NominaPendienteUseCase.test.ts` |
| Unit (web) | `isPrivilegedRole` true 4 roles / false others+null | `roles.test.ts` |
| Component | Registros: DUEÑA sees "Total insumos" $84000; RECEPCIONISTA absent; $0 case | `FinanzasPage.test.tsx` |
| Component | Reportes: DUEÑA sees `📦 Insumos`; MANICURISTA absent; Excel button hidden | `FinanzasPage.test.tsx` (update `:475` restricted-export test) |
| Component | Nómina: label present with value; absent when field missing | `FinanzasPage.test.tsx` |
| Static | `cd apps/api && npx tsc --noEmit` + dashboard type-check | — |

## Migration / Rollout

No migration. Rollback is code-only: revert controller omission, route guard, helper, nómina field
and frontend gates; restore the previously ungated Reportes/Excel behavior.

## Work-Unit Slicing Hint (review budget 800 lines)

| Unit | Scope | ~Lines |
|---|---|---|
| PR1 backend gating | `privilegedRoles.ts`, `ReporteController`, `RegistroController`, `finanzas.routes`, controller + routes tests | ~250 |
| PR2 frontend gating | `utils/roles.ts` + test, `FinanzasPage` type optionality, Registros/Reportes/Utilidad cards, Export button, component tests | ~300 |
| PR3 nómina | `NominaPendienteUseCase` + test, `NominaPendienteEmpleada`/DTO, `NominaEmpleado`, employee + summary cards, test | ~250 |

Order PR1 → PR2 → PR3; total likely > 400 (session budget 800) → **chained PRs recommended**. Each
unit is autonomous and independently revertible. Chain strategy: **feature-branch-chain** — PR1 targets
the tracker branch `feat/insumos-reportes-tracker`; PR2 targets PR1's branch; PR3 targets PR2's branch;
the tracker PR aggregates to `main`.

## Open Question (RESOLVED by owner)

The original `/finanzas/pyl` scenario "rol no privilegiado … y `utilidadNeta` sigue calculada"
conflicts with D1 (an exact derivation of `costoBaseInsumos`). **Owner decision (2026-09-29)**: the
whole Reportes tab is for privileged roles only, so `pyl` and `exportar` are route-gated with `403`
(no field omission, no column stripping) and `resumen` omits `totalCostoBaseInsumos` + `balanceNeto`
for non-privileged. The affected delta specs are synced in this same change (PR1).
