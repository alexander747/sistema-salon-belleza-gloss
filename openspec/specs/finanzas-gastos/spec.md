# Gastos y Devoluciones — Specification

## Purpose

Track salon expenses (operational and fixed), and manage product returns with optional inventory reintegration.

## ADDED Requirements

### Requirement: POST Crear Gasto

The system MUST create a `GastoEntity` with `descripcion`, `monto`, `metodoPago`, `esGastoFijo`, `categoria`, and `fecha`. Fijo expenses count toward monthly ROI; operativos count toward daily summary.

#### Scenario: Create gasto operativo
- GIVEN descripcion="Escobas", monto=10000, metodoPago=EFECTIVO, esGastoFijo=false, fecha=today
- WHEN POST /api/salones/:salonId/gastos
- THEN response MUST be 201 with the created gasto

#### Scenario: Create gasto fijo
- GIVEN descripcion="Arriendo", monto=500000, esGastoFijo=true
- WHEN created
- THEN esGastoFijo MUST be true AND the gasto is excluded from daily summary

### Requirement: GET Listar Gastos

The system MUST return gastos filtered by optional `fechaDesde` and `fechaHasta`.

#### Scenario: Filter by date range
- GIVEN gastos on different dates
- WHEN GET /api/salones/:salonId/gastos?fechaDesde=2026-05-01&fechaHasta=2026-05-31
- THEN only gastos within that range are returned

### Requirement: DELETE Gasto

The system MUST hard-delete a gasto by ID.

#### Scenario: Delete existing gasto
- GIVEN an existing gasto
- WHEN DELETE /api/salones/:salonId/gastos/:id
- THEN response MUST be 204 AND the gasto MUST no longer exist

### Requirement: POST Crear Devolución

The system MUST create a `DevolucionEntity` for a given `registroServicioId`. If `regresaAlStock=true`, it MUST increment the `ProductoEntity.stock` by `cantidad`. The devolución MUST reduce the registro's montoPendiente and cliente's deudaTotal.

#### Scenario: Devolución with stock return
- GIVEN a producto with stock=10, registro with montoPendiente=20000
- WHEN POST /api/salones/:salonId/devoluciones with productoId, cantidad=1, regresaAlStock=true, montoDevolucion=5000
- THEN producto stock MUST be 11 AND montoPendiente MUST decrease by 5000

#### Scenario: Devolución without stock return
- GIVEN regresaAlStock=false, producto with stock=10
- WHEN created
- THEN producto stock MUST remain 10 AND montoPendiente MUST still decrease

### Requirement: GET Listar Devoluciones por Registro

The system MUST return all devoluciones for a given registro.

#### Scenario: List by registro
- GIVEN a registro with 2 devoluciones
- WHEN GET /api/salones/:salonId/registros/:id/devoluciones
- THEN response MUST include both devoluciones
