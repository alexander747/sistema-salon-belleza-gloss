# Archive Report — carga-historica-backfill

**Change**: carga-historica-backfill
**Archived**: 2026-08-23
**Archive location**: `openspec/changes/archive/2026-08-23-carga-historica-backfill/`
**Artifact store mode**: openspec (hybrid — archive report persisted to Engram `sdd/carga-historica-backfill/archive-report`)
**Verify verdict**: PASS WITH WARNINGS (READY TO ARCHIVE) — 14/14 spec scenarios, 0 CRITICAL, 2 WARNING, 2 SUGGESTION
**Delivery**: Merged to main, stacked-to-main 3 PRs (HEAD e46868b)

## Intent

El dueño debe cargar al sistema todo lo anotado en su cuaderno (citas, ventas, registros de servicio, cajas) con sus fechas reales, para que las cuentas concilien. Hoy el sistema fuerza fechas ≥ hoy en la agenda y usa `creadoEn` (timestamp de auditoría) como fecha de negocio de los registros: cualquier backfill quedaría contabilizado en la fecha de carga y la conciliación fallaría. El cambio introduce `fechaHora` (fecha de negocio) en registros y permite fecha seleccionable en todos los formularios.

## What Changed

### PR1 — Backend datos (base main, autónomo): commits `1be9973`, `d9432b2`, `cb478a6`

| Área | Cambio |
|------|--------|
| `RegistroServicioEntity.ts` | `+@Column({ type: 'datetime', nullable: true }) fechaHora` (columna nullable, cero migración de datos con DB_SYNCHRONIZE) |
| `RegistroServicioDTO.ts` | `+fechaHora` (mapper con `?? creadoEn` fallback) |
| `packages/validation` `finanzas.schema.ts` | `+fechaHora: z.string().datetime().optional()` en `createRegistroSchema` + rebuild (`npx tsc`) |
| `CreateRegistroUseCase.ts` | `fechaHora` default ahora; pasa `fecha` del payload a `verificarCajaAbierta`; persiste `fechaHora`; caja = la de la fecha del payload |
| `verificarCajaAbierta.ts` | `+fecha?` param (default `getColombiaDateString()`); fecha explícita ≠ hoy sin caja ABIERTA de esa fecha → throw `CajaNoAbiertaEnFechaError` (409 `CAJA_NO_ABIERTA_EN_FECHA`); el camino de hoy conserva 422 `CAJA_CERRADA` |
| `shared/errors.ts` | `+CajaNoAbiertaEnFechaError` (409) |
| `CompletarCitaUseCase.ts` / `CambiarEstadoCitaUseCase.ts` | `fechaHora = input.registro.fechaHora ?? cita.fechaHora` + pasan `fecha` al guard |
| `TypeORMRegistroServicioRepository.ts` | `search`/`count`/`findBySalonAndDateRange`/`findConDeudaBySalon`: `COALESCE(r.fechaHora, r.creadoEn)` + `ORDER BY COALESCE(...) DESC` |
| `NominaPendienteUseCase.ts` | Período QUINCENAL/SEMANAL por `fechaHora ?? creadoEn`; guard anti-doble-pago se MANTIENE en `creadoEn` (auditoría) |
| `ObtenerDetalleCierreCajaUseCase.ts` | Movimientos `fecha: r.fechaHora ?? r.creadoEn` |
| `CuentasCobrarUseCase.ts` | Antigüedad de la deuda por `fechaHora ?? creadoEn` |
| `CreateGastoUseCase.ts` | Fix: honra `input.fecha` (default hoy) + liga la caja ABIERTA de esa fecha (`findAbiertaBySalonYFecha`) |

### PR2 — Caja backfill (base main tras PR1): commit `431ff89`

| Área | Cambio |
|------|--------|
| `packages/validation` `caja.schema.ts` | `+fechaCaja: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()` + rebuild |
| `AbrirCajaUseCase.ts` | `+fechaCaja?` (default hoy) en input y create; día/any-open/backstop `ER_DUP_ENTRY` operan sobre la fecha pasada |
| `CajaController.ts` | Passthrough `fechaCaja` (spread condicional) |
| `CajaTab.tsx` | Date input en modal Abrir (default hoy) + `fechaCaja` en POST |

