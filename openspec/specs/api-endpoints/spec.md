# Initial API Endpoints Specification

## Purpose

Define the 7 seed API endpoints that prove the foundational architecture works end-to-end.

## Requirements

### Requirement: Health Check

`GET /api/salud` MUST return `{ "status": "ok", "timestamp": "..." }` without authentication.

#### Scenario: Health check returns OK

- GIVEN a running backend server
- WHEN `GET /api/salud` is called
- THEN the response is 200 with body `{ "status": "ok" }` and a current timestamp

#### Scenario: Health check does not require auth

- GIVEN no authentication headers
- WHEN `GET /api/salud` is called
- THEN the response is 200 (public endpoint)

### Requirement: Login

`POST /api/auth/login` MUST accept `{ email, password }` and return JWT tokens with user role and salonId.

#### Scenario: Successful login

- GIVEN a user with email `ana@gloss.com` and correct password
- WHEN `POST /api/auth/login` with those credentials
- THEN response is 200
- AND body includes `accessToken`, `refreshToken`, and `user` object with `rol`, `salonId`, `nombre`

#### Scenario: Wrong password

- GIVEN a registered user
- WHEN `POST /api/auth/login` with wrong password
- THEN response is 401 with error code `INVALID_CREDENTIALS`

### Requirement: Refresh Token

`POST /api/auth/refresh` MUST accept `{ refreshToken }` and return a new access/refresh token pair.

#### Scenario: Valid refresh

- GIVEN a valid refresh token
- WHEN `POST /api/auth/refresh` with that token
- THEN response is 200
- AND body includes new `accessToken` and `refreshToken`

#### Scenario: Expired refresh token

- GIVEN an expired refresh token
- WHEN `POST /api/auth/refresh` with it
- THEN response is 401 with error code `TOKEN_EXPIRED`

### Requirement: Current User Profile

`GET /api/auth/me` MUST return the authenticated user's profile including salon info (name, logoUrl, branding).

#### Scenario: Authenticated profile

- GIVEN a valid JWT
- WHEN `GET /api/auth/me` with `Authorization: Bearer <token>`
- THEN response is 200
- AND body includes `{ id, nombre, email, rol, salon: { id, nombre, logoUrl, colorPrimario, colorSecundario, tema } }`

#### Scenario: Unauthenticated profile request

- GIVEN no JWT
- WHEN `GET /api/auth/me`
- THEN response is 401

### Requirement: Create Salon (Superadmin)

`POST /api/superadmin/salones` MUST create a new salon. Only superadmin users can access this endpoint.

#### Scenario: Superadmin creates salon

- GIVEN a superadmin JWT
- WHEN `POST /api/superadmin/salones` with `{ nombre, numeroWhatsApp, nombreBot }`
- THEN response is 201
- AND the salon is created with a generated API key

#### Scenario: Non-superadmin rejected

- GIVEN a DUEÑA JWT
- WHEN `POST /api/superadmin/salones`
- THEN response is 403

### Requirement: List Salons (Superadmin)

`GET /api/superadmin/salones` MUST return all salons. Pagination is NOT required for this initial version.

#### Scenario: Superadmin lists salons

- GIVEN a superadmin JWT
- WHEN `GET /api/superadmin/salones`
- THEN response is 200
- AND body is an array of salon objects with `{ id, nombre, numeroWhatsApp, activo }`

#### Scenario: Empty salon list

- GIVEN a fresh database with no salons
- WHEN `GET /api/superadmin/salones`
- THEN response is 200
- AND body is an empty array `[]`

### Requirement: n8n Salon Endpoint

`GET /api/n8n/:salonId/salon` MUST return salon data when authenticated with a valid API key. This proves the n8n integration pattern works.

#### Scenario: Valid API key returns salon

- GIVEN a salon with API key `abc-123`
- WHEN `GET /api/n8n/1/salon` with `X-API-Key: abc-123`
- THEN response is 200
- AND body includes salon data without sensitive fields

#### Scenario: API key mismatch

- GIVEN salon ID 1 and a different salon's API key
- WHEN `GET /api/n8n/1/salon` with wrong key
- THEN response is 401 or 403
