# Tasks: Historial de Cajas Completo

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~280–340 (código + tests) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | single PR |
| Delivery strategy | single-pr |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Backend: historial todas + detalle ABIERTA + tests | PR 1 | base main; tests incluidos |
| 2 | Frontend: CajaTab badges/aviso + tests | PR 1 | mismo PR (diff total < 400) |

## Phase 1: Backend — historial completo (TDD)

- [x] 1.1 RED: `apps/api/.../caja/__tests__/ListarCierresCajaUseCase.test.ts` — cambiar expectativa del test 1 a `listBySalonPaginated(1, 1, 2, undefined)` (todas); agregar caso "2 ABIERTA y 0 CERRADA → total 2" y filtros explícitos ABIERTA/CERRADA
- [x] 1.2 GREEN: `apps/api/.../caja/ListarCierresCajaUseCase.ts` — reemplazar `const estado = input.estado ?? 'CERRADA'` por `const estado = input.estado` (undefined = todas) + comentario
- [x] 1.3 RED: `apps/api/.../caja/__tests__/ObtenerDetalleCierreCajaUseCase.test.ts` — caso caja ABIERTA (montoRealEfectivo null) → `reporte.montoReal` null, `reporte.diferencia` null, movimientos presentes
- [x] 1.4 GREEN: `apps/api/.../caja/ObtenerDetalleCierreCajaUseCase.ts` — L61 `Number(caja.montoRealEfectivo)` → `caja.montoRealEfectivo === null ? null : Number(caja.montoRealEfectivo)`
- [x] 1.5 Verificar `CajaController.test.ts` y `CajaBanner`/rutas sin cambios (passthrough de estado ya cubierto: tests esperan `undefined` y `'CERRADA'`)

## Phase 2: Frontend — CajaTab (TDD)

- [x] 2.1 RED: `apps/pos-dashboard/src/components/caja/__tests__/CajaTab.test.tsx` — agregar mock `estado=ABIERTA` a `defaultApiMock` + tests nuevos: lista mixta (badges ABIERTA y CERRADA), aviso con huérfana (fechaCaja < hoy) y sin huérfana, `—` en fila ABIERTA, hoyCerrada con lista [hoy CERRADA, ayer ABIERTA] → "Reabrir caja", detalle de caja ABIERTA con badge ABIERTA
- [x] 2.2 GREEN: `CajaTab.tsx` — `fetchCajasAbiertas()` (`GET /caja/cierres?estado=ABIERTA&limit=0`) en mount; `pendientes = abiertas.filter(c => c.fechaCaja < getColombiaDateString())`; banner "Caja pendiente de cierre" con count + botón Ver (abre detalle de la más reciente)
- [x] 2.3 GREEN: badges dinámicos en filas (ABIERTA verde / CERRADA ámbar) y modales (reporte/detalle según `estado`); `—` para `montoEsperado`/`montoRealEfectivo`/`diferencia` null; labels "Historial de cajas" y PaginationBar `label="cajas"`
- [x] 2.4 GREEN: hardening `hoyCerrada` → `.find(c => c.estado === 'CERRADA' && c.fechaCaja === getColombiaDateString())` (misma semántica, inmune a futuros filtros; sin tocar CajaBanner)

## Phase 3: Verification

- [x] 3.1 `cd apps/api && npx vitest run` + `npx tsc --noEmit`
- [x] 3.2 `cd apps/pos-dashboard && npx vitest run`
- [x] 3.3 Cobertura API ≥80% (`cd apps/api && npx vitest run --coverage`)
- [ ] 3.4 Smoke manual: `GET /caja/cierres` → las 2 ABIERTA huérfanas (`meta.total=2`); `?estado=CERRADA` → vacío; `?estado=TODAS` → todas; CajaTab muestra el aviso

## Phase 4: Cleanup / Docs

- [x] 4.1 Revisar que no queden comentarios "solo CERRADA"/"cierres" desactualizados en CajaTab y use cases
- [x] 4.2 Commits por unidad de trabajo (backend, luego frontend, tests incluidos) con Conventional Commits

Notas: sin migraciones ni cambios de schema → no rebuild de `packages/validation`. `CajaController.ts`, rutas, repos y `CajaBanner.tsx` no se tocan (verificado en design).
