# Delta for finanzas-gastos

## ADDED Requirements

### Requirement: Asociación de Gastos a Caja

The system MUST set `cajaId` on a newly created gasto when an ABIERTA caja exists for the salon on the gasto's date. `cajaId` MUST be nullable: a gasto created without an open caja MUST NOT be rejected and MUST persist with cajaId=NULL. The cierre report MUST include the gastos associated to the closed caja by `cajaId`.

#### Scenario: Gasto con caja abierta
- GIVEN an ABIERTA caja (id=5) for the salon today
- WHEN POST /api/salones/:salonId/gastos with a valid payload
- THEN response MUST be 201 AND the gasto MUST persist cajaId=5

#### Scenario: Gasto sin caja abierta
- GIVEN no ABIERTA caja for the salon
- WHEN POST /api/salones/:salonId/gastos with a valid payload
- THEN response MUST be 201 AND the gasto MUST persist with cajaId=NULL

#### Scenario: Gastos en reporte de cierre
- GIVEN a caja (id=5) with 2 associated gastos totaling 30000
- WHEN the cierre report is generated
- THEN report MUST include gastos=30000 for cajaId=5