### PR3 — Frontend formularios (base main tras PR1+PR2): commits `b5f36eb`, `fb38671`, `c9c4ba6`

| Área | Cambio |
|------|--------|
| `AgendaPage.tsx` | Quitar `min` del date input (L1673) + default `fecha: todayStr` (L250/499) |
| `WalkInModal.tsx` / `VentasPage.tsx` | State `fecha` default hoy + `fechaHora` en payload (mediodía local TZ-safe: `new Date(\`${fecha}T12:00:00\`).toISOString()`); `cajaError.ts` +UI para el 409 nuevo |
| `FinanzasPage.tsx` | Muestra `fechaHora ?? creadoEn` (L1121/1125/1301/2471/3549) |

Mirror n8n: sin cambios (comparte handlers → mismo contrato).

## Specs Synced (delta → main)

| Domain | Action | Details |
|--------|--------|---------|
| finanzas-registros | Updated (ADDED 2) | `POST Crear Registro con fechaHora`, `Reportes filtran por fechaHora` (6 escenarios). 6 existing requirements preserved verbatim. |
| finanzas-caja | Updated (ADDED 3) | `POST Abrir Caja con fechaCaja opcional`, `Backfill Secuencial de Cajas`, `Cerrar Caja sin Pedir Fecha` (6 escenarios). 17 existing requirements preserved verbatim. |
| finanzas-gastos | Updated (ADDED 1) | `POST Crear Gasto Honra fecha` (2 escenarios). 6 existing requirements preserved verbatim. |
| agenda-citas | Updated (ADDED 2) | `Citas con Fechas Pasadas (UI)`, `Completar Cita Backfilleada usa cita.fechaHora` (4 escenarios). 11 existing requirements preserved verbatim. |

Final requirement counts: finanzas-registros 8, finanzas-caja 20, finanzas-gastos 7, agenda-citas 13. No duplicate headings.

## Merge Decisions

- **Heading normalized**: `## ADDED Requirements` → `## Requirements` in `openspec/specs/finanzas-registros/spec.md` y `openspec/specs/finanzas-gastos/spec.md` (source-of-truth convention, igual que el archivo previo hizo en finanzas-caja).
- **Delta annotation dropped**: los headers `# Delta for {domain}` y el wrapper `## ADDED Requirements` se omiten del main spec (metadata del cambio; el delta completo queda en el archive).
- **Related (not duplicate) requirements flagged**: `POST Crear Registro con fechaHora` (añadido) extiende `POST Crear Registro` (pre-existente) — el nuevo cubre el campo fecha + caja por fecha; ambos retenidos. `POST Abrir Caja con fechaCaja opcional` extiende `POST Abrir Caja` — ambos retenidos. `POST Crear Gasto Honra fecha` extiende `POST Crear Gasto` — ambos retenidos. `Cerrar Caja sin Pedir Fecha` documenta el comportamiento de `POST Cerrar Caja` (que ya no pide fecha) — ambos retenidos.

## Verification Summary

- **Spec scenarios**: 14/14 PASS (registros 6/6: fechaHora 3 + reportes 3; caja 6/6: abrir con fecha 3 + backfill secuencial 2 + cerrar sin fecha 1; gastos 2/2; agenda 4/4: UI fechas 2 + completar backfilleada 2)
- **Tests**: API 450 PASS (65 files) + Dashboard 283 PASS + 1 PRE-EXISTENTE flake AgendaPage.test.tsx (pasa 22/22 en aislamiento; idéntico al reportado en PR2/PR3, no relacionado con este cambio)
- **Type check**: tsc API 3 errores PRE-EXISTENTES (seed.ts:238, CreateRegistroUseCase.test.ts:94, RegistroServicioItemDTO.test.ts:3 — diffs vacíos contra base 3c6b655); tsc dashboard 0 errores
- **Coverage**: `packages/validation/dist` reconstruido (fechaHora/fechaCaja presentes en .js y .d.ts)
- **TDD**: strict TDD; PR3 con tabla RED/GREEN/TRIANGULATE detallada; PR1/PR2 batch previo verificado independientemente (todos los test files existen y pasan)
- **Smoke E2E (orchestrator, curl real)**: abrir caja 18/08 → venta con fechaHora → cierre arqueo → P&L 18/08 = 150.000 → 409 `CAJA_NO_ABIERTA_EN_FECHA` sin caja de esa fecha. Test data limpiado por orchestrator (registros 62/63, cajas 5/6/7).

