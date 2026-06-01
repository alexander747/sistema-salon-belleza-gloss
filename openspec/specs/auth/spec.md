# Authentication & Authorization Specification

## Purpose

Define JWT-based authentication, API key auth for n8n, role-based guards, and tenant isolation via salonId injection.

## Requirements

### Requirement: JWT Login

The system MUST expose `POST /api/auth/login` accepting `{ email, password }` and returning `{ accessToken, refreshToken, user }` upon successful credential verification. For superadmin users (`rol = SUPERADMIN`), the returned `salonId` MUST be resolved to the first salon from the database instead of defaulting to 0.

#### Scenario: Valid credentials return tokens

- GIVEN a registered user with email and valid password hash
- WHEN `POST /api/auth/login` is called with correct credentials
- THEN the response status is 200
- AND the body contains `accessToken`, `refreshToken`, and `user` with `rol` and `salonId`

#### Scenario: Invalid credentials return 401

- GIVEN a registered user
- WHEN `POST /api/auth/login` is called with incorrect password
- THEN the response status is 401
- AND the body contains a structured error message

#### Scenario: Superadmin with existing salons receives first salon ID

- GIVEN a superadmin user (`rol = SUPERADMIN`)
- AND the database has at least one salon
- WHEN `POST /api/auth/login` is called with valid credentials
- THEN the response `salonId` is the ID of the first salon ordered by `creadoEn DESC`
- AND `salonId` is NOT 0

#### Scenario: Superadmin with no salons gracefully degrades to 0

- GIVEN a superadmin user (`rol = SUPERADMIN`)
- AND the database has zero salons
- WHEN `POST /api/auth/login` is called with valid credentials
- THEN the response `salonId` is 0
- AND the login is not blocked

### Requirement: Refresh Token Rotation

The system MUST support `POST /api/auth/refresh` accepting a valid refresh token and returning a new access token + new refresh token. Used refresh tokens MUST be invalidated. For superadmin users, the `salonId` in the new access token MUST resolve to the first salon in the database, mirroring login behavior.

#### Scenario: Valid refresh returns new tokens

- GIVEN a valid, unused refresh token
- WHEN `POST /api/auth/refresh` is called with that token
- THEN the response is 200
- AND a new `accessToken` and `refreshToken` are returned

#### Scenario: Reused refresh token is rejected

- GIVEN a refresh token already used once
- WHEN `POST /api/auth/refresh` is called with it again
- THEN the response is 401
- AND the token family is revoked (reuse detection)

#### Scenario: Superadmin refresh returns first salon ID

- GIVEN a superadmin user with an active refresh token
- AND the database has at least one salon
- WHEN `POST /api/auth/refresh` is called with a valid token
- THEN the new `accessToken` contains the first salon's ID as `salonId`
- AND the `salonId` is consistent with the value from login

### Requirement: API Key Authentication for n8n

Routes under `/api/n8n/` MUST authenticate via `X-API-Key` header. Each salon has a unique API key.

#### Scenario: Valid API key grants access

- GIVEN a salon with a registered API key
- WHEN `GET /api/n8n/:salonId/salon` is called with a valid `X-API-Key` header
- THEN the response is 200 with the salon data

#### Scenario: Invalid API key returns 401

- GIVEN a request to an n8n route
- WHEN the `X-API-Key` header is missing or invalid
- THEN the response is 401

### Requirement: Role-Based Guards

The system MUST support a `@RequireRoles('DUEÑA', 'ADMINISTRADOR')` decorator pattern on controllers. Requests without a matching role MUST be rejected with 403.

#### Scenario: Authorized role passes guard

- GIVEN a route decorated with `@RequireRoles('DUEÑA')`
- WHEN a request with a JWT containing `rol: DUEÑA` is sent
- THEN the request reaches the controller handler (status not 403)

#### Scenario: Unauthorized role is rejected

- GIVEN the same route
- WHEN a request with `rol: MANICURISTA` is sent
- THEN the response is 403 Forbidden

### Requirement: Tenant Isolation

The `salonId` MUST be extracted from JWT claims (frontend routes) or from API key lookup (n8n routes). All queries MUST filter by `salonId`.

#### Scenario: Authenticated request scoped to salon

- GIVEN a logged-in user from salon ID 5
- WHEN any tenant-scoped API endpoint is called
- THEN the `salonId` from the JWT is injected into the request context
- AND all database queries filter by `salonId = 5`

#### Scenario: Cross-tenant data leak is prevented

- GIVEN a user from salon ID 5
- WHEN they call an endpoint with a different salon ID in the URL
- THEN the injected `salonId` from JWT takes precedence over URL params

### Requirement: Superadmin Impersonation

A superadmin MUST be able to impersonate any salon by sending `X-Salon-Id` header. The JWT `rol` MUST be `SUPERADMIN` for this to work.

#### Scenario: Superadmin impersonates salon

- GIVEN a superadmin JWT
- WHEN `X-Salon-Id: 10` is set in the request header
- THEN the tenant middleware uses `salonId = 10` (from header) instead of JWT claims

#### Scenario: Non-superadmin cannot impersonate

- GIVEN a non-superadmin JWT
- WHEN `X-Salon-Id: 10` is set
- THEN the header is ignored and the JWT `salonId` is used instead
