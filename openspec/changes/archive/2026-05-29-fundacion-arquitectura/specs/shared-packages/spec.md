# Shared Packages Specification

## Purpose

Define the four shared `@pos-final/*` packages consumed by all apps: UI components, shared types, validation schemas, and config presets.

## Requirements

### Requirement: @pos-final/ui

The UI package MUST export reusable, unstyled components: `Button`, `Input`, `Card`, `Layout`, `Toast`. Components MUST accept a `className` prop for styling.

#### Scenario: Button renders with props

- GIVEN a React app consuming `@pos-final/ui`
- WHEN `<Button variant="primary" onClick={handleClick}>Guardar</Button>` is rendered
- THEN a `<button>` element appears with the text "Guardar" and responds to clicks

#### Scenario: Toast shows notifications

- GIVEN the UI package is imported
- WHEN `toast.success('Salon creado')` is called
- THEN a toast notification appears with the message and auto-dismisses after 5 seconds

### Requirement: @pos-final/types

The types package MUST export shared TypeScript interfaces: `User`, `Salon`, `Role` (enum), `Permission`, `AuthTokens`, `ApiResponse<T>`.

#### Scenario: Interfaces are importable

- GIVEN a consuming app
- WHEN `import { User, Salon, Role } from '@pos-final/types'`
- THEN the types compile without errors

#### Scenario: Role enum values match backend

- GIVEN the `Role` enum from types package
- WHEN comparing to the backend's Rol numeric enum
- THEN values align: `SUPERADMIN = 1, DUEÑA = 2, ADMINISTRADOR = 3, MANICURISTA = 4, RECEPCIONISTA = 5`

### Requirement: @pos-final/validation

The validation package MUST export Zod schemas for DTOs shared between frontend and backend: `LoginDto`, `CreateSalonDto`, `RegisterUserDto`, `RefreshTokenDto`.

#### Scenario: Schema validates on frontend

- GIVEN a React form using `LoginDto` schema
- WHEN the user submits an invalid email
- THEN `LoginDto.safeParse({ email: 'bad', password: '123456' })` returns `{ success: false }` with field errors

#### Scenario: Same schema validates on backend

- GIVEN the same `LoginDto` schema imported in the backend
- WHEN `LoginDto.parse({ email: 'a@b.com', password: '123456' })` is called
- THEN it returns the validated object with correct types

### Requirement: @pos-final/config

The config package MUST export: an ESLint flat config (TypeScript strict, import ordering, no-unused-vars), a Prettier config (single quotes, trailing commas, 80 print width), and a `tsconfig.base.json` (strict, ES2022, NodeNext module resolution).

#### Scenario: ESLint config catches errors

- GIVEN a TypeScript file with an unused variable
- WHEN ESLint runs with the shared config
- THEN the variable is reported as an error

#### Scenario: Prettier formats consistently

- GIVEN a file with mixed quotes
- WHEN Prettier formats with the shared config
- THEN all strings use single quotes

#### Scenario: tsconfig.base.json is extensible

- GIVEN a package with `"extends": "@pos-final/config/tsconfig.base.json"`
- WHEN TypeScript compiles
- THEN strict mode is enabled along with all base settings
