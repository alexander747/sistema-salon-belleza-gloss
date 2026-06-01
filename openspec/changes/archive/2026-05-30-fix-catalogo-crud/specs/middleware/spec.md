# Delta for Middleware

## MODIFIED Requirements

### Requirement: Tenant Middleware

A tenant middleware MUST extract `salonId` from JWT claims or API key lookup and attach it to `req.salonId`. If no tenant can be determined for a protected route, the middleware MUST reject with 401. SUPERADMIN users with `salonId: null` (encoded as 0 in JWT) MUST fall back to `req.params.salonId`. The `X-Salon-Id` header MUST take priority over URL param fallback for SUPERADMIN impersonation.
(Previously: Tenant middleware with JWT extraction and 401 rejection for unknown tenants)

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
