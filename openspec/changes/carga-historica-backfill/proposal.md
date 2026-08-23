# Proposal: Carga Histórica — Backfill del Cuaderno

## Intent

El dueño debe cargar al sistema todo lo anotado en su cuaderno (citas, ventas, registros de servicio, cajas) con sus fechas reales, para que las cuentas concilien. Hoy el sistema fuerza fechas ≥ hoy en la agenda y usa `creadoEn` (timestamp de auditoría) como fecha de negocio de los registros: cualquier backfill quedaría contabilizado en la fecha de carga y la conciliación fallaría. Se introduce `fechaHora` (fecha de negocio) en registros y se permite fecha seleccionable en todos los formularios.

## Scope

**In:**
- Columna `fechaHora` nullable en `registros_servicio`; `POST /registros` acepta `fechaHora` opcional (default ahora); `CompletarCita` usa `cita.fechaHora`.
- Migrar filtros de rango `creadoEn` → `fechaHora` con `COALESCE(fechaHora, creadoEn)` para filas legacy (repo, P&L, resumen, nómina, liquidación, detalle de cierre, cuentas por cobrar).
- `verificarCajaAbierta` resuelve la caja por la fecha del payload; registro backfilleado sin caja abierta de esa fecha → 409.
- `POST /caja/abrir` acepta `fechaCaja` opcional (default hoy) → backfill secuencial por día.
- Fix `CreateGastoUseCase`: honra `input.fecha` y liga la caja de esa fecha.
- UI: fecha en WalkInModal/VentasPage (default hoy, pasada/futura editable), fecha en modal Abrir caja, AgendaPage sin `min` + default hoy, FinanzasPage muestra `fechaHora`.

**Out:** Regla any-open (se mantiene, backfill secuencial). Cerrar caja NO pide fecha (`fechaCaja` autoritativa, `cierreEn` = auditoría). App mobile, n8n (contrato API igual), migraciones manuales (DB_SYNCHRONIZE).

## Capabilities

- **Modified** `finanzas-registros`: `fechaHora` opcional en alta; reportes filtran por `fechaHora`; 409 sin caja para la fecha del payload.
- **Modified** `finanzas-caja`: abrir con `fechaCaja` opcional; cerrar sin fecha (documentado); backfill secuencial.
- **Modified** `finanzas-gastos`: `POST /gastos` honra `fecha`.
- **Modified** `agenda-citas`: fechas pasadas permitidas + default hoy; registro de completar cita con `cita.fechaHora`.

## Approach

Backend-first: entidad/schema/uso de `fechaHora` con COALESCE (cero migración de datos), caja por fecha, fix gastos; luego UI con inputs de fecha. Rebuild `packages/validation` obligatorio.

## API Surface

- `POST /registros`: `+fechaHora?` ISO (default ahora).
- `POST /caja/abrir`: `+fechaCaja?` YYYY-MM-DD (default hoy).
- `POST /registros` (o completar cita) con fecha pasada sin caja ABIERTA de esa fecha → 409 `CAJA_NO_ABIERTA_EN_FECHA`.
- `POST /gastos`: `fecha?` (ya en schema) ahora efectiva + caja por esa fecha.

## Affected Areas

| Área | Impacto |
|------|---------|
| `RegistroServicioEntity.ts`, `RegistroServicioDTO.ts` | Modified (+`fechaHora`) |
| `finanzas.schema.ts`, `caja.schema.ts` | Modified (+campos opcionales) |
| `CreateRegistroUseCase`, `verificarCajaAbierta`, `CompletarCitaUseCase`, `CambiarEstadoCitaUseCase` | Modified (caja por fecha) |
| `TypeORMRegistroServicioRepository` + 5 use cases de reporte/nómina/caja/cuentas | Modified (filtros `fechaHora`) |
| `CreateGastoUseCase` | Modified (fix fecha) |
| `AbrirCajaUseCase`, `CajaController` | Modified (`fechaCaja`) |
| `AgendaPage.tsx`, `WalkInModal.tsx`, `VentasPage.tsx`, `CajaTab.tsx`, `FinanzasPage.tsx` | Modified (fechas) |
| ~10 archivos de test (api + dashboard) | Modified |

## Risks

| Riesgo | Prob | Mitigación |
|--------|------|------------|
| Filtros `fechaHora` alteran nómina/comisiones históricas | Media | COALESCE + fixtures con `fechaHora`; tests de período |
| NOT NULL en tabla poblada rompe synchronize | Media | Columna **nullable** + default en uso (ver design) |
| Backfill sin caja para la fecha | Media | 409 claro; flujo secuencial documentado |
| Rebuild de validation olvidado | Media | Task explícita + tests de schema |

## Rollback

Revertir diffs por PR (sin migración de datos). `fechaHora` queda como columna nullable inerte si se revierte el código. Rebuild + restart API.

## Dependencies

Rebuild `packages/validation` (`npx tsc`) + restart API. PR2 y PR3 dependen de PR1 (stacked-to-main).

## Success Criteria

- [ ] Registro backfilleado del 16/08 aparece en reportes del 16/08 y en la caja 16/08
- [ ] Abrir caja de fecha pasada funciona; cerrar sin fecha concilia el arqueo
- [ ] Citas con fecha pasada creables; default hoy
- [ ] Gastos backfilleados caen en su fecha y su caja
- [ ] vitest api + dashboard verdes; tsc sin errores nuevos

## PR Plan (stacked-to-main, revisión 800 líneas)

| PR | Alcance | Est. líneas |
|----|---------|-------------|
| PR1 | Backend datos: `fechaHora` + filtros + fix gasto + caja por fecha (autónomo) | ~400–480 |
| PR2 | Caja backfill: `fechaCaja` opcional en abrir + schema + modal CajaTab | ~150–200 |
| PR3 | Frontend formularios: WalkInModal/VentasPage fecha, AgendaPage min+default, FinanzasPage | ~200–280 |
