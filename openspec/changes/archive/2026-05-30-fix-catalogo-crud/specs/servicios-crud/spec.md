# Delta for Servicios CRUD

## ADDED Requirements

### Requirement: List Servicios — Nullable Categoria

The system MUST include servicios with NULL `categoriaId` when listing servicios for a salon. The query MUST use LEFT JOIN on `categoria` instead of INNER JOIN to prevent silent omission of category-less servicios. Existing filtering and pricing logic MUST remain unchanged.

#### Scenario: Servicio without category appears in list

- GIVEN a servicio with `categoriaId: NULL` exists for salon X
- WHEN `GET /api/salones/X/servicios`
- THEN the servicio appears in results
- AND `categoria` is `null` in the response (not omitted)

#### Scenario: Servicio with category still works

- GIVEN a servicio with `categoriaId: 5` exists for salon X
- WHEN `GET /api/salones/X/servicios`
- THEN the servicio appears with its category data included
- AND `precioFinal` computation and tenant isolation remain unchanged
