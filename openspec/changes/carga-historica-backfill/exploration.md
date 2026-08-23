# Exploration: carga-historica-backfill

Permitir cargar datos históricos (agenda, ventas, servicios, cajas) desde el cuaderno del dueño, con fechas pasadas seleccionables y default = hoy, para que las cuentas concilien.

---

## 1. Per-module current state + required changes

### 1a. Citas / Agenda — fecha restricción
- **Frontend (ÚNICA restricción)**: `apps/pos-dashboard/src/pages/AgendaPage.tsx:1677` — `<input type="date" ... min={toISODate(new Date())} />`. El backend NO restringe fechas pasadas.
- **Backend**: `createCitaSchema` (`packages/validation/src/agenda.schema.ts:5-11`) solo valida ISO. `CreateCitaUseCase` no valida fecha ≥ hoy. `DisponibilidadService.verificar()` (agenda/services) no rechaza fechas pasadas — solo horario comercial, bloqueos, solapamiento. `obtenerSlots` funciona para cualquier fecha con horarios configurados. `TypeORMCitaRepository` filtra por `cita.fechaHora` (columna datetime existe).
- El calendario YA renderiza días pasados (opacity 0.5, AgendaPage.tsx:1237-1249).
- **Default**: `fecha: ''` (AgendaPage.tsx:250, reset en 499). Owner quiere default = hoy.
- **Cambio**: quitar `min` + default `fecha: todayStr` en `resetCreateForm`/initial. `fechaHora` ya se envía TZ-safe (`new Date(`${fecha}T${hora}:00`).toISOString()`, línea 518). Riesgo: bajo.

### 1b. Ventas (registro de venta)
- **Frontend**: `VentasPage.tsx:315-382` (`handleCobrar`) — formulario inline con carrito; payload a POST `/salones/:id/registros` (línea 356). NO tiene campo fecha.
- **Backend**: `CreateRegistroUseCase` (ver §2). No recibe fecha.

### 1c. Finanzas → Registrar servicio
- **Frontend**: `FinanzasPage.tsx:1235-1245` — abre el MISMO `WalkInModal` compartido (`apps/pos-dashboard/src/components/WalkInModal.tsx:441-474`). NO tiene campo fecha.
- **Backend**: mismo `CreateRegistroUseCase` (compartido con Ventas). Confirmado.

### 1d. Caja — abrir en días anteriores
- **Backend**: `AbrirCajaUseCase.ts:22` — `const fechaCaja = getColombiaDateString()` hardcodeado hoy. Cambio: `fechaCaja` opcional en input (schema `abrirCajaSchema`, `packages/validation/src/caja.schema.ts:5-7`) con default hoy.
- `findAbiertaBySalon` (línea 26, any-open rule): el backfill secuencial funciona (abrir 16/08 → cerrar → abrir 17/08…). Ver §3.
- `findBySalonYFecha(salonId, fechaCaja)` (línea 33) + backstop ER_DUP_ENTRY: funciona con fecha pasada (UNIQUE (salonId, fechaCaja), CajaEntity:21).
- **Frontend**: modal Abrir en `CajaTab.tsx:761-798` — solo `montoInicial` (MoneyInput), sin fecha. `handleAbrir` (líneas 354-369) hace POST `{ montoInicial }` sin fecha. Cambio: añadir date input default hoy.

### 1e. Caja — cerrar (pregunta del dueño)
- `CerrarCajaUseCase` ya soporta cerrar por `cajaId` (líneas 33-35, 71-81) — cierra cualquier caja ABIERTA del salón. El arqueo (`calcularReporteCierre`) es 100% date-agnostic: usa registros/gastos por `cajaId` + `montoInicial` de la caja.
- `cierreEn: new Date()` (línea 64) = momento real del cierre. **Verificado: NINGÚN reporte filtra por `cierreEn`/`aperturaEn`** (solo se escriben, nunca se leen; grep en use-cases/domain). La fecha de negocio es `fechaCaja`, y `ListarCierresCajaUseCase` ordena por `fechaCaja` DESC (repo línea 99).
- **Recomendación (ver §4)**: NO pedir fecha de cierre. `fechaCaja` de la caja es la autoritativa; `cierreEn` = ahora queda como auditoría (el cierre físico SÍ ocurre hoy).
- **Caveat gastos**: `CreateGastoUseCase.ts:44` escribe `fecha: new Date()` e ignora el `fecha` opcional que YA acepta `createGastoSchema` (finanzas.schema.ts:69) — bug latente. Para backfill, el gasto queda con fecha hoy pero cajaId de la caja pasada. El arqueo (por cajaId) queda bien, pero reportes que filtran gastos por `fecha` (PyL línea 69-70, ResumenDia línea 79) lo ubican mal. Fix pequeño: honrar `input.fecha` con default hoy.

---

## 2. CRITICAL — cómo se almacena la fecha de los registros

