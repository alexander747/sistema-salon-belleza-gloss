# Archive Report — frontend-overhaul

**Change**: frontend-overhaul
**Archived**: 2026-08-17
**Archive location**: `openspec/changes/archive/2026-08-17-frontend-overhaul/`
**Artifact store mode**: openspec
**Verify verdict**: PASS (dashboard suite 180/180 green, 23 files; API 203/205, 2 pre-existing failures)
**Delivery**: Merged to main via direct commits, 4 batches (A estandarización, B lógica/UX, C cuentas, D pruebas) + sticky action-column fix (`7f577f6`)

## Specs Synced (delta → main)

**None.** This change produced NO per-capability delta specs (`specs/` was empty). The SDD pipeline ran with proposal + reconstructed tasks only (see note in `tasks.md`: `sdd-tasks` did not generate the file; the orchestrator prompt was the task list). Per sdd-archive rules, only existing delta specs are merged — nothing to sync.

## Main Spec Gap (known, not blocking)

The main spec `openspec/specs/finanzas-cuentas/spec.md` does NOT yet document the Batch C backend behavior:

- **Cuentas por cobrar incluye préstamos activos**: `CuentasCobrarUseCase` now merges loans with `estado=ACTIVO` and `saldoPendiente > 0` into the unified list, each row carrying `tipo: 'CLIENTE' | 'PRESTAMO'` (PRESTAMO rows have `cantidadRegistros: null`). The main spec's "GET Cuentas por Cobrar" requirement only describes client aggregation.
- The `alDia` field in `CuentaPagarDTO` IS already reflected: the "Badge Al día en sub-vista Pagar" requirement was added to the main spec by the `frecuencia-pago` archive (`dacadb4`), covering the frontend badge + ordering semantics.

The préstamos-in-cobrar behavior is implemented, tested (`CuentasCobrarUseCase.test.ts`), and verified — this is a documentation gap only. Recommended follow-up: a small delta spec on `finanzas-cuentas` extending "GET Cuentas por Cobrar" to include `tipo` and PRESTAMO rows.

## Merge Decisions

- No delta specs existed → no merge performed, no requirements added/modified/removed in main specs.
- The empty `specs/` directory was preserved in the archive as-is (audit trail of the actual pipeline state).

## Archive Contents

- proposal.md ✅
- specs/ ✅ (empty — no delta specs were produced)
- design.md — NOT produced for this change (no design artifact existed)
- tasks.md ✅ (29/29 tasks complete across batches A–D)
- verify-report.md — NOT produced as a file; verification evidence is in Engram `sdd/frontend-overhaul/apply-progress` (#289, Batch D: 180/180 dashboard, cobertura mantenedores ≥80%) and the orchestrator's verify pass
- archive-report.md ✅ (this file)

## Source of Truth Updated

- No main specs updated by this archive (no delta specs to merge).

## SDD Cycle Complete

Change fully planned (proposal), implemented (4 batches, merged to main), verified (180/180 dashboard + 203/205 API), and archived. Documentation follow-up noted above is non-blocking and outside this archive's scope.
