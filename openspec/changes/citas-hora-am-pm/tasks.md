# Tasks: citas-hora-am-pm

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~45–60 (additions + deletions) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | single PR |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Pure helper + UI label + test updates | PR 1 | Single deliverable; tests ship with code; no base branch chain |

## Phase 1: RED — Failing tests first (strict TDD)

- [x] 1.1 Add `describe('formatTimeAMPM')` to `apps/pos-dashboard/src/utils/format.test.ts` covering `"00:00"→"12:00 AM"`, `"12:00"→"12:00 PM"`, `"13:05"→"01:05 PM"`, and invalid (`""`, `"abc"`) returning input unchanged.
- [x] 1.2 Update both slot accessors in `apps/pos-dashboard/src/pages/__tests__/AgendaPage.test.tsx` (lines 137 and 1041): `name: '10:00'` → `name: '10:00 AM'`.
- [x] 1.3 Run `cd apps/pos-dashboard && npx vitest run` and confirm the expected RED: new helper tests fail (no export) and the AgendaPage create flows fail (label still `10:00`).

## Phase 2: GREEN — Implement to pass

- [x] 2.1 Add exported pure `formatTimeAMPM(value: string): string` to `apps/pos-dashboard/src/utils/format.ts` using split/regex parsing, zero-padding, `0→12 AM` and `12→12 PM`; return input unchanged on non-match (no `new Date()`).
- [x] 2.2 Import `formatTimeAMPM` in `apps/pos-dashboard/src/pages/AgendaPage.tsx` and render `{formatTimeAMPM(slot)}` at the slot button (~line 1893), keeping `key={slot}`, `form.horaInicio === slot`, and `onChange({ horaInicio: slot })`.
- [x] 2.3 Run `cd apps/pos-dashboard && npx vitest run` and confirm GREEN: helper and both AgendaPage flows pass.

## Phase 3: Verification & scope guard

- [x] 3.1 Run `cd apps/pos-dashboard && npx tsc --noEmit`; must exit 0.
- [x] 3.2 Run `cd apps/pos-dashboard && npx vitest run`; baseline is **1 known failure** (`src/__tests__/mobileBottomSheet.test.ts`), everything else green — no new failures.
- [x] 3.3 Confirm the payload path is untouched: `AgendaPage.tsx` `handleCreate` (~:563) still builds `fechaHora` from raw `createForm.horaInicio`, and the past-date test (`fechaHora = ...T10:00:00`) still passes.
- [x] 3.4 Scope guard: verify `FinanzasPage.tsx`'s local `formatTimeAMPM` and calendar/recibo time surfaces are unchanged.

## Phase 4: Cleanup

- [x] 4.1 Remove any dead imports/temporary debugging; keep the helper the single source for slot labels.
