# PLAN DE PRUEBAS — POS Final

## Entorno

- Dashboard: `http://localhost:5174`
- Superadmin: `http://localhost:5173`
- API: `http://localhost:3001`
- MySQL: puerto 3307

## Credenciales

| Rol | Email | Password | salonId |
|-----|-------|----------|---------|
| Dueña | duena@test.com | duena123 | 1 |
| Superadmin | eder@gmail.com | Eder123 | 1 (auto-asignado) |

## Convenciones para las pruebas

- Usar Playwright MCP (herramientas `playwright_browser_*`)
- Para formularios React que no responden a `click()`, usar:
  ```js
  page.evaluate(() => { document.querySelector('form').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true })); });
  ```
- Reportar resultados como: ✅ PASS / ❌ FAIL / ⚠️ WARNING
- Después de cada prueba, dejar el estado limpio (eliminar datos de prueba)
- No usar datos reales — siempre prefijo "QA Test" o similar

---

## 1. LOGIN — AMBAS APPS

### 1.1 Dashboard Login

| # | Caso | Pasos | Expected |
|---|------|-------|----------|
| 1.1.1 | Login exitoso como dueña | Ir a `/login`, email: duena@test.com, password: duena123, click Ingresar | Redirige a `/`, muestra nombre "Dueña de Prueba" |
| 1.1.2 | Login con email inválido | email: "invalido", password: duena123 | Muestra error de validación (email mal formado) |
| 1.1.3 | Login con contraseña incorrecta | email: duena@test.com, password: wrongpass | Muestra "Credenciales inválidas" (NO código crudo) |
| 1.1.4 | Login con contraseña muy corta | email: duena@test.com, password: "abc" | Muestra "La contraseña debe tener al menos 6 caracteres" |
| 1.1.5 | Login con campos vacíos | Click Ingresar sin llenar nada | HTML5 validation impide submit |
| 1.1.6 | Login con conexión caída | Matar API, intentar login | Muestra "Error de conexión" |

### 1.2 Superadmin Login

| # | Caso | Pasos | Expected |
|---|------|-------|----------|
| 1.2.1 | Login exitoso | email: eder@gmail.com, password: Eder123 | Redirige a `/`, muestra nombre "Superadmin" |
| 1.2.2 | Login con credenciales inválidas | password incorrecta | Muestra "Credenciales inválidas" |

---

## 2. DASHBOARD — PÁGINA PRINCIPAL

| # | Caso | Pasos | Expected |
|---|------|-------|----------|
| 2.1 | KPIs se muestran | Login como dueña → `/` | 4 tarjetas: Ingresos, Citas hoy, Clientes, Empleadas activas |
| 2.2 | Citas de hoy | Revisar sección "Próximas citas hoy" | Muestra citas o "No hay citas para hoy" + botón "Crear una cita" |
| 2.3 | Quick actions | Click en tarjetas "Nueva cita", "Clientes", "Servicios" | Cada una navega a su ruta |
| 2.4 | SalonSwitcher no visible para dueña | Login como dueña | No hay dropdown de salones (solo superadmin) |

---

## 3. CATEGORÍAS — CRUD

| # | Caso | Pasos | Expected |
|---|------|-------|----------|
| 3.1 | Listar categorías | Navegar a `/categorias` | Tabla con nombre, descripción, # servicios, # productos, fechas, acciones |
| 3.2 | Crear categoría | Escribir nombre "QA Test Cat", descripción opcional, click "Crear" | Aparece en la tabla con fecha de hoy |
| 3.3 | Crear categoría sin nombre | Click "Crear" con nombre vacío | Botón deshabilitado |
| 3.4 | Editar nombre | Click ✏️, cambiar nombre, click "Guardar" | Nombre actualizado en tabla |
| 3.5 | Editar descripción | Click ✏️, agregar descripción, click "Guardar" | Descripción visible en tabla |
| 3.6 | Cancelar edición | Click ✏️, click "Cancelar" | Vuelve al estado original |
| 3.7 | Eliminar categoría | Click 🗑️, confirmar en modal | Categoría desaparece de la tabla |
| 3.8 | Cancelar eliminación | Click 🗑️, click "Cancelar" en modal | Categoría sigue en la tabla |
| 3.9 | Eliminar categoría con servicios asociados | Intentar eliminar categoría que tiene servicios | Debería prevenir o mostrar advertencia |

---

## 4. SERVICIOS — CRUD

