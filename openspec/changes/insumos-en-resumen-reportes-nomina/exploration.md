# Exploration: insumos en resumen, reportes y nómina

**Change**: `insumos-en-resumen-reportes-nomina`
**Project**: `sistema-salon-belleza-gloss`
**Repo**: `/home/hellhammer/Escritorio/proyectos/pos-final`
**Date**: 2026-09-29
**Artifact Store**: hybrid (OpenSpec + Engram)

> Path note: `sdd-init/sistema-salon-belleza-gloss` (Engram #216) recorded the repo path as
> `/home/hellhammer/Escritorio/pos-final` (does not exist). The live repo is
> `/home/hellhammer/Escritorio/proyectos/pos-final`. All line references below are against the live repo.

---

## Request Summary

1. Show a "Total insumos" summary card in **Finanzas → Registros → "Resumen del período"**, visible ONLY for privileged roles (DUEÑA, ADMINISTRADOR, CONTADOR, SUPERADMIN).
2. Make the insumo total available in **reports** and anywhere genuinely needed.
3. Review **nómina** to see how/whether insumos appear there.

Confirmed pre-verified claims:
- `ResumenDiaUseCase` already returns `totalCostoBaseInsumos` (sum of persisted `registros_servicio_items.costoBaseInsumos` for non-ANULADO registros in range). ✅ CONFIRMED (`ResumenDiaUseCase.ts:100,143,146,153`).
- The "🧴 Costo base insumos" card exists but is inside a commented JSX block. ✅ CONFIRMED (`FinanzasPage.tsx:936-961`, card at `943-948`).
- Role enum `Rol` from `@pos-final/types`; `user.rol` available in `FinanzasPage`; privileged list at `:642-646`; `ROLES_CUENTAS` at `:245`. ✅ CONFIRMED.

---

## 1. Current State — where insumo cost exists (COMPUTED / RETURNED / DISPLAYED)

| Location | Computed | Returned | Displayed |
|---|---|---|---|
| `apps/api/.../reporte/ResumenDiaUseCase.ts:100,143,146,153` (`totalCostoBaseInsumos`) | YES | YES (raw `ResumenDiaOutput`) | only frontend; hidden by comment |
| `apps/api/.../dtos/ResumenDiaDTO.ts:6` (`totalCostoBaseInsumos`) | — | — | **DEAD CODE**: interface declared but never imported anywhere (grep confirms only its own declaration). Endpoint returns `ResumenDiaOutput`, not this DTO. |
| `apps/api/.../reporte/PyLMensualUseCase.ts:116,148,166,196` (`costoBaseInsumos`) | YES | YES | YES — ReportesTab P&L card "📦 Insumos" (`FinanzasPage.tsx:4478-4481`), **NOT role-gated** |
| `apps/api/.../services/ExcelExportService.ts:109` `['Insumos (costo base)', pyl.costoBaseInsumos]` | — | — | YES (P&L sheet). Movimientos sheet has **no** insumo column (`MOVIMIENTOS_HEADER:33`, `RegistroMovimiento:11-22`) |
| `apps/api/.../registro/CreateRegistroUseCase.ts:136-139,170-174` (`totalCostoBaseInsumos` feeds commission) | YES | persisted per item | n/a (write path) |
| `apps/api/.../services/ComisionService.ts:11-18` (subtracts insumo from commission base) | YES | — | n/a |
| `apps/api/.../services/CostoInsumoService.ts` (FIJO vs POR_GRAMO per-line cost) | YES | — | n/a |
| `apps/api/.../caja/calcularReporteCierre.ts` (arqueo) | **NO** | NO | NO (cash-only by design, `:57-73`) |
| `apps/api/.../reporte/CierreTurnoUseCase.ts` | NO | NO | NO (only `comisionGanada`, `:46-48`) |
| `apps/api/.../reporte/ResumenMensualUseCase.ts` | NO | NO | NO (`ingresos/gastos/nomina/ganancia`) |
| `apps/api/.../reporte/ROIMensualUseCase.ts` | NO | NO | NO (`ingresos/gastos/nomina/gananciaNeta`) |
| `apps/api/.../liquidacion/NominaPendienteUseCase.ts` | **IMPLICIT** (via `comisionCalculada`) | NO explicit field | NO |
| `apps/api/.../liquidacion/LiquidarEmpleadaUseCase.ts` | IMPLICIT | NO explicit field | NO |
| `apps/api/.../dtos/RegistroServicioItemDTO.ts:8,21` (`costoBaseInsumos` per item) | — | YES (`serviciosItems`) | YES via nómina audit modal (see §5) |
| `apps/pos-dashboard/src/pages/DashboardPage.tsx` (home KPIs) | NO | NO | NO (uses `totalIngresos`/`cantidadAtenciones` from `/finanzas/resumen`) |
| `apps/pos-dashboard/src/utils/reparto.ts` + `components/DesgloseReparto.tsx` | YES (client mirror) | — | YES at sale/cita completion time ("Insumos − $X"); **not a period total** |

Net: the period supply-cost total is **already computed and returned** by two endpoints
(`/finanzas/resumen` → `totalCostoBaseInsumos`, `/finanzas/pyl` → `costoBaseInsumos`) and
already exported to Excel. It is **displayed** only in the ReportesTab P&L (and client-side
in the nómina audit modal). It is **hidden** in the Registros summary card.

---

## 2. Finanzas → Registros summary — exact JSX locations

File: `apps/pos-dashboard/src/pages/FinanzasPage.tsx` (5190 lines).

- `RegistrosTab` component: `:629`.
- `isPrivileged` (RegistrosTab): `:642-646`
  ```
  const isPrivileged = !!user && (
    user.rol === Rol.SUPERADMIN || user.rol === Rol.DUEÑA ||
    user.rol === Rol.ADMINISTRADOR || user.rol === Rol.CONTADOR
  );
  ```
- `Resumen del período` title derived at `:825-833`, rendered at `:881` (`📋 {resumenTitulo}`).
- Summary grid container: `:884-977`.
- Commented insumos card block:
  - Block opens `:936` `{/* Comentado por decisión de negocio: no mostrar métricas sensibles a todo rol`
  - Comisiones `:937-942`
  - **Costo base insumos `:943-948`** (label `🧴 Costo base insumos`, value `resumen.totalCostoBaseInsumos`)
  - Propinas `:949-954`
  - Total gastos `:955-960`
  - Block closes `:961` `*/`
- Separate commented Balance neto block: `:962-976`.
- Last *active* card before the comment: Productos `:930-935`; after the comment the grid closes at `:977`.

Clean insertion point: add a role-gated card between `:935` and `:936`
(e.g. `{isPrivileged && (<motion.div variants={itemVariants} className={styles.summaryCard} …>…</motion.div>)}`),
or uncomment only the insumos card (`943-948`) and wrap it in `{isPrivileged && ( … )}`.
`resumen.totalCostoBaseInsumos` is already typed as required on `FinanzasResumen` (`:30`).

Other role-gating patterns in the same file:
- `ROLES_CUENTAS` + `puedeVerCuentas`: `:244-249` (mirrors backend `requireRole` for `/finanzas/cuentas/*`).
- `puedeVerTab(user, tabKey)`: `:257-266` (tab visibility; RECEPCIONISTA → registros+caja; CONTADOR → all but caja).
- ReportesTab `isPrivileged`: `:4153-4158` (same 4 roles).
- Tab render gate: `:587-603`; `NominaTab` is privileged-ish only via `puedeVerTab` (CONTADOR allowed; RECEPCIONISTA denied).

---

## 3. Reportes tab (Finanzas → 📊 Reportes) and P&L monthly

- `ReportesTab`: `:4132-4798`. Tab gate: `puedeVerTab` (`:596-597`).
- Data:
  - P&L: `GET /finanzas/pyl` (`:4177-4179`), params role-scoped by `buildReportParams` (`:4162-4170`); restricted roles forced to own `usuarioId`.
  - ROI: `GET /finanzas/roi` (`:4193`).
  - Excel: `GET /finanzas/exportar` (`:4234`).
- P&L display sections:
  - "💵 Dinero de caja": Cobrado / Fiado del período / Deudas por cobrar (`:4412-4434`).
  - "📈 Ventas del período": Ingresos brutos, Descuentos, Incrementos, Ingresos netos, Servicios, Productos, Propinas (`:4437-4471`).
  - "📉 Costos y resultado": **Insumos `:4478-4481`**, Comisiones `:4482-4485`, Gastos `:4486-4491`, Devoluciones, Utilidad neta (continues).
- **Critical finding**: the `📦 Insumos` card is **already displayed** and is **not** inside any `isPrivileged` guard. Because `puedeVerTab` lets MANICURISTA (role 4) open Reportes — confirmed by the test at `apps/pos-dashboard/src/pages/__tests__/FinanzasPage.test.tsx:289-307` which opens Reportes as `manicurista` — a non-privileged role currently sees "Insumos" for their own scoped P&L. Requirement "visible ONLY for privileged" implies this card must also be gated, unless the owner explicitly accepts self-scoped insumo visibility for employees.
- Per-employee breakdown in Reportes: **does not exist** as a table. There is only the empleada filter (`EmpleadaSearchableSelect`, `:4316-4342`). A per-employee list would require new backend aggregation.
- Natural place to add a "Total insumos" report metric: it already lives in the "📉 Costos y resultado" section; the change is gating, not location.

---

## 4. Excel export

- Builder: `apps/api/.../services/ExcelExportService.ts`.
  - `buildPyLWorkbook(pyl, movimientos)`: P&L sheet concepts include `['Insumos (costo base)', pyl.costoBaseInsumos]` at `:109`.
  - `exportar()`: `:151-185`; filename `pyl_{desde}_{hasta}.xlsx`.
  - Movimientos sheet: `MOVIMIENTOS_HEADER` `:33` = Fecha, Cliente, Empleada, Servicios, Productos, Propina, Comisión, Valor final, Pendiente — **no insumo column**. Row DTO `RegistroMovimiento` `:11-22` has no insumo field.
- Route/controller: `finanzas.routes.ts:112` → `ReporteController.exportar` (`:167-195`). No `requireRole`, but `usuarioId` is role-scoped exactly like `pyl` (`:176-177`).
- So: the Excel already carries the **period total** in the P&L sheet; it lacks **per-line/per-registro** insumo in the Movimientos sheet.

---

## 5. NÓMINA (the important one)

Backend: `apps/api/.../use-cases/liquidacion/NominaPendienteUseCase.ts`, `LiquidarEmpleadaUseCase.ts`.

### Is supply cost already reflected in the employee's commission?
**Yes, implicitly.** Confirmed formula chain:
- `CreateRegistroUseCase.ts:168-174`:
  `totalServiciosAjustado = round(totalServicios × proporcion)`,
  `comisionCalculada = ComisionService.calcularComision(totalServiciosAjustado, porcentaje, totalCostoBaseInsumos)`.
- `ComisionService.ts:16`: `base = max(0, totalServicios − totalCostoBaseInsumos)`, then `× porcentaje/100`.
- Nómina sums that already-netted value:
  - `NominaPendienteUseCase.ts:316`: `totalComisiones = Σ r.comisionCalculada` over `delPeriodo`.
  - `LiquidarEmpleadaUseCase.ts:103-106`: same.
- Client mirror + UX: `apps/pos-dashboard/src/utils/reparto.ts:102-128`, `components/DesgloseReparto.tsx` ("Cobrado − Insumos = A repartir").

### Is the insumo amount shown anywhere in the nómina UI / liquidation?
- Employee pending cards: **NO**. Breakdown is Comisiones / Propinas / Bono horario / Sueldo fijo only (`FinanzasPage.tsx:2998-3032`). Summary cards are "Pendientes / Total comisiones / Próximo pago" (`:2906-2919`).
- Pre-liquidation audit modal: **YES, client-side only**. Per-line column "Costo base" (`:3607` header, `:3739` row) and totals row with `totales.costoBase` (`:3680,3762`, labelled "Total servicios").
- Liquidation history (historial): **NO**. Table columns `['Empleada','Período','Comisiones','Propinas','Bono horario','Sueldo fijo','Total Pagado','Fecha']` at `:2838`; footer total only sums `totalPagado` (`:2628-2631`).
- Backend contracts have **no** insumo field:
  - `NominaPendienteUseCase.ts:13-27` (`NominaPendienteEmpleada`): no `totalCostoBaseInsumos`.
  - `dtos/NominaPendienteDTO.ts:4` has an unused `totalServicios` but no insumo.
  - `dtos/LiquidacionDTO.ts` / `LiquidacionEntity.ts`: no insumo column/field.

### Natural place to show "insumos descontados del período" per employee
1. **Employee card** (`FinanzasPage.tsx:2998-3032`): add an informational "Insumos (descontados de la comisión)" line + a "Total insumos" summary card (`:2906-2919`). Requires a new backend field on `NominaPendienteEmpleada`, computed in `NominaPendienteUseCase` from the same `delPeriodo` set (sum of `r.serviciosItems[].costoBaseInsumos`, mirroring `ResumenDiaUseCase:139-143`), so it stays consistent with the already-netted commission.
2. **Audit modal**: already there as "Costo base"; could be relabelled "Insumos" to match business language (optional).
3. **Historial/liquidación detail**: to show historical insumo per liquidity, either persist a new `LiquidacionEntity` column + migration, or recompute from the liquidación's linked `registros` (`LiquidacionEntity.registros` relation exists). Persisting is required only if the owner wants an immutable audited snapshot.
4. **Aggregations**: none dedicated; the audit modal's client-side `totales.costoBase` is the only period aggregation today.

---

## 6. Role gating — exact patterns

- **Backend route-level**: `requireRole(...roles)` middleware (`apps/api/src/presentation/middleware/requireRole.ts:5-18`), applied in `finanzas.routes.ts` (e.g. nómina `:73-87`, cuentas `:91-100`, `mensual` `:107-111`). Throws `ForbiddenError` (`INSUFFICIENT_ROLE`).
- **Backend per-row/per-field scoping on a shared endpoint**: `REGISTROS_PRIVILEGED_ROLES = new Set([SUPERADMIN, DUEÑA, ADMINISTRADOR, CONTADOR])` + `isPrivileged`:
  - `RegistroController.ts:11-16,34-40`
  - `ReporteController.ts:16-21,57-63` (`resumenDia`), `:133-135` (`pyl`), `:176-177` (`exportar`)
  Restricted roles are forced to their own `usuarioId`; they cannot filter by cliente.
- **Frontend**: `ROLES_CUENTAS` + `puedeVerCuentas` (`FinanzasPage.tsx:244-249`), `puedeVerTab` (`:257-266`), inline `isPrivileged` (`:642-646`, `:4153-4158`).
- The new card should reuse the **four-role privileged list** (`SUPERADMIN, DUEÑA, ADMINISTRADOR, CONTADOR`), matching `REGISTROS_PRIVILEGED_ROLES` and the two inline `isPrivileged` consts. Recommend extracting a shared `isPrivilegedRole(user)` helper in `FinanzasPage.tsx` (or `utils`) and using it for the new card + the ReportesTab Insumos card.

---

## 7. Where else a supply-cost total/line is "needed"

- **Registros summary card** — requirement 1.
- **ReportesTab P&L "📦 Insumos"** — already present; needs gating to satisfy "privileged only".
- **Excel export** — P&L total present; optionally add per-line insumo to the Movimientos sheet.
- **Nómina** — employee cards / audit modal / historial (see §5).
- **Not needed (by current design)**:
  - Caja/arqueo (`calcularReporteCierre`) is explicitly cash-only.
  - `CierreTurnoUseCase` (employee turn close) is commission/tips/delivery only.
  - `ResumenMensualUseCase` / Dashboard home KPIs have no insumo; adding it there would be a new product decision.
  - `ROIMensualUseCase.gananciaNeta` excludes insumos; if the owner wants a true ROI, insumos would need to be subtracted there too (potential, not requested).
- **Already available per line**: `RegistroServicioItemDTO.costoBaseInsumos` via `serviciosItems` (used by the nómina audit modal).

---

## 8. Approaches

### A. Frontend-only role gating (minimal)
Uncomment/wrap the insumos card in `{isPrivileged && …}` in RegistrosTab, and wrap the existing ReportesTab "📦 Insumos" card in `isPrivileged`. Extract a shared role helper.
- Pros: tiny, no API/migration risk, matches existing frontend gating style.
- Cons: `/finanzas/resumen` and `/finanzas/pyl` still return the field to restricted roles → cosmetic-only gating (leak via API). Does not add per-employee insumo to nómina.
- Effort: Low.

### B. Backend-enforced field visibility + frontend gating
In `ReporteController`, omit `totalCostoBaseInsumos` / `costoBaseInsumos` from responses for non-privileged roles (or return 0), plus frontend gating.
- Pros: real enforcement, no data leak.
- Cons: changes response shape per role; risks type/consumer assumptions; restricted-role P&L (self-view) loses its insumo line; more test churn.
- Effort: Medium.

### C. Nómina explicit insumo (per employee)
Add `totalCostoBaseInsumos` (≥ period) to `NominaPendienteEmpleada` + compute in `NominaPendienteUseCase`; display in employee cards + "Total insumos" summary; optionally persist into `LiquidacionEntity` (+migration) and expose via `LiquidacionDTO` for historial.
- Pros: makes the implicit deduction visible/auditable; answers the owner's nómina question.
- Cons: adds a field used only for display; persisting needs a migration; must be computed from the same `delPeriodo` set to avoid drift vs. netted commission.
- Effort: Medium (UI+use case) / High (if persisting + migration).

---

## Recommendation

**Hybrid of A + C, defer B unless the owner demands true API-level secrecy.**

1. Registros: add the role-gated "🧴 Total insumos" card (or uncomment `:943-948` inside `{isPrivileged && …}`).
2. Reportes: gate the existing "📦 Insumos" card behind `isPrivileged` (decision: confirm whether MANICURISTA should keep self-scoped visibility).
3. Nómina: add `totalCostoBaseInsumos` to `NominaPendienteEmpleada`, compute per period in `NominaPendienteUseCase`, show "Insumos (descontados de la comisión)" in the employee card and a "Total insumos" summary card; relabel the audit modal column. **Do not** persist to `LiquidacionEntity` unless the owner wants historical per-liquidity insumo snapshots.
4. Excel: optional per-line insumo column in the Movimientos sheet.
5. Extract a single `isPrivilegedRole(user)` helper and reuse it in RegistrosTab and ReportesTab.

Rationale: the total already exists in the API and the P&L; the gap is display + role gating + nómina visibility. Avoid a migration until the owner confirms they need immutable historical insumo in liquidaciones.

---

## Affected Areas (files)

- `apps/pos-dashboard/src/pages/FinanzasPage.tsx` — card, role gating, nómina display.
- `apps/api/src/modules/finanzas/application/use-cases/liquidacion/NominaPendienteUseCase.ts` — per-period insumo total.
- `apps/api/src/modules/finanzas/application/dtos/NominaPendienteDTO.ts` — expose insumo (if DTO used).
- `apps/api/src/modules/finanzas/application/use-cases/liquidacion/LiquidarEmpleadaUseCase.ts` — optional persist.
- `apps/api/src/infrastructure/persistence/entities/LiquidacionEntity.ts` + new migration — only if persisting.
- `apps/api/src/modules/finanzas/application/dtos/LiquidacionDTO.ts` — expose field if persisted.
- `apps/api/src/modules/finanzas/application/services/ExcelExportService.ts` — optional Movimientos insumo column.
- `apps/api/src/modules/finanzas/presentation/controllers/ReporteController.ts` — only if approach B.
- Tests: `apps/pos-dashboard/src/pages/__tests__/FinanzasPage.test.tsx`, `.../liquidacion/__tests__/NominaPendienteUseCase.test.ts`, `.../presentation/controllers/__tests__/ReporteController.test.ts`.

---

## Risks

- **Existing leak**: ReportesTab already shows "📦 Insumos" to MANICURISTA (self-scoped). "Privileged-only" implies a behavior change there; needs owner confirmation.
- **API still returns the field to restricted roles** (`/finanzas/resumen`, `/finanzas/pyl`). Frontend-only gating is cosmetic; hidden value is visible in network/devtools.
- **Nómina semantics**: commission is already net of insumos; showing "insumos descontados" must be informational to avoid the appearance of double subtraction.
- **Consistency**: any per-employee insumo must be computed from the exact same `delPeriodo` filter as `comisionCalculada`, otherwise the displayed insumo won't reconcile with the paid commission.
- **Migration risk** if `LiquidacionEntity` gains a column; existing liquidaciones would have no historical value.
- **Dead code trap**: `ResumenDiaDTO` is never imported — do not treat it as the response contract; the endpoint returns `ResumenDiaOutput`.
- **Repo path mismatch** vs. Engram `sdd-init` recorded path — downstream phases must use the live path.
- **800-line review budget**: likely exceeded if approaches B + C-with-migration are both taken; plan work units accordingly.

---

## Ready for Proposal

**Yes.** The requirement is well-scoped. Open decisions for the owner before proposal:
1. Should MANICURISTA keep seeing their self-scoped "Insumos" in Reportes, or is that also privileged-only?
2. Frontend-only gating (cosmetic) vs. backend-enforced field omission (true secrecy)?
3. Should insumo per liquidación be persisted (migration) or computed on demand?
