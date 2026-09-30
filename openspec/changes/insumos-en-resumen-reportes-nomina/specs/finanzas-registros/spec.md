# Delta for Registros de Servicio

## ADDED Requirements

### Requirement: Costo base por tipo de servicio (FIJO / POR_GRAMO)

Al persistir un `RegistroServicioItem`, su `costoBaseInsumos` MUST derivarse del servicio del
catálogo: un servicio FIJO aporta el `costoBaseInsumos` del catálogo; un servicio POR_GRAMO aporta
`gramosUsados × precioPorGramo`. El `totalCostoBaseInsumos` del registro SHALL ser la suma de esos
valores por item.

#### Scenario: Servicio FIJO

- GIVEN un servicio FIJO con costoBaseInsumos=20000
- WHEN se crea un registro con ese item
- THEN el item aporta costoBaseInsumos=20000 y el total del registro es 20000

#### Scenario: Servicio POR_GRAMO

- GIVEN un servicio POR_GRAMO con precioPorGramo=800 y gramosUsados=105
- WHEN se crea el registro
- THEN el item aporta costoBaseInsumos=84000 (105 × 800)

#### Scenario: Item sin costo configurado

- GIVEN un item de servicio FIJO con costoBaseInsumos=0 y sin gramos
- WHEN se crea el registro
- THEN el item aporta 0 y no rompe el cómputo del total

### Requirement: Resumen del período — insumo solo para roles privilegiados

El dashboard Registros MUST mostrar una tarjeta "Total insumos" con
`resumen.totalCostoBaseInsumos` del período/filtros actuales, SOLO cuando el usuario es privilegiado
(SUPERADMIN, DUEÑA, ADMINISTRADOR, CONTADOR) según el helper compartido `isPrivilegedRole(user)`.
Para roles no privilegiados la tarjeta MUST NOT renderizarse. La tarjeta MUST usar el valor del API
(sin recomputo cliente) y MUST mostrar `$0` cuando no hay insumos (no un guion ni otro campo).

#### Scenario: Dueña ve la tarjeta Total insumos

- GIVEN FinanzasPage con user.rol=DUEÑA y resumen.totalCostoBaseInsumos=84000
- WHEN se renderiza Registros
- THEN la tarjeta "Total insumos" muestra $84000

#### Scenario: Recepcionista no ve la tarjeta

- GIVEN user.rol=RECEPCIONISTA
- WHEN se renderiza Registros
- THEN la tarjeta "Total insumos" NO está en el DOM

#### Scenario: Período sin insumos muestra $0

- GIVEN resumen.totalCostoBaseInsumos=0 y rol privilegiado
- WHEN se renderiza Registros
- THEN la tarjeta muestra $0 y ninguna otra métrica se altera