**`registros_servicio` NO tiene columna `fechaHora`.** Evidencia:
- Entity: `RegistroServicioEntity.ts` extiende `BaseEntity` (solo `id`, `creadoEn`, `actualizadoEn`). Sin fecha de negocio.
- DB (docker exec, `SHOW COLUMNS FROM registros_servicio`): columnas `creadoEn` (datetime, DEFAULT CURRENT_TIMESTAMP) y `actualizadoEn`; NO hay `fechaHora`.
- `CreateRegistroUseCase.execute()` nunca escribe una fecha (el `create` en líneas 125-150 no incluye ningún campo de fecha).
- La fecha mostrada en UI = `creadoEn`: `FinanzasPage.tsx:3547` (`formatDateYMD(reg.creadoEn)`), DTO `RegistroServicioDTO.ts:86`.
- **TODOS los filtros por fecha usan `creadoEn`**:
  - `TypeORMRegistroServicioRepository.ts:68-69, 95-99, 129-133` (`r.creadoEn >= :desde`, `<= :hasta`)
  - `PyLMensualUseCase.ts:62-64` (comentario explícito: "Registros y devoluciones usan creadoEn")
  - `ResumenDiaUseCase.ts:49-60`
  - `NominaPendienteUseCase.ts:139` (in-memory `r.creadoEn`), `LiquidarEmpleadaUseCase.ts:90,98`
  - `ObtenerDetalleCierreCajaUseCase.ts:77` (`fecha: r.creadoEn` en movimientos)
  - `CuentasCobrarUseCase.ts` (antigüedad por creadoEn)

**Implicación**: sin columna `fechaHora`, un registro backfilleado para el 16/08 se inserta con `creadoEn = ahora (22/08)` y aparece en los reportes del 22/08 — la conciliación del cuaderno FALLA. La columna es imprescindible.

**Cambio**: añadir `fechaHora datetime` a `RegistroServicioEntity` (DB_SYNCHRONIZE=true crea la columna automáticamente; sin migraciones manuales), aceptar `fechaHora` opcional en `createRegistroSchema` + `CreateRegistroUseCase` (default = ahora), exponer en DTO, y migrar los filtros de rango de `creadoEn` → `fechaHora` (repo + nómina/liquidación + detalle de caja). Para registros creados vía `CompletarCitaUseCase` (líneas 72-75), default natural = `cita.fechaHora`.

**Caja linkage durante backfill**: `verificarCajaAbierta` (services/verificarCajaAbierta.ts:15) busca la caja ABIERTA de HOY. Para vender con fecha 16/08, el registro debe ligarse a la caja 16/08 → resolver caja por la fecha del payload (`findAbiertaBySalonYFecha(salonId, fecha)`), no por hoy. Requiere pasar la fecha al flujo de venta y a CompletarCita.

- `citas` → SÍ tiene `fechaHora` (CitaEntity:25-26). Backfill nativo OK.
- `cajas` → SÍ tiene `fechaCaja` (CajaEntity:32-33). OK.

---

## 3. Regla "any open caja" × backfill — opciones

Regla actual (`AbrirCajaUseCase.ts:26`): si existe CUALQUIER caja ABIERTA (cualquier fecha), no se puede abrir otra. Interacción con backfill:

- **Backfill secuencial (flujo del dueño)**: abrir 16/08 → registrar ventas 16/08 → cerrar 16/08 → abrir 17/08 → … funciona perfecto con la regla actual. No hay conflicto.
- **Caja pasada dejada abierta**: bloquea abrir la de hoy — comportamiento DESEADO (evita mezclar fechas) y consistente con el aviso "pendiente de cierre" del frontend (`CajaTab.tsx:472-476, 565-628`). Además `verificarCajaAbierta` (hoy) bloquea VENTAS mientras haya caja pasada abierta — correcto durante backfill; el dueño debe cerrarla al terminar.

Opciones:
1. **Mantener la regla tal cual (recomendado)** — backfill secuencial compatible, sin cambios de regla, sin tests rotos.
   - Pros: cero riesgo, semántica coherente.
   - Cons: el dueño no puede dejar una caja pasada abierta y operar el día actual a la vez (aceptable para backfill puntual).
2. Permitir abrir otra caja si la abierta es de fecha pasada — rompe la regla del cambio anterior (b7e2216) y puede mezclar movimientos.
   - Pros: flexibilidad.
   - Cons: complejidad, riesgo de desorden de caja, tests existentes a cambiar.
3. Cambio de UI: ofrecer "Cerrar pendiente" inline antes de abrir (ya existe el botón Cerrar en el aviso, `CajaTab.tsx:609-624`). No requiere backend.

**Recomendación**: Opción 1 (sin cambio de regla). Documentar el flujo secuencial en el spec/design.

---

## 4. ¿Cerrar caja debe pedir fecha de cierre? — Recomendación

**NO.** Evidencia:
- La caja ya tiene `fechaCaja` (autoritativa para el negocio; `ListarCierresCajaUseCase` y el historial del frontend la usan).
- `calcularReporteCierre` es date-agnostic (por cajaId).
- Ningún reporte filtra por `cierreEn`/`aperturaEn` (solo se escriben; grep verificado en use-cases/domain).
- Cerrar una caja de 16/08 hoy: `fechaCaja`=16/08 (todo listado/reporte correcto); `cierreEn`=hoy (correcto como auditoría del momento físico).

