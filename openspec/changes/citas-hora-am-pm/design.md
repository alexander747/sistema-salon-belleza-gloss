# Design: citas-hora-am-pm

## Approach

One pure string helper formats the slot label; the button keeps binding its
`key`, selection compare, and `onChange` payload to the raw 24h value. No `Date`
anywhere in the new path (avoids the documented timezone trap).

## Files & Changes

| File | Change |
|------|--------|
| `apps/pos-dashboard/src/utils/format.ts` | Add exported `formatTimeAMPM(value: string): string` |
| `apps/pos-dashboard/src/pages/AgendaPage.tsx` | Import helper; render `{formatTimeAMPM(slot)}` at ~1893 |
| `apps/pos-dashboard/src/utils/format.test.ts` | Add unit tests for the 4 spec scenarios |
| `apps/pos-dashboard/src/pages/__tests__/AgendaPage.test.tsx` | Accessor `'10:00'` → `'10:00 AM'` at lines 137 and 1041 |

## `formatTimeAMPM` contract

- Parse with regex `/^(\d{1,2}):(\d{1,2})$/` (split, **never** `new Date()`).
- If no match → return input unchanged, never throw (spec: invalid input).
- Compute: `0 → 12 AM`, `12 → 12 PM`, `>12 → hour−12 PM`, `<12 → AM`.
- Pad hour and minute to 2 digits. Examples: `"00:00"→"12:00 AM"`,
  `"12:00"→"12:00 PM"`, `"13:05"→"01:05 PM"`.

## Invariants preserved in `AgendaPage.tsx`

- `key={slot}`, `form.horaInicio === slot` (selected styling), `onChange({ horaInicio: slot })`.
- `handleCreate` payload at :563 builds `fechaHora` from raw `createForm.horaInicio` — untouched.

## Out of scope

- `FinanzasPage.tsx`'s private `formatTimeAMPM(dateStr)` (parses with `Date`) stays; do not import the new helper there.
- Calendar cards, recibos, API slot generation.

## Testing Strategy (strict TDD)

1. RED: add helper tests + update agenda accessors → run, expect the new helper tests to fail (helper missing) and the two agenda flows to fail (label still `10:00`).
2. GREEN: implement helper + wire label → run, all new tests pass.
3. Verify: `npx vitest run` (baseline 1 known failure, `mobileBottomSheet.test.ts`) + `npx tsc --noEmit`.

## Risks

- Two accessor sites, not one (lines 137 and 1041) — miss either and the suite goes red.
- Do not let the new helper collide with the `FinanzasPage` local function name.
