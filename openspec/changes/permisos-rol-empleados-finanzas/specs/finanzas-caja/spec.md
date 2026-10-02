# Delta for Caja

## MODIFIED Requirements

### Requirement: POST Abrir Caja

The system MUST create a caja when `POST /api/salones/:salonId/caja/abrir` is called with `montoInicial`. Only SUPERADMIN, DUEÑA and ADMINISTRADOR MAY open; RECEPCIONISTA MUST receive 403. The caja MUST be created with `fechaCaja = getColombiaDateString()`, `estado = ABIERTA`, and `aperturaPor = req.user.id`. `montoInicial` MUST be required and non-negative. At most one caja per salon and Colombia business day.
(Previously: RECEPCIONISTA could also open.)

#### Scenario: Apertura exitosa

- GIVEN no caja exists for the salon on fechaCaja=2026-08-16
- WHEN POST `/api/salones/:salonId/caja/abrir` with {montoInicial: 50000} by a DUEÑA
- THEN response MUST be 201 with estado=ABIERTA, fechaCaja=2026-08-16, aperturaPor=req.user.id

#### Scenario: Caja ya abierta

- GIVEN an ABIERTA caja exists for the salon on 2026-08-16
- WHEN POST `/api/salones/:salonId/caja/abrir`
- THEN response MUST be 409 with error code CAJA_YA_ABIERTA

#### Scenario: Día ya cerrado

- GIVEN a CERRADA caja exists for the salon on 2026-08-16
- WHEN POST `/api/salones/:salonId/caja/abrir`
- THEN response MUST be 409 with error code CAJA_YA_CERRADA

#### Scenario: RECEPCIONISTA rechazado

- GIVEN a JWT with `rol = RECEPCIONISTA`
- WHEN POST `/api/salones/:salonId/caja/abrir`
- THEN response MUST be 403

### Requirement: POST Cerrar Caja

The system MUST close the salon's open caja when `POST /api/salones/:salonId/caja/cerrar` is called with `montoRealEfectivo`. Only SUPERADMIN, DUEÑA and ADMINISTRADOR MAY close; RECEPCIONISTA MUST receive 403. The caja MUST be ABIERTA (else 409 CAJA_YA_CERRADA). The system MUST compute `montoEsperado` at runtime from the caja's registros (pagos by metodoPago) and gastos, set `diferencia = montoRealEfectivo - montoEsperado`, and mark the caja CERRADA with `cierrePor = req.user.id` and `cierreEn`. Concurrent closes MUST NOT double-close (conditional update on estado=ABIERTA).
(Previously: RECEPCIONISTA could also close.)

#### Scenario: Cierre exitoso

- GIVEN ABIERTA caja with pagos=180000 and gastos=20000; montoRealEfectivo=160000
- WHEN POST `/api/salones/:salonId/caja/cerrar` with {montoRealEfectivo: 160000}
- THEN montoEsperado MUST be 160000, diferencia MUST be 0, estado MUST be CERRADA

#### Scenario: Cierre con diferencia

- GIVEN montoEsperado=180000 and montoRealEfectivo=175000
- WHEN POST `/api/salones/:salonId/caja/cerrar`
- THEN diferencia MUST be -5000

#### Scenario: Caja ya cerrada

- GIVEN the caja is already CERRADA
- WHEN POST `/api/salones/:salonId/caja/cerrar`
- THEN response MUST be 409 with error code CAJA_YA_CERRADA

#### Scenario: Cierre concurrente

- GIVEN two close requests for the same ABIERTA caja arrive simultaneously
- WHEN both call POST `/caja/cerrar`
- THEN exactly one MUST succeed AND the other MUST return 409 CAJA_YA_CERRADA

#### Scenario: RECEPCIONISTA rechazado

- GIVEN a JWT with `rol = RECEPCIONISTA`
- WHEN POST `/api/salones/:salonId/caja/cerrar`
- THEN response MUST be 403

### Requirement: POST Reabrir Caja

The system MUST allow reopening the salon's caja for today when `POST /api/salones/:salonId/caja/reabrir` is called, IF today's caja is already CERRADA. Only SUPERADMIN, DUEÑA and ADMINISTRADOR MAY reopen; RECEPCIONISTA MUST receive 403. The system MUST find today's caja, set estado back to ABIERTA, and CLEAR the close data (montoEsperado, montoRealEfectivo, diferencia, cierrePorId, cierreEn). It MUST NOT create a new caja.
(Previously: RECEPCIONISTA could also reopen.)

#### Scenario: Reabrir caja cerrada hoy

- GIVEN today's caja (id=5) is CERRADA with close data set
- WHEN POST `/api/salones/:salonId/caja/reabrir`
- THEN response MUST be 200 with estado=ABIERTA AND close data cleared AND caja id stays 5

#### Scenario: Reabrir cuando ya está abierta

- GIVEN today's caja is ABIERTA
- WHEN POST `/api/salones/:salonId/caja/reabrir`
- THEN response MUST be 409 with error code CAJA_YA_ABIERTA

#### Scenario: Reabrir sin caja de hoy

- GIVEN no caja exists for today
- WHEN POST `/api/salones/:salonId/caja/reabrir`
- THEN response MUST be 404 with error code CAJA_NO_ABIERTA

#### Scenario: RECEPCIONISTA rechazado

- GIVEN a JWT with `rol = RECEPCIONISTA`
- WHEN POST `/api/salones/:salonId/caja/reabrir`
- THEN response MUST be 403

## ADDED Requirements

### Requirement: Role Access to Caja Reads

Every Caja read endpoint (`GET /caja/actual`, `GET /caja/actual/esperado`,
`GET /caja/cierres`, `GET /caja/:id/cierre`) MUST require SUPERADMIN, DUEÑA or
ADMINISTRADOR; `GET /caja/:id/cierre` MAY additionally allow CONTADOR.
MANICURISTA and RECEPCIONISTA MUST receive 403 on all of them.

#### Scenario: RECEPCIONISTA denied on current caja

- GIVEN a JWT with `rol = RECEPCIONISTA`
- WHEN `GET /api/salones/:salonId/caja/actual`
- THEN the response MUST be 403

#### Scenario: RECEPCIONISTA denied on history

- GIVEN a JWT with `rol = RECEPCIONISTA`
- WHEN `GET /api/salones/:salonId/caja/cierres`
- THEN the response MUST be 403

#### Scenario: CONTADOR may read a close detail

- GIVEN a JWT with `rol = CONTADOR`
- WHEN `GET /api/salones/:salonId/caja/:id/cierre`
- THEN the response MUST be 200
