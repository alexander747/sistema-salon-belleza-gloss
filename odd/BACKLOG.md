# Backlog — ideas y pendientes para después

Items acordados con el usuario. **Estado al 2026-10-04** (actualizado):

| # | Item | Estado |
|---|------|--------|
| 1 | CARRITO-UNIFICADO | ✅ Hecho (hook `useCarrito`; WalkInModal + VentasPage migrados). Falta sumar `AgendaPage`. |
| 2 | PNL-REVISAR | ✅ Resuelto (auditado; P&L por empleada corregido: gastos del negocio aparte). |
| 3 | CXC-CXP | ✅ Hecho (filtro por nombre en Cuentas + imputación al día resuelta). |
| 4 | CIERRE-MODAL-ANCHO | ✅ Hecho (modal a 920px). |
| 5 | AUDITORIA-QUITAR-PROPINAS | ✅ Hecho (tarjeta de Propinas fuera del modal). |
| 6 | NOMINA-FILTRO-EMPLEADA | ✅ Hecho (filtro por empleada en Pendientes + Historial). |
| 7 | DEPLOY-VPS-SCHEMA | ✅ **Verificado seguro** (read-only en la VPS): 8 columnas nuevas, TODAS aditivas (nullable o NOT NULL con default); sin drops/renames/cambios de tipo. Plan: mysqldump → deploy (synchronize las agrega al boot) → verificar las 8 columnas. |
| 8 | FINANZAS-AUDITORIA | ✅ Auditoría hecha (Wave 1) + fixes aplicados. |
| 9 | NOMINA-PRUEBAS-REALES | ✅ Auditado + regla de comisión corregida (costo real). |
| 10 | GASTOS-AUDITORIA | ✅ Hecho (gasto ahora exige caja abierta). |
| 11 | DEVOLUCIONES-AUDITORIA | ✅ Hecho (rechaza ANULADAS, guarda método, baja arqueo si es efectivo, selector con typeahead + `estado=ACTIVOS`). |

**Follow-ups pendientes:** (a) ✅ los 5 tests de fecha ARREGLADOS (reloj congelado); (b) `AgendaPage`: costo de insumo ya read-only + reglas de descuento (switch + alcance) aplicadas, pero **todavía NO adopta el carrito compartido** (`useCarrito` + `CarritoVenta`) — requiere extender el componente compartido; (c) revisar el doble conteo del capital del préstamo en el P&L (desembolso como GastoEntity); (d) DEPLOY-VPS-SCHEMA: ✅ revisado, seguro (ver arriba) — sólo falta hacer el backup y deployar cuando lo pidas.

**Nada commiteado todavía.**

---

Los detalles de cada item siguen abajo.


---

## CARRITO-UNIFICADO — Un solo carrito para "Registrar servicio" y "Ventas"

**Qué**: el carrito de `WalkInModal` (Registrar servicio) y el de `VentasPage` (sección de Ventas) deben ser **el mismo componente** o, como mínimo, **compartir la misma lógica**: estado del carrito, ítems servicios + productos, precios editables por línea, descuento con alcance (servicios/productos/ambos), propina, pagos/parciales (efectivo + fiado), notas y totales.

**Por qué**: hoy son dos implementaciones paralelas que hacen lo mismo. Cada cambio (precios editables, descuento, validaciones, fidelidad del recibo) hay que replicarlo en ambas y tienden a desincronizarse.

**Dónde**: `apps/pos-dashboard/src/components/WalkInModal.tsx`, `apps/pos-dashboard/src/pages/VentasPage.tsx` (y probablemente `AgendaPage.tsx` al completar citas).

**Notas de enfoque**: definir primero el contrato del carrito (un hook `useCarrito` y/o un componente `CarritoItems` reutilizable) y después migrar pantalla por pantalla. Atención a los tests existentes de cada pantalla (WalkInModal, VentasPage, AgendaPage) y a no romper los payloads de la API.

**Estado**: pendiente (acordado 2026-10-04).

---

## PNL-REVISAR — Verificar los valores del P&L de Zuleidy (un solo día)

**Qué**: revisar el reporte **"💰 P&L Mensual — 2026-10-04 a 2026-10-04 (3 atenciones)"** de **Zuleidy Zamora** y comprobar que **todos los valores concuerden**: ingresos, costo de insumos, comisión/reparto y neto. El usuario reporta que al parecer están mal.

