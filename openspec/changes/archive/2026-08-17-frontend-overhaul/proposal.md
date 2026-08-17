# Proposal: Frontend Overhaul — Estandarización y UX

**Status**: propuesto
**Change**: frontend-overhaul
**Artifact Store**: openspec

## Intent
Estandarizar todos los mantenedores del dashboard (paginación, carga, modales, acciones), corregir UX de citas/ventas (filtros de inactivos, errores del backend visibles, gating de botones, formato de miles en inputs), limpiar el banner de caja (solo en tab Caja), aclarar cuentas por pagar/cobrar, y agregar pruebas automatizadas frontend de regresión.

## Scope
**In (4 batches):**
- **Batch A — Estandarización**: paginación uniforme (Anterior/Siguiente, patrón FinanzasPage), skeleton de carga uniforme (patrón EmpleadasPage), modales más anchos (Servicios/Clientes/Productos/Categorías/Empleados/Cita/Completar → modalContentXl 1100px o similar), quitar botón 🗑️ deshabilitado de Empleados, renombrar "Empleadas"→"Empleados" (label+strings, no URL), CajaBanner SOLO en tab Caja (quitar de Agenda/Ventas/otros forms), utilidad `formatCurrency` compartida, formato de miles en inputs de dinero.
- **Batch B — Lógica y UX**: filtrar empleados inactivos en Ventas (carrito) y Agenda (crear cita + toolbar), extraer y mostrar errores del backend en citas (crear, completar, cambiar estado, cancelar), gatear botón Completar (solo CONFIRMADA; PENDIENTE = Confirmar + Cancelar), opción NO_LLEGO.
- **Batch C — Cuentas**: separar visualmente "Al día" vs pendientes en Por Pagar (sección aparte o filtrar), incluir préstamos activos en Por Cobrar (backend: extender CuentasCobrarUseCase) o documentar.
- **Batch D — Pruebas**: suites para ServiciosPage/ProductosPage/ClientesPage/CategoriasPage/PrestamosPage/VentasPage/AgendaPage (crear cita + gating estado), actualizar CajaBannerPages.test.tsx.

**Out**: no cambiar rutas de URL (/empleadas se mantiene), no tocar superadmin, no migraciones de datos.

## Approach
Frontend-first por lote, cada lote con tests (TDD). Un PR por lote (stacked-to-main) o commits directos a main según tamaño.

## API Surface
- Sin cambios de contrato en Batch A/B (solo frontend).
- Batch C: `CuentasCobrarUseCase` extiende para incluir préstamos activos (cambio backend pequeño) — requiere decisión.

## Risks
- Formato de miles en inputs → saltos de caret si se hace mal (usar text input + preservar selección).
- Quitar CajaBanner de Agenda/Ventas cambia UX de la regla de oro (el error CAJA_CERRADA ya se muestra en el modal — suficiente).
- Renombrar "Empleadas" rompe tests que buscan el label.
- Scroll horizontal: tablas anchas ocultan acciones (sticky action column o reducir columnas).

## Success Criteria
- Todos los mantenedores: misma paginación + mismo skeleton.
- Modales de crear/editar ≥1100px en Servicios/Clientes/Productos/Empleados/Cita.
- Sin 🗑️ deshabilitado en Empleados.
- Ventas/Agenda no muestran empleados inactivos.
- Errores del backend visibles en todos los flujos de cita.
- Completar solo en CONFIRMADA.
- CajaBanner solo en tab Caja.
- Inputs de dinero con separador de miles.
- Por Pagar: "Al día" separado; Por Cobrar: préstamos incluidos (si aplica).
- Test suite frontend ≥120 tests, todos verdes.

## File Plan
~14 páginas + componentes + tests. Detalle por lote en design/tasks.