| # | Caso | Pasos | Expected |
|---|------|-------|----------|
| 4.1 | Listar servicios | Navegar a `/servicios` | Tabla con nombre, duración, precio, categoría, estado, fechas, acciones |
| 4.2 | Crear servicio | Click "+ Nuevo Servicio", llenar nombre "QA Test Svc", precio 50000, duración 30, categoría "cabello", click "Crear servicio" | Aparece en la tabla |
| 4.3 | Crear servicio sin nombre | Modal, no escribir nombre | Botón "Crear servicio" deshabilitado |
| 4.4 | Crear servicio con precio 0 | Modal, precio 0 | Botón deshabilitado (precioBase <= 0) |
| 4.5 | Crear servicio con precio negativo | Modal, precio -1000 | Botón deshabilitado |
| 4.6 | Crear servicio con duración 0 | Modal, duración 0 | Botón deshabilitado |
| 4.7 | Editar servicio | Click ✏️, cambiar precio/nombre, guardar | Cambios reflejados en la tabla |
| 4.8 | Eliminar servicio | Click 🗑️, confirmar | Servicio eliminado |
| 4.9 | Buscar servicio | Escribir en search "corte" | Filtra resultados |
| 4.10 | Crear servicio con nombre duplicado | Nombre "corte de cabello" (ya existe) | Sistema permite duplicados (decidir si es bug o feature) |

---

## 5. PRODUCTOS — CRUD + STOCK

| # | Caso | Pasos | Expected |
|---|------|-------|----------|
| 5.1 | Listar productos | Navegar a `/productos` | Tabla con nombre, marca, stock, tipo, precio, costo, categoría, acciones |
| 5.2 | Crear producto | Click "+ Nuevo Producto", llenar nombre "QA Test Prod", precioVenta 10000, stock 50, click crear | Aparece en la tabla |
| 5.3 | Crear producto sin nombre | Modal, no escribir nombre | Botón deshabilitado |
| 5.4 | Crear producto con precio 0 | Modal, precioVenta 0 | Botón deshabilitado |
| 5.5 | Descontar stock | Click "- Stock", ingresar cantidad 5, confirmar | Stock baja a 45 |
| 5.6 | Reabastecer stock | Click "+ Stock", ingresar cantidad 10, confirmar | Stock sube a 55 |
| 5.7 | Descontar más stock del disponible | Click "- Stock", cantidad 999 | Debería fallar o mostrar error |
| 5.8 | Producto con stock bajo | Setear stockMinimo mayor al actual | Fila se resalta + badge "Mínimo" |
| 5.9 | Filtrar por tipo | Click "Para Venta" / "Uso Interno" | Filtra productos |
| 5.10 | Editar producto | Cambiar nombre, precio, stock guardar | Cambios reflejados |
| 5.11 | Eliminar producto | Click 🗑️, confirmar | Producto eliminado |

---

## 6. EMPLEADAS — CRUD

| # | Caso | Pasos | Expected |
|---|------|-------|----------|
| 6.1 | Listar empleadas | Navegar a `/empleadas` | Tabla con nombre, email, rol (badge color), WhatsApp, pago, activo, fechas |
| 6.2 | Crear empleada | "+ Nueva empleada", llenar todos los campos requeridos, seleccionar rol Manicurista, tipo pago COMISIÓN 50%, click "Crear empleada" | Aparece en la tabla |
| 6.3 | Crear empleada sin nombre | Dejar nombre vacío | Botón deshabilitado |
| 6.4 | Crear empleada con password corta | Password < 6 caracteres | Botón deshabilitado |
| 6.5 | Crear empleada sin rol | No seleccionar rol | Botón deshabilitado |
| 6.6 | Toggle activo/inactivo | Click toggle switch | Cambia estado sin recargar página |
| 6.7 | Editar empleada | Click ✏️, cambiar nombre/rol/pago, guardar | Cambios reflejados |
| 6.8 | Cambiar tipo de pago | Editar, toggle COMISIÓN ↔ FIJO, ver inputs cambiar | Se muestra % o sueldo según corresponda |
| 6.9 | Botón eliminar | Verificar 🗑️ | Siempre deshabilitado (no implementado) |
| 6.10 | Buscar empleada | Escribir en search "Ana" | Filtra resultados |

---

## 7. CLIENTES — CRUD

