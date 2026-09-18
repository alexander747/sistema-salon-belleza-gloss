# Delta for agenda-citas

## MODIFIED Requirements

### Requirement: List and Get Citas

The system MUST list citas for a salon with optional filters (`desde`, `hasta`, `usuarioId`, `estado`, `clienteId`) and MUST return a single cita by ID with its associated servicios eagerly loaded. Each entry of `servicios[]` MUST include `cantidad` (int ≥ 1, default 1 for legacy rows).
(Previously: `servicios[]` had no `cantidad`)

#### Scenario: List citas filtered by usuario and estado

- GIVEN a salon with 5 citas for 3 different employees
- WHEN `GET /api/salones/:salonId/agenda/citas?usuarioId=1&estado=PENDIENTE`
- THEN the response contains only PENDIENTE citas for usuarioId=1

#### Scenario: Get cita by ID includes servicios

- GIVEN a cita with 2 associated servicios
- WHEN `GET /api/salones/:salonId/agenda/citas/42`
- THEN the response includes `servicios` array with both service details

#### Scenario: Get cita exposes cantidad

- GIVEN a cita whose servicio A has `cantidad=2`
- WHEN `GET /api/salones/:salonId/agenda/citas/42`
- THEN `servicios[]` entry for A includes `cantidad=2`

### Requirement: Create Cita with Overlap Validation

The system MUST create a cita only when the requested slot is available (no horario, bloqueo, or cita overlap conflicts). The system MUST validate that `clienteId` and `usuarioId` reference existing entities. The body MUST accept `servicios` as `[{servicioId, cantidad}]` where `cantidad` is an int ≥ 1 (default 1); the legacy `serviciosIds` array MUST still be accepted and interpreted as `cantidad=1` for each id. Duration MUST be calculated as `SUM(servicios.duracionMinutos × cantidad)` and the overlap check MUST use that expanded duration.
(Previously: duration was `SUM(servicios.duracionMinutos)` and no quantity existed)

#### Scenario: Create cita successfully

- GIVEN a valid cliente and usuario, and the slot is available
- WHEN `POST /api/salones/:salonId/agenda/citas` with `{ clienteId: 1, usuarioId: 2, fechaHora: "2026-06-01T10:00:00Z", serviciosIds: [1, 2], notas: "Corte y tinte" }`
- THEN the response is 201 with the created cita in PENDIENTE state

#### Scenario: Create cita con cantidad

- GIVEN un servicio A de 60min y el slot disponible
- WHEN `POST /agenda/citas` con `{ ..., servicios: [{servicioId: A, cantidad: 2}] }`
- THEN 201 AND `duracionTotalMinutos=120` AND el servicio A persiste `cantidad=2`

#### Scenario: Reject creation on overlap

- GIVEN an existing CONFIRMADA cita for usuarioId=2 at 10:00-11:00 (servicios sum=60min)
- WHEN creating a new cita for the same usuario at 10:30 same day
- THEN the response is 409 with `{ disponible: false, motivo: "Conflicto con cita existente" }`

#### Scenario: Overlap usa la duración expandida

- GIVEN una cita CONFIRMADA de 10:00 a 11:00 para usuarioId=2
- WHEN se crea otra cita para el mismo usuario a las 11:00 con un servicio de 60min y `cantidad=2`
- THEN 409 (la ventana expandida 11:00–13:00 solapa la cita existente)

#### Scenario: Validate cliente and usuario existence

- GIVEN a non-existent clienteId
- WHEN creating a cita with that clienteId
- THEN the response is 404 with appropriate error message

#### Scenario: Cantidad inválida rechazada

- GIVEN un body con `servicios: [{servicioId: 1, cantidad: 0}]`
- WHEN se crea la cita
- THEN 422 ValidationError AND no se persiste la cita

## ADDED Requirements

### Requirement: Cantidad de servicios en citas

La relación cita-servicio MUST poder representar `cantidad` por servicio (int ≥ 1, default 1). El flujo de completar cita MUST respetar la cantidad: al completar con un payload de registro cuyas líneas tienen `cantidad=N`, el sistema MUST persistir N items por unidad y el total de servicios MUST reflejar N unidades.

#### Scenario: Completar cita con cantidad ×2

- GIVEN una cita CONFIRMADA con servicio A (`cantidad=2`, `precioServicio=20000`) y caja ABIERTA
- WHEN `POST /agenda/citas/1/completar` con `{ registro: { serviciosItems: [{servicioId: A, precioServicio: 20000, cantidad: 2}], totalServicios: 40000, ... } }`
- THEN 200 AND el registro persistido contiene 2 items de A AND `totalServicios=40000`

#### Scenario: Cita legacy sin cantidad

- GIVEN una cita existente creada con `serviciosIds` (sin cantidad)
- WHEN se consulta o completa
- THEN cada servicio se interpreta como `cantidad=1` AND no cambia el comportamiento previo

### Requirement: Totales mostrados al completar respetan la cantidad

La UI del modal de completar cita MUST calcular los totales de servicios multiplicando cada línea por su `cantidad` (≥1). El subtotal mostrado, la base del "Ajustar valor total", el desglose del reparto y el recibo MUST coincidir con el total que el servidor persiste. El cálculo MUST salir de una única fuente compartida entre el display y el payload del POST, para que no puedan divergir.

#### Scenario: Completar cita con cantidad ×2 muestra el total persistido

- GIVEN una cita CONFIRMADA con servicio A (`cantidad=2`, `precio=30000`) y una empleada con 60 % de comisión
- WHEN se abre el modal de completar
- THEN el subtotal de servicios mostrado es 60000 (2 × 30000)
- AND el `totalServicios` del POST es 60000 (display y payload coinciden)
- WHEN el desglose del reparto es visible (servicio POR_GRAMO o total ajustado)
- THEN "A repartir" y la comisión se calculan sobre 60000, no sobre 30000

#### Scenario: Base del total ajustado usa la cantidad

- GIVEN la misma cita con `cantidad=2` y caja ABIERTA
- WHEN se habilita "Ajustar valor total"
- THEN el placeholder del input de ajuste es el total calculado 60000 (no 30000)
