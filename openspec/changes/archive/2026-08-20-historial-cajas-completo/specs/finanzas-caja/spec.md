# Delta for finanzas-caja

## MODIFIED Requirements

### Requirement: GET Historial de Cajas

The system MUST return paginated cajas of ALL estados via `GET /api/salones/:salonId/caja/cierres?page=&limit=`, ordered by `fechaCaja` DESC, with the envelope `{ ok, data: { data, meta } }` and meta `{ page, limit, total, totalPages }`. When the `estado` param is absent or `estado=TODAS`, the response MUST include cajas of every estado. When `estado=ABIERTA` or `estado=CERRADA`, the response MUST include only that subset AND `meta.total` MUST count only the filtered rows.
(Previously: returned only CERRADA cajas by default; `estado` was optional with an implicit CERRADA default.)

#### Scenario: Historial paginado

- GIVEN 5 cajas for the salon (mixed estados)
- WHEN GET /api/salones/:salonId/caja/cierres?page=1&limit=2
- THEN response MUST have data length 2, meta.total=5, meta.totalPages=3 AND the first item MUST be the most recent fechaCaja

#### Scenario: Historial incluye cajas abiertas por defecto

- GIVEN 2 ABIERTA cajas (fechaCaja 2026-08-16 and 2026-08-17) and 0 CERRADA cajas for the salon
- WHEN GET /api/salones/:salonId/caja/cierres?page=1&limit=12
- THEN response MUST have data length 2, meta.total=2 AND every item MUST have estado=ABIERTA

#### Scenario: Filtro por estado

- GIVEN 2 ABIERTA and 3 CERRADA cajas for the salon
- WHEN GET /api/salones/:salonId/caja/cierres?estado=CERRADA&page=1&limit=12
- THEN response MUST have meta.total=3 AND every item MUST have estado=CERRADA

#### Scenario: Caja de hoy abierta listada

- GIVEN today's caja is ABIERTA and the previous day's caja is CERRADA
- WHEN GET /api/salones/:salonId/caja/cierres
- THEN the first item MUST be today's caja with estado=ABIERTA

## ADDED Requirements

### Requirement: Alerta Caja Pendiente de Cierre

The dashboard Caja tab MUST show a prominent warning banner when the salon has at least one ABIERTA caja whose `fechaCaja` precedes the current Colombia business day (an orphaned open caja). The banner MUST state the count of pending cajas and provide an action to view the most recent one. The banner MUST NOT appear when every ABIERTA caja belongs to today.

#### Scenario: Huérfana de día anterior

- GIVEN an ABIERTA caja with fechaCaja=2026-08-17 and today is 2026-08-20
- WHEN the Caja tab loads
- THEN a warning banner MUST appear stating 1 caja pending closure

#### Scenario: Sin huérfanas

- GIVEN only CERRADA cajas and today's ABIERTA caja for the salon
- WHEN the Caja tab loads
- THEN no pending-closure banner MUST appear

### Requirement: Detalle de Caja Abierta

`GET /api/salones/:salonId/caja/:id/cierre` for an ABIERTA caja MUST return the caja with `estado=ABIERTA` and a reporte whose `montoReal` and `diferencia` are null (an open caja has no arqueo). It MUST NOT fabricate `montoReal=0` or a negative `diferencia`.

#### Scenario: Detalle de caja abierta

- GIVEN an ABIERTA caja (id=9) with registros in EFECTIVO
- WHEN GET /api/salones/:salonId/caja/9/cierre
- THEN response MUST include caja.estado=ABIERTA, reporte.montoReal=null, reporte.diferencia=null AND the list of movimientos

### Requirement: Historial de Cajas en el Dashboard

The dashboard Caja tab historial MUST render every caja returned by the endpoint with a per-row estado badge (ABIERTA green, CERRADA amber), the full column set (fecha, abierta por, cerrada por, inicial, esperado, real, diferencia, estado, acción), and `—` for null arqueo values (esperado/real/diferencia) and for `cierrePorId` on open cajas.

#### Scenario: Lista mixta renderizada

- GIVEN the endpoint returns an ABIERTA and a CERRADA caja for the salon
- WHEN the historial renders
- THEN both badges MUST be visible AND the open caja row MUST show `—` for cerrada por, esperado, real and diferencia

#### Scenario: Reapertura intacta

- GIVEN today's caja is CERRADA and an older ABIERTA orphan exists for the salon
- WHEN the Caja tab loads
- THEN the "Reabrir caja" action MUST still be offered
