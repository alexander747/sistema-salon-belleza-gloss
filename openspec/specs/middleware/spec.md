# Core Middleware Specification

## Purpose

Define the five Express middleware layers: global error handler, request logger, tenant isolation, Zod validation, and CORS.

## Requirements

### Requirement: Global Error Handler

A global Express error handler middleware MUST catch all thrown and unhandled errors, returning a structured JSON response with `error.code`, `error.message`, and `error.details`.

#### Scenario: Known error returns structured response

- GIVEN a controller that throws `new AppError('SALON_NOT_FOUND', 'Salon not found', 404)`
- WHEN the request reaches the error handler
- THEN the response is 404
- AND body is `{ "error": { "code": "SALON_NOT_FOUND", "message": "Salon not found", "details": null } }`

#### Scenario: Unknown error returns 500

- GIVEN a controller that throws a generic `Error('something broke')`
- WHEN the error handler catches it
- THEN the response is 500
- AND the body contains a generic message (no stack trace leaked to client)

### Requirement: Request Logger (Bitacora)

Every HTTP request MUST be logged asynchronously and non-blockingly to the Bitacora entity. The middleware MUST capture method, URL, status code, userId, salonId, and duration.

#### Scenario: Successful request is logged

- GIVEN a GET request to `/api/salud`
- WHEN the response is sent
- THEN a Bitacora record is created with the request method, URL, and 200 status

#### Scenario: Logging does not block response

- GIVEN a slow database for Bitacora writes
- WHEN a request is processed
- THEN the response is sent immediately (logging is fire-and-forget)
- AND the Bitacora write completes asynchronously

### Requirement: Tenant Middleware

A tenant middleware MUST extract `salonId` from JWT claims or API key lookup and attach it to `req.salonId`. If no tenant can be determined for a protected route, the middleware MUST reject with 401. SUPERADMIN users with `salonId: null` (encoded as 0 in JWT) MUST fall back to `req.params.salonId`. The `X-Salon-Id` header MUST take priority over URL param fallback for SUPERADMIN impersonation.

#### Scenario: JWT provides salonId

- GIVEN a valid JWT with `{ sub: 1, salonId: 5, rol: 'DUEÑA' }`
- WHEN the tenant middleware processes the request
- THEN `req.salonId` is set to 5

#### Scenario: Public route bypasses tenant check

- GIVEN a request to `GET /api/salud`
- WHEN the middleware chain evaluates
- THEN no tenant extraction is required (route is public)

#### Scenario: SUPERADMIN with null salonId falls back to URL param

- GIVEN a SUPERADMIN user with `salonId: null` (encoded as 0 in JWT)
- AND the URL contains `:salonId` param (e.g., `/api/salones/1/categorias`)
- WHEN the tenantGuard processes the request
- THEN `req.salonId` is set to 1 (the URL param value, not 0)

#### Scenario: Normal user with valid salonId is unaffected

- GIVEN a non-SUPERADMIN user with `salonId: 5`
- WHEN the tenantGuard processes the request
- THEN `req.salonId` remains 5

#### Scenario: SUPERADMIN with X-Salon-Id header keeps impersonation

- GIVEN a SUPERADMIN user with `salonId: null`
- AND the request has `X-Salon-Id: 3` header
- WHEN the tenantGuard processes the request
- THEN `req.salonId` is 3 (header takes priority over URL param)

### Requirement: Zod Validation Middleware

The system MUST use a reusable `validate(schema)` middleware that validates `req.body`, `req.params`, and `req.query` against Zod schemas. Invalid input MUST return 400 with field-level error details.

#### Scenario: Valid body passes validation

- GIVEN a Zod schema `{ email: z.string().email(), password: z.string().min(6) }`
- WHEN a request with `{ email: "a@b.com", password: "123456" }` is sent
- THEN the middleware calls `next()` with validated (and possibly transformed) data on `req.validated`

#### Scenario: Invalid body returns 400 with field errors

- GIVEN the same schema
- WHEN a request with `{ email: "not-an-email", password: "12" }` is sent
- THEN the response is 400
- AND body contains `{ "error": { "code": "VALIDATION_ERROR", "details": { "email": "Invalid email", "password": "String must contain at least 6 characters" } } }`

### Requirement: CORS Configuration

The backend MUST configure CORS to allow requests from both frontend origins (`http://localhost:5173` for React app, `http://localhost:3000` for potential web app). In production, origins MUST be configurable via environment variables.

#### Scenario: Frontend origin allowed

- GIVEN a browser request from `http://localhost:5173`
- WHEN `POST /api/auth/login` is called
- THEN the response includes `Access-Control-Allow-Origin: http://localhost:5173`

#### Scenario: Unknown origin rejected

- GIVEN a browser request from `http://evil.com`
- WHEN any API request is made
- THEN the response is a CORS error (no `Access-Control-Allow-Origin` header returned)
