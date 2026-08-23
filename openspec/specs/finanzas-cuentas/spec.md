# Cuentas por Cobrar y Pagar — Specification

## Purpose

Visibilidad financiera read-only: deuda pendiente de clientes (por cobrar) agregada desde registros no anulados, y obligaciones del salón con empleadas (por pagar) combinando nómina pendiente y liquidaciones acumuladas. v1 no expone ninguna mutación.

## Requirements


### Requirement: GET Cuentas por Cobrar

El sistema MUST devolver, para `GET /salones/:salonId/finanzas/cuentas/cobrar`, una agregación paginada por cliente. Solo registros con `estado != 'ANULADO'` y `montoPendiente > 0` SHALL contar. Cada fila MUST incluir `clienteId`, `nombre`, `deudaTotal` (suma computada de `montoPendiente`), `cantidadRegistros`, `antiguedadDias` (días desde el `creadoEn` más antiguo, timezone Colombia) y `antiguedadBucket` (`0-30` | `31-60` | `61-90` | `90+`). El resultado MUST ordenarse por `deudaTotal` DESC y paginarse como `{ data, meta }`.

#### Scenario: Agrega deuda de un cliente
- GIVEN cliente A en salón 1 con 2 registros ACTIVO (montoPendiente 15000 y 25000) y 1 anulado (montoPendiente 30000)
- WHEN `GET /salones/1/finanzas/cuentas/cobrar`
- THEN la fila de cliente A tiene `deudaTotal=40000`, `cantidadRegistros=2` y el anulado NO suma

#### Scenario: Cliente sin deuda excluido
- GIVEN cliente B con solo registros `montoPendiente=0`
- WHEN `GET /salones/1/finanzas/cuentas/cobrar`
- THEN cliente B NO aparece en el resultado

#### Scenario: Orden y paginación
- GIVEN 25 clientes con deuda; cliente con mayor deuda es "Ana"
- WHEN `GET /salones/1/finanzas/cuentas/cobrar?page=1&limit=10`
- THEN `meta.total=25`, `data` tiene 10 filas ordenadas por `deudaTotal` DESC y la primera es "Ana"

#### Scenario: Bucket de antigüedad
- GIVEN el registro pendiente más antiguo de cliente C fue creado hace 45 días (hora Colombia)
- WHEN `GET /salones/1/finanzas/cuentas/cobrar`
- THEN `antiguedadDias=45` y `antiguedadBucket='31-60'`

### Requirement: GET Cuentas por Pagar

El sistema MUST devolver, para `GET /salones/:salonId/finanzas/cuentas/pagar`, una fila por empleada con `empleadaId`, `nombre`, `sueldoFijo`, `porcentajeComisionServicio`, `pendienteActual` (totalAPagar de la nómina pendiente reutilizada) y `liquidadoAcumulado` (suma de `totalPagado` de todas las liquidaciones del historial). Empleadas presentes solo en una de las dos fuentes SHALL igualmente aparecer. La semántica de frontera de mes de la nómina SHALL preservarse sin corrección cross-period y documentarse en el código.

#### Scenario: Pendiente + acumulado
- GIVEN empleada con `totalAPagar=298000` en nómina y liquidaciones historial con `totalPagado` 250000 + 300000
- WHEN `GET /salones/1/finanzas/cuentas/pagar`
- THEN la fila tiene `pendienteActual=298000` y `liquidadoAcumulado=550000`

#### Scenario: Empleada solo en historial
- GIVEN empleada sin registros pendientes (excluida de nómina) con 1 liquidación `totalPagado=200000`
- WHEN `GET /salones/1/finanzas/cuentas/pagar`
- THEN aparece con `pendienteActual=0` y `liquidadoAcumulado=200000`

#### Scenario: Frontera de mes preservada
- GIVEN empleada liquidada este mes sin registros nuevos desde esa liquidación (nómina la excluye)
- WHEN `GET /salones/1/finanzas/cuentas/pagar`
- THEN su fila SHALL reflejar `pendienteActual=0` y el comentario de código documenta la semántica (sin corrección cross-period)

### Requirement: Roles de acceso

Ambos endpoints MUST requerir rol SUPERADMIN, DUEÑA, ADMINISTRADOR o CONTADOR. MANICURISTA y RECEPCIONISTA MUST recibir 403 (la deuda de clientes es sensible).

#### Scenario: Rol privilegiado permitido
- GIVEN JWT con rol CONTADOR y salón válido
- WHEN `GET /salones/1/finanzas/cuentas/cobrar`
- THEN respuesta 200 con `{ data, meta }`

#### Scenario: Rol restringido denegado
- GIVEN JWT con rol RECEPCIONISTA
- WHEN `GET /salones/1/finanzas/cuentas/pagar`
- THEN respuesta 403

### Requirement: Tab Cuentas en Dashboard

La página Finanzas MUST incluir un tab "Cuentas" con dos sub-vistas: **Cobrar** (tabla por cliente: nombre, deuda, cantidad de registros, antigüedad) y **Pagar** (tabla por empleada: pendiente actual, liquidado acumulado). La sub-vista Cobrar SHALL usar paginación (12 por página). v1 MUST NOT incluir botones de cobro ni mutaciones.

#### Scenario: Renderiza sub-vistas
- GIVEN usuario DUEÑA autenticado con `salonId` y endpoints disponibles
- WHEN se abre el tab Cuentas
- THEN se renderizan las sub-vistas Cobrar y Pagar con datos cargados desde la API

#### Scenario: Sin acciones de cobro en v1
- GIVEN sub-vista Cobrar renderizada con filas de deuda
- THEN NO hay botones "cobrar"/"registrar pago" (v1 es read-only)

### Requirement: Documentación de consistencia de deuda

El código del use case de cobrar SHALL documentar que: (a) `montoPendiente`/`deudaTotal` no se reducen al cobrar, (b) las devoluciones no reducen `montoPendiente`, y (c) `montoPendiente` ignora `valorFinal` cuando `precioAjustado=true`. Estos son follow-ups conocidos, fuera de este cambio.

#### Scenario: Semántica documentada
- GIVEN el archivo `CuentasCobrarUseCase.ts`
- THEN contiene un comentario referenciando los follow-ups (devolución, valorFinal, flujo de cobro)

### Requirement: Badge "Al día" en sub-vista Pagar

La sub-vista Pagar del tab Cuentas MUST mostrar un badge "Al día" (verde) en la fila de cada empleada con `pendienteActual === 0`, y MUST ordenar esas filas después de las que tienen pendiente.

#### Scenario: Empleada al día con historial

- GIVEN `GET /finanzas/cuentas/pagar` retorna María (pendienteActual=298000) y Sofía (pendienteActual=0, liquidadoAcumulado=200000)
- WHEN se renderiza la sub-vista Pagar
- THEN la fila de Sofía muestra el badge "Al día" y aparece después de la fila de María

#### Scenario: Sin badge cuando hay pendiente

- GIVEN fila con `pendienteActual=298000`
- WHEN se renderiza la sub-vista Pagar
- THEN la fila NO muestra badge "Al día"

#### Scenario: Todas al día

- GIVEN `GET /finanzas/cuentas/pagar` retorna solo empleadas con `pendienteActual=0`
- WHEN se renderiza la sub-vista Pagar
- THEN todas las filas muestran badge "Al día" en orden por empleadaId
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
