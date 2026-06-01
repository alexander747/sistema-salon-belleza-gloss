# Backend Hexagonal Architecture Specification

## Purpose

Define the strict hexagonal layering for the Express + TypeScript backend, enforcing separation of concerns and the dependency rule.

## Requirements

### Requirement: Layer Separation

The backend MUST have four distinct layers per module: `domain`, `application`, `infrastructure`, and `presentation`. Each layer resides in its own directory: `src/<module>/<layer>/`.

#### Scenario: Layer directories exist

- GIVEN the backend source tree
- WHEN inspecting `src/auth/`
- THEN the directories `domain/`, `application/`, `infrastructure/`, and `presentation/` exist

#### Scenario: Layer boundary violation is detected

- GIVEN a test importing `infrastructure` code from `domain`
- WHEN the architectural lint rule runs
- THEN the violation is reported

### Requirement: Dependency Rule

The dependency rule MUST be: domain depends on nothing; application depends on domain; infrastructure depends on application; presentation depends on application. Infrastructure MUST depend on application interfaces, not on concrete implementations directly.

#### Scenario: Domain has no external imports

- GIVEN a domain entity file (e.g., `Salon`, `Usuario`)
- WHEN checking its imports
- THEN it imports zero framework or infrastructure modules (no TypeORM decorators, no Express types)

#### Scenario: Application depends on domain abstractions

- GIVEN an application use case
- WHEN inspecting its constructor parameters
- THEN it receives domain interfaces (repositories, ports), not infrastructure implementations

### Requirement: DI Container

The system MUST use tsyringe for dependency injection. All infrastructure implementations MUST be registered as singletons in a container module at application startup.

#### Scenario: Container resolves use case

- GIVEN a registered `AuthUseCase` in the tsyringe container
- WHEN `container.resolve(AuthUseCase)` is called
- THEN the resolved instance includes all injected dependencies (repository, token service)

#### Scenario: Duplicate registration errors

- GIVEN two implementations registered for the same interface token
- WHEN the container initializes
- THEN tsyringe throws a registration conflict error

### Requirement: Single-Responsibility Use Cases

Each use case MUST be a class with a single public method (e.g., `execute` or `run`) that performs exactly one business operation.

#### Scenario: Use case has one public method

- GIVEN a use case class `CrearSalonUseCase`
- WHEN inspecting its public API
- THEN it exposes exactly one public method (`execute`)

#### Scenario: Use case testable without infrastructure

- GIVEN a use case with a mocked repository
- WHEN `execute` is called with valid input
- THEN the expected domain operation occurs without any real database call

### Requirement: Thin Controllers

Controllers MUST validate input via Zod, call a single use case method, and format the response. Business logic MUST NOT exist in controllers.

#### Scenario: Controller delegates to use case

- GIVEN a POST `/api/auth/login` request with valid body
- WHEN the controller handler executes
- THEN it calls `authUseCase.execute(dto)` and returns the result, without implementing auth logic itself

#### Scenario: Controller returns validation errors

- GIVEN a POST request with missing required fields
- WHEN the Zod validation fails
- THEN the controller returns a 400 response with structured error details