| # | Caso | Pasos | Expected |
|---|------|-------|----------|
| 7.1 | Listar clientes | Navegar a `/clientes` | Tabla con nombre, teléfono, email, visitas, fechas, acciones |
| 7.2 | Columna Visitas | Verificar que muestre número (no vacío) | Mapea totalServicios a visitas |
| 7.3 | Crear cliente | "+ Nuevo cliente", nombre "QA Test Cliente", teléfono 3001112233, click crear | Aparece en la tabla |
| 7.4 | Crear cliente sin nombre | Dejar nombre vacío | Botón deshabilitado |
| 7.5 | Editar cliente | Click ✏️, cambiar nombre/teléfono, guardar | Cambios reflejados |
| 7.6 | Ver detalle cliente | Click 👁️ | Modal con info completa + visitas |
| 7.7 | Eliminar cliente | Click 🗑️, confirmar | Cliente eliminado |
| 7.8 | Cancelar eliminación | Click 🗑️, click "Cancelar" | Cliente sigue en tabla |
| 7.9 | Buscar cliente | Escribir en search nombre o teléfono | Filtra resultados |

---

## 8. AGENDA / CITAS

| # | Caso | Pasos | Expected |
|---|------|-------|----------|
| 8.1 | Vista semanal | Navegar a `/agenda` | Calendario con 7 columnas (lun-dom), horas 08:00-20:00 |
| 8.2 | Navegar semanas | Click ← "Semana anterior" / → "Semana siguiente" | Cambia el rango de fechas |
| 8.3 | Volver a hoy | Click "Hoy" | Vuelve a la semana actual |
| 8.4 | Filtrar por empleada | Dropdown, seleccionar "Ana Martínez" | Solo muestra citas de Ana |
| 8.5 | Ver detalle de cita | Click en una tarjeta de cita | Modal con info: cliente, servicios, empleada, hora, estado, acciones |
| 8.6 | Confirmar cita (PENDIENTE → CONFIRMADA) | Modal detalle, click "Confirmar" | Estado cambia a CONFIRMADA |
| 8.7 | Cancelar cita | Modal detalle, click "Cancelar", escribir motivo, confirmar | Estado cambia a CANCELADA, tarjeta se atenúa |
| 8.8 | No se puede confirmar si ya está completada | Cita COMPLETADA | Sin botones de acción |
| 8.9 | No se puede cancelar si ya está cancelada | Cita CANCELADA | Sin botones de acción |
| 8.10 | Crear cita nueva | Click "+ Nueva Cita", buscar cliente, seleccionar servicios, elegir empleada, fecha, slot horario, crear | Aparece en el calendario |
| 8.11 | Crear cita sin cliente | Modal, no seleccionar cliente | Botón crear deshabilitado |
| 8.12 | Crear cita sin servicios | No seleccionar servicios | Botón crear deshabilitado |
| 8.13 | Crear cita sin empleada | No seleccionar empleada | Botón crear deshabilitado |
| 8.14 | Slots disponibles | Después de seleccionar fecha+empleada+servicios | Muestra botones de horario disponibles |
| 8.15 | Slots no disponibles | Fecha sin horarios configurados | Muestra "No hay horarios disponibles" |
| 8.16 | Completar cita (CONFIRMADA → COMPLETADA) | Modal detalle, click "Completar", ajustar servicios/precios si necesario, método pago, confirmar | Cita marcada COMPLETADA, registro financiero creado |
| 8.17 | Completar: descuento | En modal completar, toggle descuento, ingresar monto + motivo (>= 10 chars) | Total se reduce |
| 8.18 | Completar: propina | En modal completar, ingresar monto propina | Propina incluida en total |

---

## 9. VENTAS (POS Productos)

| # | Caso | Pasos | Expected |
|---|------|-------|----------|
| 9.1 | Listar productos para venta | Navegar a `/ventas` | Grid de productos RETAIL con nombre, precio, stock indicator |
| 9.2 | Agregar producto al carrito | Click en tarjeta de producto | Aparece en carrito lateral con cantidad 1 |
| 9.3 | Incrementar cantidad en carrito | Click "+" en carrito | Cantidad sube, total se actualiza |
| 9.4 | Disminuir cantidad en carrito | Click "-" en carrito | Cantidad baja, total se actualiza |
| 9.5 | Eliminar item del carrito | Click "✕" en item | Item desaparece del carrito |
| 9.6 | Vaciar carrito | Click "Vaciar" | Carrito vacío |
| 9.7 | Seleccionar cliente | Dropdown cliente, seleccionar | Cliente asignado a la venta |
| 9.8 | Seleccionar empleada | Dropdown empleada, seleccionar | Empleada asignada a la venta |
| 9.9 | Cobrar en efectivo | Seleccionar EFECTIVO, ingresar monto recibido mayor al total | Muestra "Cambio", botón "Cobrar $X" habilitado |
| 9.10 | Cobrar sin monto recibido suficiente | EFECTIVO, monto recibido menor al total | Botón deshabilitado |
| 9.11 | Cobrar con tarjeta o transferencia | Seleccionar TARJETA o TRANSFERENCIA, click "Cobrar" | Venta exitosa |
| 9.12 | Producto sin stock | Ver producto con stock 0 | Tarjeta atenuada, click deshabilitado |
| 9.13 | Buscar producto | Escribir en search | Filtra resultados |
| 9.14 | Filtrar por categoría | Dropdown categoría | Filtra productos |

