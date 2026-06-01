# Monorepo Scaffolding Specification

## Purpose

Establish the monorepo foundation using Turborepo + pnpm, enabling shared tooling and consistent builds across all apps and packages.

## Requirements

### Requirement: Workspace Monorepo

The project MUST use pnpm workspaces or Turborepo with `apps/` (backend, web, landing) and `packages/` (ui, types, validation, config).

#### Scenario: Root install succeeds

- GIVEN a fresh clone of the monorepo
- WHEN `pnpm install` runs at root
- THEN all workspace dependencies resolve without errors
- AND all apps and packages are linked

#### Scenario: Individual package scope build

- GIVEN a workspace with >1 package
- WHEN `pnpm --filter @pos-final/backend build` runs
- THEN only the backend package and its dependencies build

### Requirement: TypeScript Strict

Every package MUST enable `strict: true` in its `tsconfig.json`. Root `tsconfig.base.json` MUST define strict settings extended by all packages.

#### Scenario: Strict compilation passes

- GIVEN a package extending `tsconfig.base.json`
- WHEN `tsc --noEmit` runs
- THEN zero strict TypeScript errors are reported

#### Scenario: Strict catches implicit any

- GIVEN a function with an untyped parameter
- WHEN `tsc --noEmit` runs
- THEN the compiler reports an error for the implicit `any`

### Requirement: Shared ESLint + Prettier

The `@pos-final/config` package MUST provide a shared ESLint flat config and Prettier config consumed by all apps and packages.

#### Scenario: Lint runs across workspace

- GIVEN any app or package file
- WHEN `pnpm lint` runs at the package level
- THEN the shared ESLint config is applied

#### Scenario: Format consistency

- GIVEN any TypeScript file
- WHEN `pnpm format` runs
- THEN Prettier formats according to the shared config (single quotes, trailing commas, 80 print width)

### Requirement: Vitest in Every Code Package

Every package containing source code MUST have Vitest configured. The base config MUST be shared from `@pos-final/config`.

#### Scenario: Tests run per package

- GIVEN a package with tests
- WHEN `pnpm test` runs inside that package
- THEN Vitest discovers and executes all `*.test.ts` files

#### Scenario: Coverage reporting

- GIVEN a package with passing tests
- WHEN `pnpm test --coverage` runs
- THEN a coverage report is generated (threshold: 80%)