**Por qué**: el usuario sospecha valores incorrectos en el P&L de un día y una empleada puntuales (3 atenciones).

**Dónde**: Reportes en `apps/pos-dashboard/src/pages/FinanzasPage.tsx` (tab Reportes, tarjeta P&L); API `apps/api/src/modules/finanzas/application/use-cases/reporte/PyLMensualUseCase.ts` + `TypeORMRegistroServicioRepository.ts`.

**Contexto relacionado** (ya detectado): en el mismo reporte está "📌 Deudas por cobrar", que es **acumulativo al cierre del período** (filtra sólo `<= hasta`, nunca por `desde`). Eso ya confundió al usuario y conviene confirmar si contamina la lectura del P&L. Revisar también que comisiones e insumos cuadren con los 3 registros del día.

**Estado**: pendiente (acordado 2026-10-04).

---

## CXC-CXP — Cuentas por cobrar/pagar: filtro + paginación, y efecto en los ingresos del día

**Qué**:
1. La pestaña **Cuentas (por cobrar / por pagar)** de Finanzas necesita **filtro** (cliente/proveedor, estado, antigüedad) y **paginación** en la UI.
2. Verificar/resolver el efecto en los **ingresos del día**:
   - Cuando se **cobra** una deuda, ¿pasa a los ingresos del día?
   - Cuando se **paga** una deuda, ¿se descuenta de los ingresos del día?

**Por qué**: sin filtro/paginación la lista se vuelve inmanejable; y las reglas de imputación de cobros/pagos al día no están claras para el usuario.

**Dónde**:
- UI: `apps/pos-dashboard/src/pages/FinanzasPage.tsx` (tab Cuentas).
- API: `apps/api/src/modules/finanzas/application/use-cases/cuentas/CuentasCobrarUseCase.ts` y `CuentasPagarUseCase.ts`; `presentation/controllers/CuentasController.ts` (cobrar/pagar); ruta `/finanzas/cuentas/cobrar`.

**Contexto que ya existe** (a confirmar): el P&L ya tiene una línea `cobrosDeudaAnterior` = pagos recibidos en el período cuya venta es anterior al inicio (deuda vieja); y `use-cases/caja/calcularReporteCierre.ts` documenta la contabilidad de CAJA con abonos. Ojo: `CuentasCobrarUseCase` ya **ordena y pagina del lado del backend** — confirmar si la UI lo expone o si falta cablearlo.

**Estado**: pendiente (acordado 2026-10-04).

---

## CIERRE-MODAL-ANCHO — Agrandar el modal "Detalle del cierre"

**Qué**: el modal **"Detalle del cierre"** (cierre de caja) es demasiado angosto y no deja ver toda la información. Hacerlo **más ancho** (subir el `max-width` del contenedor) para que entre todo cómodo.

**Por qué**: el usuario no puede ver toda la info del cierre sin apretarla / cortarla.

**Dónde**: `apps/pos-dashboard/src/components/caja/CajaTab.tsx` (~L1047, el modal "Detalle del cierre") y su modal/overlay base (probablemente una clase compartida en el CSS del componente o en `packages/ui`).

**Notas**: revisar que sea responsive (que en móvil no se desborde; el ancho extra sólo aplica en desktop). Verificar también los tests de caja si asertan estructura.

**Estado**: pendiente (acordado 2026-10-04).

---

## AUDITORIA-QUITAR-PROPINAS — Quitar la tarjeta de Propinas del modal "Auditoría pre-liquidación"

**Qué**: en el modal **"Auditoría pre-liquidación"** quitar la **tarjeta de Propinas** (ya no se aceptan propinas).

**Por qué**: el salón dejó de aceptar propinas, así que esa tarjeta del cierre de liquidación ya no aporta.

**Dónde**: `apps/pos-dashboard/src/pages/FinanzasPage.tsx` — modal "Auditoría pre-liquidación" (~L3427); la tarjeta es la entrada `label: 'Propinas'` en las tarjetas de totales (~L3603, `auditarTotales.propinas`).

**Notas**: revisar si hay otras tarjetas/percentiles de propina dentro del mismo modal y los tests que las asertan.

**Estado**: pendiente (acordado 2026-10-04).

---

## NOMINA-FILTRO-EMPLEADA — Filtro seleccionable por empleado en Nómina