---

## 10. FINANZAS — REGISTROS

| # | Caso | Pasos | Expected |
|---|------|-------|----------|
| 10.1 | Listar registros | Navegar a `/finanzas`, tab "Registros" por defecto | Tabla con #, cliente, empleada, servicios, productos, total, método pago, estado, acciones |
| 10.2 | Ver resumen del día | Arriba de la tabla | 6 tarjetas: Ingresos, Atenciones, Servicios, Productos, Comisiones, Propinas |
| 10.3 | Ver detalle de registro | Click 👁️ en fila | Modal con desglose completo |
| 10.4 | Anular registro | Click 🚫, confirmar | Registro anulado |
| 10.5 | Filtrar por tipo | Click "Servicios" / "Productos" | Filtra la tabla |
| 10.6 | Filtrar por fecha | Desde/Hasta date inputs | Actualiza resultados |
| 10.7 | Paginación | Si hay +12 registros, click "Siguiente" | Avanza de página |
| 10.8 | Total coincide con suma | Ver registro #2 (productos $26.500) | Total calculado correctamente (NO $0) |

---

## 11. FINANZAS — GASTOS

| # | Caso | Pasos | Expected |
|---|------|-------|----------|
| 11.1 | Listar gastos | Click tab "Gastos" | Tabla con descripción, monto, categoría, método pago, fecha, acciones |
| 11.2 | Crear gasto | "+ Nuevo gasto", descripción "QA Test Gasto", monto 50000, categoría, método pago, crear | Aparece en la tabla |
| 11.3 | Crear gasto sin descripción o monto 0 | Dejar descripción vacía o monto 0 | Botón deshabilitado |
| 11.4 | Eliminar gasto | Click 🗑️, confirmar | Gasto eliminado |
| 11.5 | Gasto fijo | Checkbox "Es gasto fijo" al crear | Marca registrada |

---

## 12. FINANZAS — DEVOLUCIONES

| # | Caso | Pasos | Expected |
|---|------|-------|----------|
| 12.1 | Listar devoluciones | Click tab "Devoluciones" | Tabla con tipo, producto, cantidad, motivo, monto, fecha |
| 12.2 | Crear devolución de producto | "+ Nueva devolución", seleccionar venta, seleccionar producto, cantidad 1, monto, motivo, "Devolver al stock" checked, crear | Aparece en la tabla, stock del producto se restaura |
| 12.3 | Crear devolución sin venta | No seleccionar venta | Botón deshabilitado |
| 12.4 | Filtrar por tipo | Click "Productos" / "Servicios" | Filtra la tabla |

---

## 13. FINANZAS — NÓMINA

| # | Caso | Pasos | Expected |
|---|------|-------|----------|
| 13.1 | Ver pendientes | Click tab "Nómina" → sub-tab "Pendientes" | Tarjetas de empleadas con comisiones pendientes |
| 13.2 | Liquidar empleada | Click "Auditar y Liquidar", revisar montos, confirmar | Empleada ya no aparece en pendientes |
| 13.3 | Ajustar monto al liquidar | Check "Ajustar monto a pagar", ingresar monto diferente + motivo >= 10 chars | Liquidación con monto ajustado |
| 13.4 | Sin pendientes | Liquidar todas las empleadas | Muestra "Todo al día" con checkmark |

---

## 14. FINANZAS — REPORTES

| # | Caso | Pasos | Expected |
|---|------|-------|----------|
| 14.1 | Generar reporte | Click tab "Reportes", seleccionar fecha, click "Generar reporte" | 2 secciones: Resumen del periodo + ROI Mensual |
| 14.2 | ROI se muestra | Revisar sección ROI | Ingresos, gastos, ganancia neta, % ROI (verde si positivo, rojo si negativo) |
| 14.3 | Sin datos | Seleccionar fecha sin actividad | Muestra "Sin datos disponibles" |

