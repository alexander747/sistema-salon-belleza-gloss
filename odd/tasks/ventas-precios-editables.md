# Feature: Ventas — precios editables por línea + descuento % con alcance

## Objetivo
En el registro de una venta (WalkInModal, AgendaPage "completar cita", VentasPage):

1. **Editar el PRECIO de cada línea** en el carrito: servicios y productos.
2. **Descuento por % con ALCANCE**: Servicios / Productos / Ambos.
3. **Quitar el switch "Ajustar valor total"** (lo reemplazan los precios por línea).
4. El **insumo se descuenta SOLO de los servicios**; la comisión **nunca** toca productos.

## Reglas de cálculo (fuente de verdad)
- `precioLinea` = precio editado por el usuario ?? precio de lista (catálogo).
- `descPct` por alcance ∈ {SERVICIOS, PRODUCTOS, AMBOS}: se aplica sobre `precioLinea` de las líneas del alcance.
- `totalServicios` = Σ(precioServicio efectivo × cantidad) — con el % de servicios.
- `totalProductos` = Σ(precioVentaUnitario efectivo × cantidad) — con el % de productos.
- `insumos` = Σ(costo insumo de líneas de SERVICIO) — los productos no tienen insumo.
- `comision = max(0, totalServiciosEfectivo − insumos) × porcentajeComision`.
- `valorFinal` (cobrado) = totalServicios + totalProductos + propina.
- `montoPendiente = max(0, valorFinal − propina − Σ pagos)`.

## Precedencia
1) precio editado por línea → 2) % del alcance → 3) insumo se resta de servicios.

## Etapas
- **E1 — Precios editables por línea.** Servicio: ya viaja `precioServicio`. Producto: agregar precio al payload + `CreateRegistroUseCase` + schema.
- **E2 — Descuento % con alcance.** schema + backend + espejos front (`reparto.ts`) + reportes (`calculo-registro.ts`, PyL, ResumenDia, Caja).
- **E3 — Quitar "Ajustar valor total"** + adaptar display (FinanzasPage Registros), Excel, y la proración de reportes (deja de ser proporcional).

## Archivos afectados
Backend: `RegistroServicioEntity`, `RegistroProductoEntity`/`DTO`, `RegistroServicioDTO`, `CreateRegistroUseCase`, `calculo-registro.ts`, `ComisionService`, `PyLMensualUseCase`, `ResumenDiaUseCase`, `calcularReporteCierre`, `ExcelExportService`, `packages/validation/finanzas.schema.ts`.
Frontend: `WalkInModal.tsx`, `AgendaPage.tsx`, `VentasPage.tsx`, `FinanzasPage.tsx`, `utils/reparto.ts`, `utils/fiado.ts`.

## Criterios de aceptación
- Editar el precio de un servicio cambia su línea y el total; la factura (recibo) refleja el valor editado.
- Editar el precio de un producto cambia su línea/subtotal y persiste el precio editado en `registro_productos.precioVentaUnitario`.
- El % con alcance descuenta solo el alcance elegido; el desglose lo muestra.
- La comisión = `(servicios efectivos − insumos) × %`; los productos no entran.
- El insumo editado (override) se respeta.
- Sin "Ajustar valor total"; el recibo y los reportes cierran.
- Tests verdes + `tsc` limpio.

## Estado
- [x] E1 — Precios editables por línea (servicio + producto). WalkInModal/AgendaPage/VentasPage + payload + schema (`precioVenta`) + backend.
- [x] E2 — Descuento % con alcance (`descuentoAlcance` SERVICIOS|PRODUCTOS|AMBOS) + `calculo-registro` reescrito + reportes (PyL/ResumenDia/Caja/Excel).
- [x] E3 — Quitado "Ajustar valor total" (`totalPersonalizado`) de los 3 flujos + schema + backend + display.

## Progreso / evidencia
- E1: sub-agente; dashboard 94/94 + API 29/29; `tsc` limpio.
- E2+E3: sub-agente; API 261/266 (5 pre-existentes Nomina) y dashboard 178/179 (1 pre-existente) en aislado.
- **E2E (HTTP)**: `POST /registros` servicio 550.000 + insumo editado 10.000 + `porcentajeDescuento: 10` + `descuentoAlcance: 'SERVICIOS'` → **valorFinal 495.000**, **comisionCalculada 291.000** = (495.000 − 10.000) × 60%.
- Regresión full: API 717/722 (solo las 5 pre-existentes de Nomina); dashboard con flakes de paralelismo (AgendaPage/VentasPage/CajaCerradaFlows pasan aisladas) + las 2 pre-existentes (mobileBottomSheet, FinanzasPage).

## Notas
- Sin migración (prod `DB_SYNCHRONIZE=true`); la columna `descuentoAlcance` la agrega synchronize al reiniciar el API.
- `calculo-registro` conserva un fallback proporcional para registros legacy con "total ajustado".
- Nada commiteado.