**Qué**: en la sección **Nómina** (pestaña de Finanzas) agregar un **filtro seleccionable por empleado** (un `select`/buscador) para ver las liquidaciones/pendientes de una empleada puntual en vez de todas juntas.

**Por qué**: hoy la lista mezcla a todas las empleadas y es incómodo encontrar a una; el usuario quiere poder filtrar por empleada (mismo espíritu que el filtro pedido en Cuentas).

**Dónde**: `apps/pos-dashboard/src/pages/FinanzasPage.tsx` — tab Nómina (tabla "Pendientes" ~L2978 y el historial de liquidaciones ~L3354). Ver si conviene filtrar del lado del cliente o exponer `usuarioId` en el endpoint de nómina.

**Notas**: reusar el selector de empleada ya existente en Reportes (`EmpleadaSearchableSelect`) para consistencia. Revisar los tests de Nómina.

**Estado**: pendiente (acordado 2026-10-04).

---

## DEPLOY-VPS-SCHEMA — Verificar que el cambio de esquema no rompa los datos de la VPS

**Qué**: antes de subir los últimos cambios a la VPS, verificar si los **campos nuevos en la BD** impactan los datos ya guardados, y dejar un **script/migración segura** si hace falta.

**Por qué**: la VPS ya tiene datos de producción; un ALTER no aditivo (o un `synchronize` que dropee/recreé) podría romperlos.

**Qué hay que revisar**:
- El commit `af9b2de` (precios editables por línea, descuento % con alcance, insumo editable y varios fixes) y cualquier cambio previo a entidades.
- `apps/api/src/shared/database.ts`: `synchronize: process.env.DB_SYNCHRONIZE === 'true'` — en la VPS el schema se aplica por **synchronize**, no por migraciones. Confirmar el valor real de `DB_SYNCHRONIZE` en la VPS.
- Indicios de diseño aditivo ya existentes: `RegistroServicioEntity.ts:71` ("Nullable + default para que el ALTER de synchronize no rompa filas existentes") y las migraciones 0016/0017 (documentan el contrato).
- Comparar el esquema de la VPS contra las entidades para confirmar el delta real (columnas a agregar) y que ninguna sea NOT NULL sin default, rename ni drop.

**Cómo se arreglaría**: si son aditivas con default → `synchronize` las agrega solo (o un `ALTER TABLE ... ADD COLUMN ... DEFAULT ...`). Si aparece alguna destructiva → script manual ANTES del deploy + backup.

**Notas**: hacer **backup de la BD de la VPS antes de deployar** igual, por las dudas. Inspeccionar/tocar la VPS requiere **autorización explícita** del usuario.

**Estado**: pendiente (acordado 2026-10-04).

---

## FINANZAS-AUDITORIA — Revisar todo el módulo de Finanzas contra la BD

**Qué**: auditoría completa del **módulo de Finanzas** (UI + API) para verificar que **lo que muestra/calcula concuerda con la BD y con la realidad**, y detectar **bugs o inconsistencias**.

**Por qué**: el usuario quiere una revisión integral — ya aparecieron varias dudas (deudas acumuladas, P&L de Zuleidy, imputación de cobros/pagos al día, tira de reconciliación, propinas).

**Alcance** (a cubrir):
- Resumen del día / Caja (apertura-cierre, arqueos, `calcularReporteCierre`).
- Registros (totales, descuento, comisión/reparto, insumos).
- Cuentas por cobrar / pagar.
- Nómina (pendientes, liquidaciones, comisiones, sueldo fijo).
- Reportes (P&L cash-basis, deudas, cobros de deuda anterior).
- Gastos, devoluciones, préstamos.

**Cómo**: para cada pantalla, comparar los valores calculados contra consultas SQL directas sobre la BD **con datos reales**; revisar los `use-cases` de `apps/api/src/modules/finanzas` y sus repositorios; buscar sobre-conteo, doble conteo, filtros mal aplicados (p. ej. deudas por cobrar acumulativo) y estados mal excluidos (ANULADO).

**Se solapa con**: `PNL-REVISAR` y `CXC-CXP` (son casos puntuales de esta auditoría).

**Notas**: se puede dividir en sub-revisiones por sección. Involucra leer la BD real (local y/o VPS, con autorización).

**Estado**: pendiente (acordado 2026-10-04).

---

## NOMINA-PRUEBAS-REALES — Revisar y probar Nómina con casos reales

