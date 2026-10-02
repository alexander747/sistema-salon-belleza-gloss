# Delta for Agenda UI — Formato de Hora AM/PM

## ADDED Requirements

### Requirement: Slots en formato 12h AM/PM

In the "Nueva cita" flow, the dashboard MUST display each available slot label in 12-hour format with an AM/PM suffix (e.g. "08:00 AM", "02:30 PM"). The selected value, the React `key`, the selection comparison, and every value passed to the availability and cita-creation payloads MUST remain the raw 24h `"HH:mm"` string returned by the slots API.

#### Scenario: Slot label renders in 12h

- GIVEN the slots API returns `["08:00", "14:30"]`
- WHEN the "Nueva cita" slot picker renders
- THEN the buttons MUST show "08:00 AM" and "02:30 PM"

#### Scenario: Raw 24h value preserved on selection

- GIVEN the slot picker shows "02:30 PM"
- WHEN the owner clicks it
- THEN `form.horaInicio` MUST equal `"14:30"` AND the selected styling MUST apply to that button

#### Scenario: API still receives 24h value

- GIVEN the owner selected the slot shown as "01:05 PM"
- WHEN the cita is submitted
- THEN the request payload's `fechaHora` MUST be built from the raw `"13:05"` value

### Requirement: Helper formatTimeAMPM exportado

`apps/pos-dashboard/src/utils/format.ts` MUST export a pure function `formatTimeAMPM(value: string): string` that converts a bare `"HH:mm"` string into `"hh:mm AM|PM"`. It MUST NOT use `new Date()`, `Date.parse`, or any date parsing (timezone trap). It MUST pad hours and minutes to two digits, map hour `0` to `12` with `AM`, and map hour `12` to `12` with `PM`.

#### Scenario: Medianoche

- GIVEN the input `"00:00"`
- WHEN `formatTimeAMPM("00:00")` is called
- THEN it MUST return `"12:00 AM"`

#### Scenario: Mediodía

- GIVEN the input `"12:00"`
- WHEN `formatTimeAMPM("12:00")` is called
- THEN it MUST return `"12:00 PM"`

#### Scenario: Tarde con ceros a la izquierda

- GIVEN the input `"13:05"`
- WHEN `formatTimeAMPM("13:05")` is called
- THEN it MUST return `"01:05 PM"`

#### Scenario: Entrada inválida no rompe

- GIVEN an input that does not match `"HH:mm"` (e.g. `""` or `"abc"`)
- WHEN `formatTimeAMPM` is called
- THEN it MUST return the input unchanged and MUST NOT throw

### Requirement: Alcance del cambio limitado al selector de nueva cita

Only the "Nueva cita" slot picker MUST adopt the 12h label. All other time surfaces (agenda calendar cards, FinanzasPage, recibos) MUST remain unchanged by this change.

#### Scenario: Otras superficies sin cambios

- GIVEN the change is applied
- WHEN agenda calendar cards or FinanzasPage times are rendered
- THEN their existing formatting MUST NOT change
