# Delta for auth

## MODIFIED Requirements

### Requirement: JWT Login

The system MUST expose `POST /api/auth/login` accepting `{ email, password }` and returning `{ accessToken, refreshToken, user }` upon successful credential verification. For superadmin users (`rol = SUPERADMIN`), the returned `salonId` MUST be resolved to the first salon from the database instead of defaulting to 0.
(Previously: superadmin always received salonId=0 regardless of existing salons)

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
(Previously: refresh returned salonId=0 for superadmin regardless of existing salons)

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