**Qué**: revisar y **probar a fondo la sección Nómina** armando **casos reales** (empleadas concretas con sueldo fijo, comisiones, bonos, liquidaciones) para verificar que los cálculos están correctos y detectar bugs o inconsistencias con lo real.

**Por qué**: el usuario sospecha que la Nómina puede no cuadrar con la realidad (comisiones, sueldos, bonos, totales pagados) y quiere validarlo con casos concretos.

**Alcance**:
- Pendientes por empleada (comisiones acumuladas, sueldo fijo, bono horario).
- Liquidaciones (pre-liquidación / auditoría, totales, historial).
- Fórmula de comisión: `max(0, servNeto − insumos) × %`; sueldo fijo; bono por horario.
- Cuadre contra los registros reales del período.

**Cómo**: armar casos con datos reales (o cargarlos en local), calcular el esperado a mano / con SQL, y comparar contra lo que devuelve la UI/API. Documentar cada discrepancia.

**Se relaciona con**: `FINANZAS-AUDITORIA` (Nómina es parte de su alcance) y `NOMINA-FILTRO-EMPLEADA`.

**Dónde**: UI `apps/pos-dashboard/src/pages/FinanzasPage.tsx` (tab Nómina); API `apps/api/src/modules/finanzas/application/use-cases/nomina/` + `ComisionService` + `NominaPendienteUseCase`.

**Estado**: pendiente (acordado 2026-10-04).

---

## GASTOS-AUDITORIA — Revisar y probar Gastos (¿descuenta del dinero?)

**Qué**: revisar y **probar el módulo de Gastos**: verificar que todo esté correcto y entender/confirmar **qué pasa cuando se carga un gasto** — ¿se descuenta del dinero?, ¿de dónde?, ¿qué efecto tiene en caja y en el P&L?

**Por qué**: el usuario no tiene claro el efecto real de un gasto sobre el dinero y quiere verificarlo con pruebas.

**Preguntas a responder**:
- Al cargar un gasto, ¿de dónde sale el dinero? ¿Se descuenta de la caja del día / del efectivo disponible?
- ¿Afecta el P&L / la utilidad neta? ¿En qué período se imputa?
- ¿Se comporta igual un gasto en efectivo que por transferencia? ¿Y si no hay caja abierta?
- ¿Cómo interactúan gastos, devoluciones y préstamos?

**Cómo**: cargar gastos de prueba (en local), mirar el efecto en Caja y en el P&L, y contrastar con consultas SQL directas. Documentar el comportamiento real y las discrepancias.

**Dónde**: UI `apps/pos-dashboard/src/pages/` (página de Gastos / `FinanzasPage.tsx`); API `apps/api/src/modules/finanzas/application/use-cases/gasto/` + la contabilidad de caja (`calcularReporteCierre`).

**Se relaciona con**: `FINANZAS-AUDITORIA`.

**Estado**: pendiente (acordado 2026-10-04).

---

## DEVOLUCIONES-AUDITORIA — Revisar Devoluciones + selector de venta + ventas canceladas

**Qué**:
1. Revisar **todo el módulo de Devoluciones**: lógica, estados, y los ajustes que hace (deuda `montoPendiente` / `cliente.deudaTotal`, stock, dinero).
2. **Selector de venta del modal "Nueva devolución"**: hoy es un `<select>` que lista **TODAS** las ventas (`registros.map(...)`, sin búsqueda ni tope). Con miles de ventas se vuelve inusable → agregar **typeahead/búsqueda + límite/paginación**.
3. **Ventas canceladas**: al parecer aparecen ventas canceladas/anuladas en el selector. Revisar qué ventas deberían ser elegibles (excluir ANULADO/CANCELADA) y toda la lógica asociada.

**Por qué**: el selector infinito no escala; y hay dudas sobre ventas canceladas dentro de la lógica de devoluciones.

**Dónde**: `apps/pos-dashboard/src/pages/FinanzasPage.tsx` — componente `DevolucionesTab` (~L2286), modal "Nueva devolución" (~L2510) y el `<select>` de Venta (~L2517, `registros.map`). API: `apps/api/src/modules/finanzas/application/use-cases/devolucion/` (`CreateDevolucionUseCase`) y el endpoint que alimenta `registros`.

**Notas**: reusar el patrón `TypeaheadSelect` (creado para Cliente/Empleada en el modal de ventas).

**Estado**: pendiente (acordado 2026-10-04).