Costo de añadir fecha de cierre: más inputs, más estados, riesgo de inconsistencia (¿qué pasa si el dueño pone 15/08 al cerrar la caja 16/08?), sin beneficio funcional. Keep it simple: **no pedir fecha al cerrar**. Solo cosmética opcional: mostrar `fechaCaja` en el modal de arqueo (ya se muestra en el detalle).

---

## 5. Scope estimate

**Backend (fondo de datos)**:
- `RegistroServicioEntity` + `RegistroServicioDTO` + `createRegistroSchema` (fechaHora opcional) + rebuild validation dist (`cd packages/validation && npx tsc` — gotcha AGENTS.md).
- `CreateRegistroUseCase` (aceptar y persistir fechaHora; resolver caja por fecha) + `verificarCajaAbierta` (aceptar fecha) + `CompletarCitaUseCase` (default cita.fechaHora).
- `TypeORMRegistroServicioRepository` (filtros fechaHora) + `ListRegistrosUseCase`/controller + `NominaPendienteUseCase` + `LiquidarEmpleadaUseCase` + `ObtenerDetalleCierreCajaUseCase` (movimientos fecha) + `CreateGastoUseCase` (honrar fecha).
- `AbrirCajaUseCase` + `abrirCajaSchema` (fechaCaja opcional).
- ≈ 12-16 archivos, ~350-500 líneas.

**Frontend (formularios)**:
- `AgendaPage.tsx` (quitar min + default hoy, 2-4 líneas).
- `WalkInModal.tsx` + `VentasPage.tsx` (campo fecha default hoy + payload, ~40-60 líneas c/u).
- `CajaTab.tsx` (date input en modal Abrir, ~20 líneas).
- `FinanzasPage.tsx` (mostrar fechaHora en lista/detalle de registros, ~5 líneas).
- ≈ 5-7 archivos, ~150-250 líneas.

**Total**: ~600-900 líneas → **excede el presupuesto de review de 400 líneas**. Recomendación: **PRs encadenados**:
- **PR 1 (backend datos)**: columna fechaHora + schema + CreateRegistro + filtros de repo/reportes + caja linkage + gastos. Autónomo: todos los reportes quedan date-correct.
- **PR 2 (caja backfill)**: AbrirCajaUseCase con fechaCaja opcional + schema + CajaTab date input.
- **PR 3 (frontend formularios)**: AgendaPage fechas pasadas + WalkInModal/VentasPage campos fecha.
Cada uno < 400 líneas.

---

## 6. Tests existentes que podrían romperse

- **API**:
  - `NominaPendienteUseCase.test.ts` y `LiquidarEmpleadaUseCase.test.ts` — **ROMPEN** si los filtros in-memory pasan de `creadoEn` a `fechaHora`: los fixtures solo setean `creadoEn` (p. ej. NominaPendienteUseCase.test.ts:44, 184). Requieren añadir `fechaHora` a fixtures.
  - `ObtenerDetalleCierreCajaUseCase.test.ts` — los movimientos usan `fecha: creadoEn`; si cambia a `fechaHora`, fixtures (líneas 75, 129, 143) necesitan el campo.
  - `finanzas.schema.test.ts` / `caja.schema.test.ts` — no rompen (campos opcionales); conviene añadir casos nuevos.
  - `CreateRegistroUseCase.test.ts`, `AbrirCajaUseCase.test.ts`, `CerrarCajaUseCase.test.ts`, `PyLMensualUseCase.test.ts`, `ResumenDiaUseCase.test.ts` — seguros (repos mockeados; campos opcionales no alteran comportamiento default).
- **Dashboard**:
  - `AgendaPage.test.tsx` — seguro (usa fecha mañana; no assert de `min`).
  - `VentasPage.test.tsx:175-188` — seguro (`expect.objectContaining`).
  - `WalkInModal.test.tsx` — revisar asserts de payload (probablemente objectContaining); añadir test del campo fecha.
  - `CajaTab.test.tsx` — flujo Abrir sigue igual si la fecha es opcional con default hoy; añadir test del date input.
  - `FinanzasPage.test.tsx` — revisar si asserta `creadoEn` en la lista (línea 3547 del código); si la UI pasa a `fechaHora`, los fixtures del test necesitan el campo.

---

## Riesgos
- La migración de filtros creadoEn → fechaHora es el punto más delicado: tocar nómina/liquidación puede cambiar comisiones históricas si no se hacen bien los defaults. Los registros pre-existentes (sin fechaHora) deben backfillearse con `fechaHora = creadoEn` (data-fix SQL o default en read).
- `verificarCajaAbierta` por fecha: si el dueño vende "en vivo" (hoy) mientras backfillea un día pasado con su caja abierta, el chokepoint lo bloquea — diseñar UX para el flujo secuencial.
- Rebuild de `packages/validation/dist` obligatorio tras tocar schemas (gotcha conocido).
