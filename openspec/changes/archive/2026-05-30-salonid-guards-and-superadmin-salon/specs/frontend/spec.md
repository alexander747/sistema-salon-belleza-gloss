# Frontend Pages Specification

## Purpose

Define data-fetching behavior for dashboard pages that depend on `salonId` context. Standardize null-safety to distinguish between "no salon selected" (`null`/`undefined`) and a valid `salonId` of 0, which is falsy but must not block data fetching.

## Requirements

### Requirement: Salon ID Data-Fetching Guards

Dashboard pages that conditionally fetch data based on `salonId` MUST use `salonId == null` (null-safe equality) to decide whether to fetch. The guard MUST allow `salonId = 0` through and only block when `salonId` is truly absent (`null` or `undefined`).

**Affected pages**: EmpleadasPage, ClientesPage, AgendaPage, DashboardPage, FinanzasPage.

#### Scenario: salonId is 0 — pages fetch data normally

- GIVEN the user has `salonId = 0` assigned
- WHEN the page data-fetching guard evaluates
- THEN the guard does NOT block the fetch
- AND data is requested from the API

#### Scenario: salonId is null — pages gracefully skip fetch

- GIVEN the user has no salon assignment (`salonId` is `null` or `undefined`)
- WHEN the page data-fetching guard evaluates
- THEN the guard blocks the fetch
- AND the page renders an empty state without errors

#### Scenario: salonId is positive — pages fetch normally (unchanged)

- GIVEN the user has a positive `salonId`
- WHEN the page data-fetching guard evaluates
- THEN the guard allows the fetch (behavior unchanged from before)
