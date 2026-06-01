# Delta Spec: Backend API Endpoints

## Domain: backend-endpoints

### Purpose
Verify that all backend API endpoints return correct status codes, auth works correctly, and tenant isolation is enforced.

## Requirements

### Requirement 1: CRUD endpoints return correct status codes

All REST endpoints MUST follow HTTP status code conventions: 200 for successful GET/PUT/DELETE, 201 for POST, 400 for invalid data, 404 for non-existing resources.

#### Scenario: GET existing resource returns 200

- GIVEN a resource exists in the database
- WHEN `GET /api/salones/:id/servicios/:id` is called with valid auth
- THEN response status is 200

#### Scenario: POST valid data returns 201

- GIVEN valid creation data
- WHEN `POST /api/salones/:id/servicios` is called with valid auth
- THEN response status is 201

#### Scenario: POST invalid data returns 400

- GIVEN invalid or incomplete data
- WHEN `POST /api/salones/:id/servicios` is called with valid auth
- THEN response status is 400

#### Scenario: DELETE existing resource returns 200

- GIVEN a resource exists
- WHEN `DELETE /api/salones/:id/servicios/:id` is called with valid auth
- THEN response status is 200

#### Scenario: GET non-existing resource returns 404

- GIVEN a resource ID that does not exist
- WHEN `GET /api/salones/:id/servicios/99999` is called
- THEN response status is 404

### Requirement 2: Auth endpoints

Auth MUST return correct tokens for valid credentials and reject invalid ones. Protected routes MUST require a valid JWT.

#### Scenario: Valid login returns 200 with tokens

- GIVEN valid email and password
- WHEN `POST /api/auth/login` is called
- THEN response status is 200
- AND body includes `accessToken` and `refreshToken`

#### Scenario: Invalid login returns 401

- GIVEN invalid email or password
- WHEN `POST /api/auth/login` is called
- THEN response status is 401

#### Scenario: Protected route without token returns 401

- GIVEN no Authorization header
- WHEN any protected route is called
- THEN response status is 401

### Requirement 3: Tenant isolation

Superadmin users MUST be able to access any salon via `xSalonId` header. Regular users MUST only access their own salon data.

#### Scenario: Superadmin accesses any salon

- GIVEN a superadmin JWT
- WHEN requesting data with `X-Salon-Id` header set to a different salon
- THEN the response returns data for the specified salon

#### Scenario: Regular user scoped to own salon

- GIVEN a DUEÑA JWT for salon 1
- WHEN requesting data with `X-Salon-Id` header set to salon 2
- THEN the response is 403 or scoped to salon 1
