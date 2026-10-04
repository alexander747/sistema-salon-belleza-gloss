# Historial: detalle del registro + ajustes de UI

## Objective
Corregir la hora fija (12:00 PM) al registrar un servicio, rediseñar el modal "Ver detalle" del Historial de registros para que sea claro y completo, y limpiar el resumen de la pestaña Registros (ocultar filas de propina y quitar las tarjetas de Servicios/Productos/Insumos).

## Problem
1. Todo registro queda con hora 12:00 PM. Causa: `WalkInModal.tsx:701` fija `fechaHora: new Date(\`${fecha}T12:00:00\`).toISOString()` porque el form sólo captura fecha (sin hora). El backend guarda el instante tal cual (`CreateRegistroUseCase.ts:65`) y el historial lo muestra con `formatTimeAMPM` (`FinanzasPage.tsx:1292`). Mismo patrón en `VentasPage.tsx:416` y `AgendaPage.tsx:757`.
2. El modal "Ver detalle" (`FinanzasPage.tsx:1453-1780`, `RenderRegistroDetail`) es confuso e incompleto: no muestra costo de insumos por ítem, gramos, precio/gramo, propina, comisión, descripción, estado, ni el `valorFinal`; el modelo sí los expone.
3. La tira de reconciliación muestra "Propinas (van a las chicas)" y "TU CAJA REAL (sin propinas)" — ya no se aceptan propinas.
4. El resumen del período (pestaña Registros) incluye las tarjetas 💇 Servicios / 🧴 Productos / 🧴 Total insumos, que pertenecen a Reportes.
5. (Bloqueado) "📌 Deudas por cobrar" en Reportes es acumulativo al cierre del período (filtra sólo `<= hasta`, no por `desde`), aunque SÍ filtra por empleada. Por eso día 3 + Zuleidy = 164.800. Decisión de producto pendiente.

## Why
El usuario registra servicios a lo largo del día y necesita la hora real para el historial; el detalle del registro es la vista que más consulta y hoy no se entiende; y el resumen de Registros duplica/ensucia información que vive en Reportes.

## Scope
- `apps/pos-dashboard/src/components/WalkInModal.tsx` (+ `VentasPage.tsx`, evaluar `AgendaPage.tsx`)
- `apps/pos-dashboard/src/pages/FinanzasPage.tsx` (modal de detalle + resumen del período)
- `apps/pos-dashboard/src/utils/tiraReconciliacion.ts` (u ocultar en el render)
- Tests afectados

Fuera de alcance: cambiar la semántica de la API de deudas (T5, bloqueado), propina en otras pantallas.

## Constraints
- No romper el contrato con la API: `fechaHora` sigue siendo un ISO datetime válido; la caja se liga por FECHA de negocio, así que un instante real de hoy sigue ligando la caja de hoy.
- Ocultar = reversible (no borrar la lógica de la tira; filtrar la presentación).
- No commitear sin pedido explícito.
- Artefactos (código, tests) en inglés.

## Tasks
- [x] **T1 — Hora real del registro.** (hecho ✅ — helper `utils/fechaHora.ts`; WalkInModal + VentasPage) Si `fecha` seleccionada es HOY → `fechaHora = new Date()` (momento real). Si es otra fecha → mantener el ancla mediodía (no se conoce hora real). Aplicar en `WalkInModal.tsx` y `VentasPage.tsx`; evaluar `AgendaPage.tsx:757`. Actualizar tests que hoy esperan `T12:00:00`.
- [x] **T2 — Rediseñar modal "Ver detalle".** (hecho ✅ — `RenderRegistroDetail` reconstruido + 8 tests) Más claro y bonito, con TODO el detalle disponible: cliente/empleada, fecha+hora, servicios (con costo insumos/gramos cuando aplique), productos, descuento (monto/%/alcance), totales (original/final), pagos + cambio, divisiones/comisión, notas, estado. Ocultar propina cuando sea 0. Actualizar `FinanzasPage.test.tsx`.
- [x] **T3 — Ocultar filas de propina** (hecho ✅ — `visibleTiraRows`, reversible) ("Propinas (van a las chicas)", "TU CAJA REAL (sin propinas)") en la tira de reconciliación. Reversible. Actualizar tests.
- [x] **T4 — Quitar tarjetas** (hecho ✅ — 3 tarjetas quitadas del resumen) 💇 Servicios / 🧴 Productos / 🧴 Total insumos del resumen del período (pestaña Registros). Actualizar tests.
- [ ] **T5 — (BLOQUEADO)** Deudas por cobrar: decidir acumulado-al-cierre vs sólo-del-período.
- [x] **T6 — Detalle en formato TABLA (ajuste de T2, opción 1).** (hecho ✅ — tabla de ítems + flujo original→descuento→total; 140/140) Ítems del registro en tabla (`Concepto | Cant. | Precio | Subtotal`) + flujo de totales **Precio original → Descuento (% y alcance) → Total final**, visible sólo si hubo descuento. Sin cambio de API (los datos existentes no tienen precio de lista por línea).

## Acceptance criteria
- Un registro creado hoy muestra en el historial la hora real (no 12:00 PM).
- El modal de detalle muestra todos los campos significativos y se entiende sin explicación; propina 0 no se muestra.
- La tira de reconciliación ya no muestra las dos filas de propina.
- El resumen de Registros ya no muestra las tres tarjetas.
- `tsc --noEmit` limpio y las suites afectadas en verde.

## Checks
- `docker exec posfinal-dashboard sh -c "cd /app/apps/pos-dashboard && npx tsc --noEmit"`
- `docker exec posfinal-dashboard sh -c "cd /app/apps/pos-dashboard && npx vitest run src/components/__tests__/WalkInModal.test.tsx src/pages/__tests__/FinanzasPage.test.tsx src/utils/tiraReconciliacion.test.ts"`

## Progress
- Mapeo read-only completado (5 ítems, causa raíz identificada).
- T1-T4 delegados a un writer.

## Next step
Definir T5 con el usuario; luego commitear la unidad de trabajo y correr el review nativo sobre ese commit (hoy el preflight devolvió `collect` sobre un árbol mixto).
