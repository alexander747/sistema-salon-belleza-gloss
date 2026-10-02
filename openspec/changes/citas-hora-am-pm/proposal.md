# Proposal: citas-hora-am-pm

## Intent

In the "Nueva cita" flow, available time slots render as raw 24h strings ("08:00", "14:30"). The salon owner wants them displayed in 12h with AM/PM ("08:00 AM", "02:30 PM") for readability. The value sent to the API MUST stay the raw 24h `"HH:mm"`.

## Scope

### In scope
- `AgendaPage.tsx` "Nueva cita" slot-picker button label (line ~1893 `{slot}`).
- New exported pure helper `formatTimeAMPM(value: string): string` in `apps/pos-dashboard/src/utils/format.ts`.

### Out of scope
- API/slot generation (`agenda-disponibilidad`): slots keep returning 24h `"HH:mm"`.
- Calendar/card times and other surfaces (FinanzasPage, recibos) — separate surfaces, unchanged.
- The non-exported `formatTimeAMPM(dateStr)` in `FinanzasPage.tsx` that parses with `new Date()`.

## Approach

Add a string-only formatter (split `"HH:mm"`, no `Date`) in `utils/format.ts`, import it in `AgendaPage.tsx`, and render `{formatTimeAMPM(slot)}`. Keep `key`, selection compare (`form.horaInicio === slot`) and `onChange({ horaInicio: slot })` bound to the raw 24h value; `fechaHora` continues to be built from raw `horaInicio`.

## Rollback

Revert the label change and the helper; no data/API impact.

## Risks

- `AgendaPage.test.tsx:137` locates the slot by accessible name `'10:00'`; the visible label change alters the accessible name and must be updated in the same work unit.
