# Design: Carga Histórica — Backfill del Cuaderno

## Technical Approach

Backend-first (API-first): añadir `fechaHora` (fecha de negocio) a `RegistroServicioEntity` y migrar TODOS los filtros de rango a `COALESCE(fechaHora, creadoEn)` — las filas legacy siguen correctas sin migración de datos. `verificarCajaAbierta` gana un parámetro `fecha` (default hoy) para ligar el registro a la caja de la fecha del payload; sin caja de esa fecha → 409 nuevo. `AbrirCajaUseCase` acepta `fechaCaja` opcional; `CreateGastoUseCase` honra `input.fecha` y liga la caja por esa fecha. Luego UI: inputs de fecha con default hoy en WalkInModal/VentasPage/CajaTab y quitar `min` en AgendaPage.

## Architecture Decisions

| # | Opción | Tradeoff | Decisión |
|---|--------|----------|----------|
| 1 | Columna `fechaHora`: NOT NULL DEFAULT vs **nullable** | NOT NULL con DB_SYNCHRONIZE en tabla poblada → ALTER en 2 pasos (ADD + DEFAULT) que falla en filas existentes; nullable → riesgo cero | **Nullable `datetime`** + el use case SIEMPRE la setea (`input.fechaHora ?? new Date()`; `cita.fechaHora` en completar). Filtros con `COALESCE`. Data-fix opcional: `UPDATE registros_servicio SET fechaHora = creadoEn WHERE fechaHora IS NULL` |
| 2 | Filtros legacy: SQL `COALESCE` vs data-fix único | COALESCE = cero migración, levemente más lento; data-fix = limpio pero riesgoso | **COALESCE en repo SQL** (`COALESCE(r.fechaHora, r.creadoEn)`) y `r.fechaHora ?? r.creadoEn` in-memory. El guard anti-doble-pago (registro vs última liquidación) se MANTIENE en `creadoEn` (semántica de auditoría) |
| 3 | `verificarCajaAbierta` firma | Cambio de firma rompe callers | **`verificarCajaAbierta(cajaRepo, salonId, fecha = getColombiaDateString())`** — default preserva callers legacy (CreateDevolucion, devoluciones sin fecha). `fecha` se deriva de `input.fechaHora` (registros) o `cita.fechaHora` (completar) |
| 4 | Error sin caja para la fecha del payload | Reusar `CajaCerradaError` (422) vs 409 nuevo | **Nuevo `CajaNoAbiertaEnFechaError`** — 409 `CAJA_NO_ABIERTA_EN_FECHA`, mensaje "No hay caja abierta para la fecha {fecha} — abrí la caja de esa fecha antes de registrar la venta". Solo aplica cuando `fecha` explícita ≠ hoy; el camino de hoy conserva 422 `CAJA_CERRADA` (specs y tests vigentes intactos) |
| 5 | `fechaCaja` en schema | `z.string().date()` depende de zod ≥3.20; el codebase usa regex | **`fechaCaja: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()`** (patrón de `disponibilidadQuerySchema`); uso default `getColombiaDateString()`; día + any-open + backstop `ER_DUP_ENTRY` operan sobre la fecha pasada |
| 6 | Fix gasto: solo `fecha` vs `fecha` + caja | Solo fecha ubica mal el gasto en el arqueo de la caja pasada | **`fecha` + caja por esa fecha** (`findAbiertaBySalonYFecha(salonId, input.fecha ?? hoy)`); `GastoController` ya hace spread de `req.body` → solo cambia `CreateGastoUseCase` + `CreateGastoInput` |
| 7 | Hora del día para registros sin hora | `new Date(fecha)` = medianoche UTC (riesgo de borde); `now` con fecha forzada = frágil | **Mediodía local**: `fechaHora: new Date(\`${fecha}T12:00:00\`).toISOString()` (patrón TZ-safe de AGENTS.md); cae dentro del día COT para todos los filtros |
| 8 | Orden de listados | `orderBy creadoEn` desordena backfill | **`ORDER BY COALESCE(r.fechaHora, r.creadoEn) DESC`** en `search`/`findBySalonAndDateRange` |

## Data Flow

    WalkInModal/VentasPage ── POST /registros {fechaHora} ──→ CreateRegistroUseCase
      │  fecha = colombiaDate(fechaHora)                          │
      │                                                           ▼
      │                              verificarCajaAbierta(cajaRepo, salonId, fecha)
      │                                   ├─ caja ABIERTA de esa fecha → cajaId
      │                                   └─ sin caja → 409 CAJA_NO_ABIERTA_EN_FECHA
      ▼
    CompletarCitaUseCase ── fechaHora ?? cita.fechaHora ──→ mismo chokepoint
    Reportes (P&L, resumen, nómina, detalle, cuentas) ── COALESCE(fechaHora, creadoEn)

    CajaTab modal Abrir ── POST /caja/abrir {fechaCaja} ──→ AbrirCajaUseCase
      → any-open (409) → findBySalonYFecha (409) → create → backstop ER_DUP_ENTRY

