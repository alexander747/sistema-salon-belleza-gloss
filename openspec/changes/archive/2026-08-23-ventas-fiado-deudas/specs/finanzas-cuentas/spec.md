# Delta for finanzas-cuentas

## ADDED Requirements

### Requirement: Abonar deuda desde el tab Cuentas

El dashboard MUST ofrecer una acción "Cobrar/Abonar" por fila de tipo CLIENTE en la sub-vista Por cobrar. El modal SHALL permitir elegir un registro del cliente (desglose), ingresar `monto` y `metodoPago`, y confirmar → `POST /salones/:salonId/registros/:id/pagos`; al éxito la lista SHALL refrescarse sin recargar la página. Las filas de tipo PRESTAMO SHALL permanecer read-only (sin botón; su flujo vive en Préstamos). Errores del backend (409 `MONTO_EXCEDE_PENDIENTE`, 422 `REGISTRO_ANULADO`/`CAJA_CERRADA`) SHALL mostrarse en el modal sin refrescar.

#### Scenario: Abonar y refrescar

- GIVEN cliente con 2 registros pendientes en Por cobrar
- WHEN se abona 20000 EFECTIVO a uno de sus registros
- THEN el modal se cierra, la fila refleja la deuda reducida y la lista se refresca

#### Scenario: Préstamos sin acción

- GIVEN fila tipo PRESTAMO
- THEN la fila NO muestra botón Cobrar/Abonar

#### Scenario: Monto excede el pendiente

- GIVEN modal con monto > montoPendiente del registro elegido
- WHEN submit
- THEN el modal muestra el error 409 del backend y la lista NO se refresca

#### Scenario: Sin caja abierta

- GIVEN no hay caja ABIERTA hoy
- WHEN submit de abono
- THEN el modal muestra 422 `CAJA_CERRADA` y la lista NO se refresca

## MODIFIED Requirements

### Requirement: GET Cuentas por Cobrar

El sistema MUST devolver, para `GET /salones/:salonId/finanzas/cuentas/cobrar`, una agregación paginada por cliente. Solo registros con `estado != 'ANULADO'` y `montoPendiente > 0` SHALL contar. Cada fila MUST incluir `clienteId`, `nombre`, `deudaTotal` (suma computada de `montoPendiente`), `cantidadRegistros`, `antiguedadDias` (días desde la fecha de negocio más antigua, timezone Colombia), `antiguedadBucket` (`0-30` | `31-60` | `61-90` | `90+`) y `registros` (desglose `[{registroId, fechaHora, montoPendiente}]` ordenado por fecha ASC, o `null` para filas de tipo PRESTAMO). El resultado MUST ordenarse por `deudaTotal` DESC y paginarse como `{ data, meta }`.
(Previously: la fila no exponía el desglose por registro)

#### Scenario: Desglose por registro

- GIVEN cliente A con 2 registros ACTIVOS pendientes (15000 y 25000)
- WHEN `GET /salones/1/finanzas/cuentas/cobrar`
- THEN la fila de A tiene `deudaTotal=40000`, `cantidadRegistros=2` y `registros` con 2 entradas ordenadas por fecha ASC (la más antigua primero)

#### Scenario: Préstamo sin desglose

- GIVEN fila tipo PRESTAMO con saldo
- WHEN `GET /salones/1/finanzas/cuentas/cobrar`
- THEN `registros=null`

### Requirement: Tab Cuentas en Dashboard

La página Finanzas MUST incluir un tab "Cuentas" con dos sub-vistas: **Cobrar** (tabla por cliente: nombre, deuda, cantidad de registros, antigüedad, acción Cobrar/Abonar para filas CLIENTE) y **Pagar** (tabla por empleada: pendiente actual, liquidado acumulado). La sub-vista Cobrar SHALL usar paginación (12 por página) y SHALL permitir abonar deudas de clientes (ver "Abonar deuda desde el tab Cuentas").
(Previously: v1 MUST NOT incluir botones de cobro ni mutaciones — sub-vista read-only)

#### Scenario: Renderiza sub-vistas

- GIVEN usuario DUEÑA autenticado con `salonId` y endpoints disponibles
- WHEN se abre el tab Cuentas
- THEN se renderizan las sub-vistas Cobrar y Pagar con datos cargados desde la API

#### Scenario: Acción de cobro en filas CLIENTE

- GIVEN sub-vista Cobrar renderizada con filas de deuda (CLIENTE y PRESTAMO)
- THEN las filas CLIENTE muestran botón "Cobrar/Abonar" AND las filas PRESTAMO no

### Requirement: Documentación de consistencia de deuda

El código del use case de cobrar SHALL documentar la semántica de deuda vigente: (a) los abonos y las devoluciones SÍ reducen `montoPendiente` y `cliente.deudaTotal` (en la misma transacción), (b) la anulación reduce `montoPendiente` a 0 y decrementa la deuda, y (c) `cliente.deudaTotal` es una columna desnormalizada que puede divergir del recomputado (fuente de verdad de la UI: el agregado de CuentasCobrar).
(Previously: documentaba "(a) las devoluciones NO reducen montoPendiente, (b) montoPendiente ignora valorFinal cuando precioAjustado=true, (c) no existe flujo de cobro" — comentarios obsoletos)

#### Scenario: Semántica documentada

- GIVEN el archivo `CuentasCobrarUseCase.ts`
- THEN contiene un comentario referenciando abonos/devoluciones/anulación y el drift de `deudaTotal`
