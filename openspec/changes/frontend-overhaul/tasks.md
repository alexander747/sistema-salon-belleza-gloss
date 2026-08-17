# Tasks — Frontend Overhaul

> `sdd-tasks` no generó `tasks.md`; el prompt del orquestador fue la lista de
> tareas. Este archivo reconstruye el plan por lotes (proposal.md) y marca el
> estado real de aplicación. Actualizado por Batch C (apply).

## Batch A — Estandarización (COMPLETA — 8 commits, ver apply-progress #289)

- [x] A1 Renombrar "Empleadas" → "Empleados" (labels, no URL)
- [x] A2 Quitar botón 🗑️ deshabilitado de Empleados
- [x] A3 CajaBanner solo en el tab Caja
- [x] A4 Paginación uniforme con PaginationBar en los mantenedores
- [x] A5 Skeleton de carga uniforme con TableSkeleton
- [x] A6 Modales de crear/editar más anchos (modalContentXl 1100px)
- [x] A7 Utilidad `formatCurrency` compartida
- [x] A8 MoneyInput con separador de miles en inputs de dinero

## Batch B — Lógica y UX (COMPLETA — 5 commits, ver apply-progress #289)

- [x] B1 Filtrar empleados inactivos en Ventas (carrito) y select de empleada
- [x] B2 Filtrar empleados inactivos en Agenda (crear cita + toolbar + walk-in)
- [x] B3 Mostrar errores del backend al crear cita (banner en el modal)
- [x] B4 Mostrar errores del backend al completar cita
- [x] B5 Mostrar errores del backend al cambiar estado/cancelar cita
- [x] B6 Gatear botones de cita por estado + acción NO_LLEGO
- [x] B7 Estandarizar CategoriasPage con modal de crear/editar

## Batch C — Cuentas (COMPLETA — 2 commits)

- [x] C1 Backend: préstamos ACTIVOS (saldoPendiente > 0) en cuentas por cobrar
      (`CuentasCobrarUseCase` + `CuentaCobrarDTO` con `tipo: CLIENTE|PRESTAMO`)
- [x] C2 Backend: campo `alDia` en `CuentaPagarDTO`/`CuentasPagarUseCase`
- [x] C3 Frontend: Por cobrar muestra préstamos con badge Préstamo/Cliente
- [x] C4 Frontend: Por pagar separa secciones Pendientes vs Al día
- [x] C5 Tests: use cases backend (préstamos + alDia) y FinanzasPage cuentas

## Batch D — Pruebas (COMPLETA — 8 commits, ver apply-progress #290)

- [x] D1 Suites ServiciosPage / ProductosPage / ClientesPage (6+7+7 tests)
- [x] D2 Suites PrestamosPage / VentasPage / AgendaPage (6+4+15 tests; CategoriasPage ya
      tenía suite propia del Batch B)
- [x] D3 CajaBanner.test.tsx: "Reabrir" con fecha Colombia dinámica (getColombiaDateString)
      — suite completa verde (180 tests, 23 archivos)