## File Changes

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `RegistroServicioEntity.ts` | Modify | `+@Column({ type: 'datetime', nullable: true }) fechaHora` |
| `RegistroServicioDTO.ts` | Modify | `+fechaHora` (mapper con `?? creadoEn`) |
| `packages/validation/src/finanzas.schema.ts` | Modify | `+fechaHora: z.string().datetime().optional()` en `createRegistroSchema` |
| `packages/validation/src/caja.schema.ts` | Modify | `+fechaCaja` regex opcional |
| `shared/errors.ts` | Modify | `+CajaNoAbiertaEnFechaError` (409) |
| `CreateRegistroUseCase.ts` | Modify | `fechaHora` default + pasar `fecha` a `verificarCajaAbierta` + persistir `fechaHora` |
| `verificarCajaAbierta.ts` | Modify | `+fecha?` param + throw 409 en fecha explícita sin caja |
| `CompletarCitaUseCase.ts` | Modify | inyectar `fechaHora: input.registro.fechaHora ?? cita.fechaHora` + pasar `fecha` al guard |
| `CambiarEstadoCitaUseCase.ts` | Modify | pasar `cita.fechaHora` al guard en estado COMPLETADA |
| `TypeORMRegistroServicioRepository.ts` | Modify | `search`/`count`/`findBySalonAndDateRange`: `COALESCE` + order |
| `NominaPendienteUseCase.ts` | Modify | filtro período → `r.fechaHora ?? r.creadoEn` |
| `ObtenerDetalleCierreCajaUseCase.ts` | Modify | movimientos `fecha: r.fechaHora ?? r.creadoEn` |
| `CuentasCobrarUseCase.ts` | Modify | `masAntiguo` → `fechaHora ?? creadoEn` |
| `CreateGastoUseCase.ts` | Modify | `+fecha?` en input; `fecha` + caja por esa fecha |
| `AbrirCajaUseCase.ts` | Modify | `+fechaCaja?` (default hoy) en input y create |
| `CajaController.ts` | Modify | passthrough `fechaCaja` (spread condicional) |
| `AgendaPage.tsx` | Modify | quitar `min` (L1677) + default `fecha: todayStr` (L250/499) |
| `WalkInModal.tsx` / `VentasPage.tsx` | Modify | state `fecha` default hoy + `fechaHora` en payload |
| `CajaTab.tsx` | Modify | date input en modal Abrir + `fechaCaja` en POST |
| `FinanzasPage.tsx` | Modify | mostrar `fechaHora` (L3547) |

## Interfaces / Contracts

    POST /registros             +fechaHora?: ISO        → 201 | 409 CAJA_NO_ABIERTA_EN_FECHA | 422 CAJA_CERRADA (hoy)
    POST /caja/abrir            +fechaCaja?: YYYY-MM-DD → 201 | 409 CAJA_YA_ABIERTA | 409 CAJA_YA_CERRADA
    POST /caja/cerrar           sin fecha (fechaCaja autoritativa) → 200
    POST /gastos                fecha?: YYYY-MM-DD (ya en schema) → 201
    Error: { ok:false, data:null, error:{ code:"CAJA_NO_ABIERTA_EN_FECHA", message, details } }
    Mirror n8n: mismo handler → mismo contrato.

## Testing Strategy

| PR | Capa | Qué | Cómo |
|----|------|-----|------|
| PR1 | Unit API | Schema `fechaHora` opcional; `verificarCajaAbierta` con fecha (409); `CreateRegistro` persiste fechaHora y caja por fecha; nómina/liquidación/detalle/cuentas con `fechaHora ?? creadoEn`; gasto honra fecha | RED→GREEN en `finanzas.schema.test.ts`, `verificarCajaAbierta.test.ts`, `CreateRegistroUseCase.test.ts`, `NominaPendienteUseCase.test.ts`, `LiquidarEmpleadaUseCase.test.ts`, `ObtenerDetalleCierreCajaUseCase.test.ts`, `CuentasCobrarUseCase.test.ts` (si existe), `CreateGastoUseCase.test.ts` |
| PR2 | Unit API+UI | `caja.schema.test.ts` `fechaCaja`; `AbrirCajaUseCase.test.ts` passthrough; `CajaController.test.ts`; `CajaTab.test.tsx` date input | RED→GREEN |
| PR3 | Unit UI | `AgendaPage.test.tsx` default hoy + fecha pasada; `WalkInModal.test.tsx`/`VentasPage.test.tsx` payload `fechaHora`; `FinanzasPage.test.tsx` fixture `fechaHora` | RED→GREEN |

TDD estricto (`strict_tdd: true`). Repo SQL (COALESCE) sin test unitario propio (no existe `TypeORMRegistroServicioRepository.test.ts`) → cubierto vía smoke E2E.

## Migration / Rollout

Sin migración manual: `DB_SYNCHRONIZE` crea la columna nullable. Data-fix opcional (rendimiento): `UPDATE registros_servicio SET fechaHora = creadoEn WHERE fechaHora IS NULL`. **Rebuild `packages/validation` (`npx tsc`) + restart API** — sin esto `validate()` strippea los campos nuevos.

## Open Questions

Ninguna bloqueante. Nota: la hora fija (mediodía local) para registros sin hora es una simplificación aceptada; el DTO expone la hora real.
