# Delta for Liquidación / Nómina

## ADDED Requirements

### Requirement: Insumo informativo en nómina pendiente

`GET /api/salones/:salonId/finanzas/nomina` MUST calcular y exponer por empleada y por período
`totalCostoBaseInsumos = Σ serviciosItems[].costoBaseInsumos`, sobre el MISMO conjunto `delPeriodo`
usado para `totalComisionesPendientes` (misma fecha de negocio `COALESCE(fechaHora, creadoEn)`,
`estaPagadaEmpleada=false`, registros `ANULADO` excluidos), de modo que reconcilie con la comisión
ya neteada. El campo SHALL ser informativo: la comisión YA está neteada de insumos, por lo que
`totalAPagar` MUST NOT restarlos de nuevo. El campo SHALL ser opcional en el DTO
(`totalCostoBaseInsumos?: number`) para no romper consumidores existentes. No se persiste columna
nueva ni migración: el valor se computa on-demand.

#### Scenario: Insumo por empleada reconcilia con el fixture

- GIVEN lucía con el registro 189 pendiente (item 105 g × 800 = 84000) en el período
- WHEN GET /api/salones/1/finanzas/nomina
- THEN la fila de lucía tiene `totalCostoBaseInsumos`=84000

#### Scenario: Insumo informativo no altera el total a pagar

- GIVEN empleada con comisiones ya neteadas=267600, propinas=0, fijo=0, y insumos del período=84000
- WHEN GET /finanzas/nomina
- THEN `totalAPagar`=267600 (los insumos NO se restan otra vez)

#### Scenario: Mismo filtro de período que la comisión

- GIVEN una empleada con un registro fuera del `delPeriodo` cuyo item cuesta 50000
- WHEN GET /finanzas/nomina
- THEN ese item NO suma a `totalCostoBaseInsumos` (solo el `delPeriodo` cuenta)

#### Scenario: Sin insumos ni items → 0

- GIVEN empleada sin registros pendientes o con items costoBaseInsumos=0 en el período
- WHEN GET /finanzas/nomina
- THEN `totalCostoBaseInsumos`=0 (no se omiten filas por este campo)

#### Scenario: UI muestra etiqueta informativa

- GIVEN nómina pendiente con totalCostoBaseInsumos=84000
- WHEN se renderiza la tarjeta de la empleada
- THEN muestra la etiqueta "Insumos (ya descontados de la comisión)" con $84000