## Rollback

Revertir los commits de código de los 3 PRs en orden inverso (stacked-to-main, sin merge commits):

```bash
git revert c9c4ba6 fb38671 b5f36eb 431ff89 cb478a6 d9432b2 1be9973
```

Los commits `e46868b` / `26a099c` / `bbc440d` (docs: tareas y artifacts) pueden revertirse o dejarse. Sin migración de datos: `fechaHora` queda como columna nullable inerte si se revierte el código. Rebuild `packages/validation` (`cd packages/validation && npx tsc`) + restart API.

## Residual Risks

- **ResumenDia gastos fuera de su día (pre-existente, no bloqueante)**: design.md AD7 afirma que ResumenDia compara "a medianoche UTC", pero `ResumenDiaUseCase` pasa límites 05:00 UTC a `sumBySalonAndDateRange` y MySQL compara `DATE X` como X 00:00 UTC → `DATE >= 05:00` = FALSE. Consecuencia: gastos (actuales Y backfilleados) NO aparecen en el resumen de su día; caen en el del día anterior. PRE-EXISTENTE (base 3c6b655 tiene los mismos límites). P&L correcto (límites 00:00 UTC cerrados). **Recomendado: issue separado** para alinear los límites de ResumenDia.
- **`ultimaVisita` estampa NOW**: `CreateRegistroUseCase.ts:186-190` usa `ultimaVisita: new Date()` — para registros backfilleados estampa la fecha de carga, no la de negocio. Fuera de spec, leak semántico menor.
- **Gasto backfilleado sin caja de esa fecha → cajaId null silencioso**: `CreateGastoUseCase.ts:44` (no chokepoint, consistente con legacy; el gasto no aparece en ningún arqueo). Considerar aviso cuando fecha ≠ hoy y no hay caja.
- **AgendaPage flake (pre-existente)**: Dashboard test "crear cliente desde el modal" falla 1/284 — reproduce en el commit padre; no relacionado con este cambio pero degrada la señal de CI.

## Regla any-open + flujo secuencial (documentado)

La regla any-open se MANTIENE sin cambios: abrir una caja pasada exige cerrar cualquier caja ABIERTA primero. El dueño backfillea secuencialmente por día: abrir 16/08 → registrar ventas 16/08 → cerrar 16/08 → abrir 17/08 → … Una caja pasada ABIERTA bloquea abrir otra caja (409 `CAJA_YA_ABIERTA`) y bloquea las ventas de hoy (422 `CAJA_CERRADA` vía regla de oro) — comportamiento deseado durante backfill; el dueño cierra la pendiente al terminar. `POST /caja/cerrar` NO pide fecha: `fechaCaja` es autoritativa y `cierreEn` queda como auditoría del momento físico. Flujo documentado en specs/design (exploration §3).

## Archive Contents

- proposal.md ✅
- specs/ (finanzas-registros, finanzas-caja, finanzas-gastos, agenda-citas) ✅
- design.md ✅
- tasks.md ✅ (22/27 tasks marcadas; fase 4.1–4.5 smoke/E2E/commits ejecutada por orchestrator + apply, sin checkbox en tasks.md)
- verify-report.md ✅ (PASS WITH WARNINGS — restaurado desde Engram #330)
- archive-report.md ✅ (this file)

## Source of Truth Updated

- `openspec/specs/finanzas-registros/spec.md` (6 → 8 requirements)
- `openspec/specs/finanzas-caja/spec.md` (17 → 20 requirements)
- `openspec/specs/finanzas-gastos/spec.md` (6 → 7 requirements)
- `openspec/specs/agenda-citas/spec.md` (11 → 13 requirements)

## SDD Cycle Complete

Change fully planned, implemented, verified (PASS WITH WARNINGS, non-blocking), merged to main (stacked-to-main 3 PRs, HEAD e46868b), and archived.
