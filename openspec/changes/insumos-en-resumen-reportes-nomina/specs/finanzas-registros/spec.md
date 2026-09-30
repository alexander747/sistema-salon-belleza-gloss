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

### Requirement: Nombres y aclaración accesible de las tarjetas de venta y caja

Las tarjetas del resumen de Registros MUST hablar en lenguaje del dueño: "TOTAL INGRESOS" SHALL
renombrarse a **"Ventas del día"** (descripción: "servicios y productos, sin propinas") y "Cobrado"
SHALL renombrarse a **"Entró a caja"** (descripción: "toda la plata que entró, con propinas y deudas
viejas"). "Total insumos" NO se renombra y conserva su gating por rol privilegiado. Cada tarjeta
renombrada MUST exponer un afijo "ⓘ" discreto, alcanzable por teclado y con nombre/descripción
accesible (no solo color). Texto del ⓘ: Ventas del día = "Lo que facturaste en el período: servicios
y productos, sin propinas. Incluye lo fiado (todavía no cobrado)."; Entró a caja = "La plata que
realmente entró en el período: incluye propinas y cobros de deudas anteriores. No cuenta lo fiado.".
El cambio MUST NOT agregar tarjetas ni métricas nuevas. Ambas tarjetas MUST ser visibles para TODOS
los roles.

#### Scenario: Tarjetas renombradas

- GIVEN el resumen de Registros renderizado
- WHEN se inspeccionan las tarjetas de venta y caja
- THEN "Ventas del día" y "Entró a caja" están en el DOM
- AND los textos "TOTAL INGRESOS" y "Cobrado" (etiqueta exacta) NO están

#### Scenario: Afijo ⓘ accesible y re-formulado

- GIVEN FinanzasPage en Registros con totalIngresos y totalCobrado
- WHEN el usuario enfoca o hace hover en el "ⓘ" de cada tarjeta
- THEN "Ventas del día" define devengado sin propinas e incluye lo fiado
- AND "Entró a caja" define efectivo con propinas y deudas anteriores, y excluye lo fiado
- AND ambos afijos son alcanzables por teclado con nombre/descripción accesible

#### Scenario: Sin tarjetas nuevas

- GIVEN el resumen con cualquier combinación de valores
- WHEN se renderiza la grilla de resumen
- THEN la cantidad de tarjetas NO aumenta respecto de antes de PR6
- AND NO aparece una tarjeta "Propinas" ni ninguna métrica nueva

### Requirement: Tira de reconciliación del resumen (sin tarjetas nuevas)

El resumen de Registros MUST mostrar SIEMPRE —sin condicionarla a `totalCobrado !== totalIngresos`—
una tira de reconciliación de solo texto, fuera del `summaryGrid`, con una fila por componente. MUST
NOT agregar tarjetas ni métricas nuevas: la tira es un bloque explicativo. Las filas de componentes
cuyo valor sea 0 MUST ocultarse; las filas de cierre MUST renderizarse siempre. Filas, en orden:

| Etiqueta | Valor | Signo |
|---|---|---|
| Ventas del día | `totalIngresos` | + |
| Quedó fiado | `totalFiadoDia` | − |
| Deudas viejas que te pagaron | `cobrosDeudaAnterior` (API) | + |
| Propinas | `totalPropinas` | + |
| Entró a caja | `totalCobrado` | = |
| Propinas (van a las chicas) | `totalPropinas` | − |
| TU CAJA REAL (sin propinas) | `totalCobrado − totalPropinas` | = |

`TU CAJA REAL` MUST calcularse como `totalCobrado − totalPropinas` (plata que entró menos propinas;
lo fiado ya está excluido porque nunca entró). Todo monto MUST formatearse con `formatCurrency`. La
tira MUST usar los valores del API (el único cálculo cliente es la resta de cierre) y MUST ser
responsive: en mobile MUST apilarse/encoger sin scroll horizontal y permanecer legible.

#### Scenario: La tira siempre se renderiza

- GIVEN un resumen con `totalCobrado === totalIngresos` (diferencia 0)
- WHEN se renderiza el resumen de Registros
- THEN la tira de reconciliación está en el DOM (ya no hay línea condicional)
- AND las filas de cierre "Entró a caja" y "TU CAJA REAL" están presentes

#### Scenario: Filas de componente en 0 se ocultan

- GIVEN `totalFiadoDia=0`, `cobrosDeudaAnterior=0` y `totalPropinas=0`
- WHEN se renderiza la tira
- THEN "Quedó fiado", "Deudas viejas que te pagaron" y "Propinas" NO están en el DOM
- AND las filas de cierre siguen presentes

#### Scenario: TU CAJA REAL = Entró a caja − Propinas

- GIVEN `totalCobrado=940000` y `totalPropinas=5000`
- WHEN se renderiza la tira
- THEN "TU CAJA REAL (sin propinas)" muestra $935000

#### Scenario: Reconciliación del día (identidad del owner)

- GIVEN `totalIngresos=100000`, `totalFiadoDia=40000`, `cobrosDeudaAnterior=20000`, `totalPropinas=5000` y `totalCobrado=85000`
- WHEN se renderiza la tira
- THEN muestra Ventas del día 100000, Quedó fiado −40000, Deudas viejas +20000, Propinas +5000
- AND "Entró a caja" 85000 y "TU CAJA REAL" 80000
- AND la identidad `Cobrado = Ventas − Fiado + CobrosDeudaAnterior + Propinas` se cumple

#### Scenario: Período histórico con venta cobrada después

- GIVEN un rango histórico donde una venta del período se pagó en un período posterior
- WHEN se renderiza la tira
- THEN cada fila muestra el valor del API tal cual, sin forzar igualdad ni inventar montos

#### Scenario: Sin scroll horizontal en mobile

- GIVEN un viewport mobile (≤ 480px)
- WHEN se renderiza la tira
- THEN se apila/encoge sin provocar scroll horizontal
- AND el texto permanece legible
