# Proposal: Insumos en resumen, reportes y nómina

## Intent

Supply cost (`totalCostoBaseInsumos`) is already computed and returned by `/finanzas/resumen`
and `/finanzas/pyl`, but it is hidden in the Registros summary and shown **ungated** in Reportes.
The owner wants it visible to DUEÑA/ADMINISTRADOR/CONTADOR/SUPERADMIN only, enforced at the API,
and surfaced in nómina as an informational figure so the already-netted commission is explainable.

## Scope

### In Scope
- Registros "Total insumos" card (`FinanzasPage.tsx:936-961`, card `:943-948`) restored, rendered only for privileged roles.
- Reportes (P&L + export) restricted to privileged roles at the **route** level (`403` for the rest); no column stripping.
- Backend `resumen` omission of `totalCostoBaseInsumos` **and** `balanceNeto` for non-privileged roles (the latter is an exact derivation of the former).
- Nómina: per-employee and per-period `totalCostoBaseInsumos`, computed on demand with the same `delPeriodo` filter as `comisionCalculada`; labeled as already discounted.
- Extract ONE shared privileged-roles source (backend `isPrivilegedRole` + routes use the same list; frontend `isPrivilegedRole(user)`).

### Out of Scope
- Caja/arqueo, cierre de turno, resumen mensual, home KPIs.
- Persisting insumo per liquidación (`LiquidacionEntity` column/migration) — deferred until an immutable historical snapshot is required.
- Excel Movimientos per-line insumo column (P&L sheet already carries the total).

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `finanzas-reportes`: `pyl`/`exportar` are privileged-only (`403`); `resumen` omits `totalCostoBaseInsumos` + `balanceNeto` for non-privileged roles.
- `finanzas-registros`: privileged-only display of period supply cost.
- `finanzas-liquidacion`: pending payroll exposes `totalCostoBaseInsumos` as an informational, non-deducted-again figure.

## Approach

Owner decision: the whole Reportes option is for DUEÑA, ADMINISTRADOR, CONTADOR, SUPERADMIN only.
Backend guards `/finanzas/pyl` and `/finanzas/exportar` with `requireRole(...PRIVILEGED_ROLES_LIST)`
(same single source as the controllers) → non-privileged get `403`. `resumen` stays accessible
(it powers Registros) but **omits** `totalCostoBaseInsumos` and `balanceNeto` for non-privileged
callers, so the insumo cost cannot be derived via devtools. Frontend reuses the extracted
`isPrivilegedRole(user)` helper. Nómina sums `serviciosItems[].costoBaseInsumos` over the exact
`delPeriodo` set already used for `comisionCalculada` (`NominaPendienteUseCase.ts:316`) and labels the
line explicitly as already subtracted from commission.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `apps/pos-dashboard/src/pages/FinanzasPage.tsx` | Modified | Cards, role gating, nómina display |
| `apps/api/.../middleware/privilegedRoles.ts` | Created | Única fuente de roles privilegiados |
| `apps/api/.../controllers/ReporteController.ts` | Modified | `resumen` omite insumos+balanceNeto no-priv |
| `apps/api/.../controllers/RegistroController.ts` | Modified | Usa el helper compartido |
| `apps/api/.../routes/finanzas.routes.ts` | Modified | 403 en `pyl`/`exportar` |
| `apps/api/.../liquidacion/NominaPendienteUseCase.ts` | Modified | Per-period insumo total |
| `apps/api/.../dtos/NominaPendienteDTO.ts` | Modified | Expose insumo field |
| Tests (dashboard + api) | Modified | Role-gating and nómina coverage |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Behavior change: MANICURISTA/RECEPCIONISTA lose Reportes entirely (403) | High | Explicit owner sign-off; document in spec |
| `resumen` response-shape divergence breaks consumers | Med | Optional fields; type-check + tests per role |
| Insumo figure misread as double subtraction | Med | Explicit label "ya descontado de la comisión" |
| Drift vs. paid commission | Med | Same `delPeriodo` filter, unit tests assert reconciliation |

## Rollback Plan

Revert the commit(s): restore the previously ungated Reportes card, re-comment the Registros card,
remove the backend omission and the nómina field. No migration exists, so rollback is code-only.

## Dependencies

- None new. Uses existing `delPeriodo`, `REGISTROS_PRIVILEGED_ROLES`, and role enum.

## Success Criteria

- [ ] Privileged roles see "Total insumos" in Registros and can use Reportes; non-privileged do not.
- [ ] `/finanzas/pyl` and `/finanzas/exportar` return `403` to non-privileged; `/finanzas/resumen` omits `totalCostoBaseInsumos` + `balanceNeto` for non-privileged (verified via API).
- [ ] Nómina shows per-employee/per-period insumo, reconciling with the netted commission.
- [ ] `cd apps/api && npx vitest run` and dashboard suite green; `tsc --noEmit` clean.
