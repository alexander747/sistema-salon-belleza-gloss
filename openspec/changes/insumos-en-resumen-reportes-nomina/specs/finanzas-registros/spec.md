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

### Requirement: Paginación de registros con filtros server-side (estado/tipo)

`GET /salones/:salonId/registros` MUST aceptar los query params `estado` y `tipo`, validados
contra valores permitidos, y aplicarlos en el servidor de modo que `search` (filas) y `count`
(`meta.total`) usen EXACTAMENTE los mismos criterios. El dashboard MUST enviar ambos params y
MUST NOT filtrar client-side, para que `meta.total` y las filas renderizadas coincidan siempre.

- `estado`: `ACTIVOS` (excluye `ANULADO`) | `ANULADOS` (solo `ANULADO`) | `TODOS` (default; sin filtro).
- `tipo`: `TODOS` (default) | `SERVICIOS` (`totalServicios > 0`) | `PRODUCTOS` (`totalProductos > 0`).
- Valores inválidos o ausentes ⇒ `TODOS` (preserva la semántica previa del API; no rompe a
  llamadores que no envían los params).
- El fix NO altera la matemática de "Resumen del período" (ya excluye `ANULADO`).

#### Scenario: Activos excluye anulados (fixture real salón 1, 2026-09-04..2026-09-29)

- GIVEN el período 2026-09-04..2026-09-29 del salón 1 con 26 registros (15 activos, 11 anulados)
- WHEN se pide `estado=ACTIVOS`
- THEN `meta.total = 15` y TODAS las filas listadas tienen `estado != ANULADO`

#### Scenario: Anulados lista solo anulados

- GIVEN el mismo período del salón 1
- WHEN se pide `estado=ANULADOS`
- THEN `meta.total = 11`
- AND ninguna fila listada es `ACTIVO`

#### Scenario: Todos lista el período completo

- GIVEN el mismo período del salón 1
- WHEN se pide `estado=TODOS`
- THEN `meta.total = 26`
- AND sin param `estado` (default) el resultado es idéntico (26) — compatibilidad hacia atrás

#### Scenario: search y count usan los mismos criterios

- GIVEN cualquier combinación de `estado`/`tipo`/rango/filtros de persona
- WHEN el repositorio ejecuta `search` y `count` con esos params
- THEN las cláusulas WHERE aplicadas son idénticas
- AND `meta.total` del listado no paginado coincide con la cantidad de filas devueltas

#### Scenario: Filtro por tipo

- GIVEN el mismo período del salón 1
- WHEN se pide `tipo=SERVICIOS`
- THEN `meta.total = 25` y todas las filas tienen `totalServicios > 0`
- AND con `tipo=PRODUCTOS` → `meta.total = 1` (`totalProductos > 0`)
- AND con `tipo=TODOS`/ausente no se filtra por tipo

#### Scenario: El dashboard no filtra client-side

- GIVEN el usuario cambia el selector Activos/Anulados/Todos o el tipo Servicios/Productos
- WHEN se dispara la consulta
- THEN el request incluye `estado` y `tipo` con el valor seleccionado
- AND la tabla renderiza exactamente las filas devueltas por el servidor
- AND el total de la paginación refleja `meta.total` (sin descuadre total/filas)