---

## 15. SUPERADMIN — SALONES

| # | Caso | Pasos | Expected |
|---|------|-------|----------|
| 15.1 | Listar salones | Login superadmin, navegar a `/salones` | Tabla con ID, nombre, WhatsApp, dueña, plan, estado, acciones, creado |
| 15.2 | Crear salón | Click "+ Crear salón", llenar datos, crear | Redirige a lista, nuevo salón visible |
| 15.3 | Editar salón | Click ✏️, cambiar nombre/plan/colores, guardar | Cambios reflejados, mensaje de éxito |
| 15.4 | Editar: toggle activo | Toggle activo/inactivo, guardar | Estado cambiado |
| 15.5 | Ver detalle salón | Click nombre del salón | 4 tarjetas: info general, personalización, bot, API key |
| 15.6 | Copiar API key | Click "Copiar" en API key | "✓ Copiado" por 2 segundos |
| 15.7 | Toggle estado salón | Click 🔄 en lista | Optimistic update, estado cambia |
| 15.8 | Cambiar plan | Dropdown BASIC ↔ PREMIUM | Plan se actualiza, flash de éxito |
| 15.9 | Eliminar salón | Click 🗑️, confirmar en bubble inline | Salón eliminado después de 300ms |
| 15.10 | Cancelar eliminación | Click 🗑️, click fuera | Salón no se elimina |
| 15.11 | Buscar salón | Escribir en search | Filtra resultados |

---

## 16. CASOS BORDE TRANSVERSALES

| # | Caso | Pasos | Expected |
|---|------|-------|----------|
| 16.1 | Token expirado | Manipular localStorage (accessToken = "expired") | Refresh token, sesión continúa |
| 16.2 | Token y refresh expirados | Setear ambos tokens inválidos | Redirige a login |
| 16.3 | Sin token | localStorage.clear(), navegar a ruta protegida | Redirige a login |
| 16.4 | Cerrar sesión | Click "Cerrar sesión" | Elimina tokens, redirige a login |
| 16.5 | Navegación directa por URL | Ir a ruta protegida sin token | Redirige a login |
| 16.6 | Fecha pasada en creación de cita | Seleccionar fecha pasada | Input lo bloquea (min = today) |

---

## 17. REGRESIÓN — VERIFICACIONES POST-FIX

| # | Caso | Pasos | Expected |
|---|------|-------|----------|
| 17.1 | React key warning | Abrir consola en superadmin, navegar entre páginas | Sin warnings de `key` |
| 17.2 | Error login muestra mensaje amigable | Login con contraseña incorrecta | Muestra "Credenciales inválidas" (no código) |
| 17.3 | Total financiero correcto | Ver registro con solo productos | Total = suma de servicios + productos |
| 17.4 | Clientes: columna visitas | Ver tabla de clientes | Columna "Visitas" muestra número (no vacío) |
| 17.5 | Superadmin salonId auto-asignado | Login superadmin, ver JWT en respuesta API | salonId > 0 (no 0) |
| 17.6 | Guards `salonId == null` | Navegar todas las páginas como dueña | Sin bloqueos, datos visibles |

---

## Bugs conocidos no arreglados

| # | Descripción | Severidad |
|---|-------------|-----------|
| B1 | Dashboard trend badges: 12.5% hardcodeado (no real) | 🔵 Bajo |
| B2 | Finanzas paginación: no resetea a página 1 al cambiar filtros | ⚠️ Medio |
| B3 | GastosTab: `selectedGasto.concepto` debería ser `descripcion` | ❌ Bug |
| B4 | Sin toast/notificaciones globales — errores CRUD silenciosos | 🔵 Bajo |
| B5 | `formatCurrency` usa locale CL en algunos lugares, CO en otros | 🔵 Bajo |
| B6 | Completar cita: POST /registros antes de POST /completar — inconsistencia si falla | ⚠️ Medio |
| B7 | CreateSalonPage sin validación client-side | 🔵 Bajo |
| B8 | Debug console.log en ServiciosPage.tsx | 🔵 Bajo |
| B9 | Empleadas delete no implementado (botón siempre disabled) | 🔵 Feature |
| B10 | Nombres duplicados en servicios/productos permitidos | 🔵 Decisión |
