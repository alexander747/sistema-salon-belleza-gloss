# Tasks: Insumos en resumen, reportes y nómina

## Review Workload Forecast — PR1–PR5 (completed / historical)

| Field | Value |
|-------|-------|
| Estimated changed lines | ~780 (backend ~230, frontend ~290, nómina ~250, spec ~10) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR1 backend → PR2 frontend → PR3 nómina |
| Delivery strategy | auto-chain |
| Chain strategy | feature-branch-chain |
| Decision needed before apply | Resolved — owner decision 2026-09-29 (Reportes = privileged vía 403; `resumen` omite insumos+balanceNeto; sin stripping) |

(Historical: chained PRs `Yes`, chain `feature-branch-chain`, risk `High` — PR1–PR5 already landed.)

## Review Workload Forecast — PR6 first pass (SUPERSEDED by the PR6 revision below)

| Field | Value |
|-------|-------|
| Estimated changed lines | ~150–200 (FinanzasPage ~45, tests ~100, docs ~50) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR on `feat/insumos-reportes-pr6-aclaracion` (base = PR5 `6c2106e`) |
| Delivery strategy | auto-forecast |
| Chain strategy | feature-branch-chain |

Historical (commit `b4967a9`): tooltip + conditional line, replaced by Phase 8.

## Review Workload Forecast — PR6 revisión (active)

| Field | Value |
|-------|-------|
| Estimated changed lines | ~550–700 (backend ~200, frontend ~450; deletes: old helper+test ~130, dead DTO ~12) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR6a backend `cobrosDeudaAnterior` → PR6b frontend renombres + tira (base PR6a) |
| Delivery strategy | ask-on-risk |
| Chain strategy | feature-branch-chain |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | PR | Base branch | Notes |
|------|------|----|-------------|-------|
| 1 | Backend role-gating policy | PR 1 | `feat/insumos-reportes-tracker` | Branch `feat/insumos-reportes-pr1-backend`; tests with code |
| 2 | Frontend card/export gating | PR 2 | `feat/insumos-reportes-pr1-backend` | helper + types + cards |
| 3 | Nómina informational insumo | PR 3 | `feat/insumos-reportes-pr2-frontend` | use case + UI + tests |
| 4 | Registros pagination fix | PR 5 | `feat/insumos-reportes-pr3-nomina` | backend + frontend + spec |
| 5 | Ingresos/Cobrado clarification (PR6 first pass) | PR 6 | `feat/insumos-reportes-pr6-aclaracion` | SUPERSEDED by Phase 8 |
| 6 | `cobrosDeudaAnterior` backend (PR6a) | PR 6a | chain base (PR5 `6c2106e`) | repo + use case + tests; delete dead `ResumenDiaDTO.ts` |
| 7 | Tira de reconciliación + renombres (PR6b) | PR 6b | PR 6a branch | pure builder + page + responsive CSS + tests |

## Phase 1: Backend role policy (PR1)

Owner decision (supersedes earlier field-omission on `pyl`):
- Reportes completo = DUEÑA, ADMINISTRADOR, CONTADOR, SUPERADMIN.
- `GET /finanzas/pyl` y `GET /finanzas/exportar` → `requireRole(PRIVILEGED)` (403 al resto). Sin stripping de columnas.
- `GET /finanzas/resumen` → sigue accesible; para no privilegiados omite `totalCostoBaseInsumos` **y** `balanceNeto` (derivable).
- UNA sola fuente de roles privilegiados reutilizada por las tres compuertas.

- [x] 1.1 RED: `privilegedRoles.test.ts` (true 4 roles, false others/null); `ReporteController.test.ts` absence assertions for resumen; `finanzas.reportes-role.test.ts` (supertest 403/200); guard assertions en `finanzas.routes.test.ts`.
- [x] 1.2 Create `apps/api/src/presentation/middleware/privilegedRoles.ts` with `PRIVILEGED_ROLES_LIST`, `PRIVILEGED_ROLES` (derivado) y `isPrivilegedRole(rol)`.
- [x] 1.3 Replace duplicated sets in `RegistroController.ts:11` / `ReporteController.ts:16` with imports; use `isPrivilegedRole(req.user?.rol)`.
- [x] 1.4 `ReporteController.resumenDia`: omit `totalCostoBaseInsumos` + `balanceNeto` for non-privileged (clave ausente).
- [x] 1.5 `finanzas.routes.ts`: guard `/finanzas/pyl` con `requireRole(...PRIVILEGED_ROLES_LIST)` (403 al resto). Sin omisión de campos.
- [x] 1.6 `finanzas.routes.ts`: guard `/finanzas/exportar` con `requireRole(...PRIVILEGED_ROLES_LIST)`; tests de ruta actualizados.
- [x] 1.7 `ResumenDiaUseCase.test.ts`: reconciliación 555000−267600−84000=203400 (fixture lucía), ANULADO=0, sin registros=0.
- [x] 1.8 Artifact sync: delta specs `finanzas-reportes` (resumen omite 2 claves; pyl/exportar 403; nuevo requirement exportar), `design.md`, `tasks.md`, `proposal.md`.
- [x] 1.9 GREEN: `cd apps/api && npx vitest run` + `npx tsc --noEmit`.

## Phase 2: Frontend role gating (PR2)

- [x] 2.1 RED: extend `roles.test.ts`; add FinanzasPage card/export gate tests; update `FinanzasPage.test.tsx:475` to assert button absent.
- [x] 2.2 Extend `utils/roles.ts` with `PRIVILEGED_ROLES` + `isPrivilegedRole(user)`; `ROLES_CUENTAS` references it.
- [x] 2.3 `FinanzasPage.tsx`: optional HTTP types (`FinanzasResumen:30`, `PyLData:183-191`).
- [x] 2.4 Replace inline `isPrivileged` (`:642-646`, `:4153-4158`) with helper.
- [x] 2.5 Registros: render `🧴 Total insumos` only when privileged, value `resumen.totalCostoBaseInsumos ?? 0`.
- [x] 2.6 Reportes: hide the whole tab for non-privileged (owner decision: Reportes = privileged); hide `📥 Exportar Excel`.
- [x] 2.7 GREEN: `cd apps/pos-dashboard && npx vitest run` (384 passed / 2 fallas pre-existentes) + `tsc --noEmit` (0 errores).

Commit: 907df06 (feat frontend).

## Phase 3: Nómina informational insumo (PR3) — DONE

- [x] 3.1 RED: `NominaPendienteUseCase.test.ts` — 84000 (fixture lucía), ANULADO/sin items=0, scoping por `delPeriodo`, fuera de período 50000 excluido, `totalAPagar` unchanged.
- [x] 3.2 Add optional `totalCostoBaseInsumos?: number` to `NominaPendienteEmpleada` and `NominaPendienteDTO`.
- [x] 3.3 `NominaPendienteUseCase`: reduce same `delPeriodo`, `Math.round`, push; `totalAPagar` untouched.
- [x] 3.4 `FinanzasPage.tsx`: optional `NominaEmpleado` type; employee card `Insumos (ya descontados de la comisión)` when present; summary card `🧴 Total insumos` over `pendientesFiltrados`; ambas solo para roles privilegiados (`isPrivilegedRole`).
- [x] 3.5 RED/GREEN component tests: label present with value (DUEÑA), absent for MANICURISTA, absent when field missing.
- [x] 3.6 GREEN: api (611 passed / 5 pre-existentes) + dashboard (387 passed / 2 pre-existentes) `npx vitest run` + both `tsc --noEmit` (api: 1 pre-existente seed.ts; dashboard: 0).

## Phase 4: Spec sync + archive note

- [x] 4.1 Update `specs/finanzas-reportes/spec.md`: `resumen` omite `totalCostoBaseInsumos`+`balanceNeto`; `pyl`/`exportar` 403; nuevo requirement de exportación. (Done in PR1.)
- [x] 4.2 Confirm rollback code-only (no migration) and proposal success criteria.

## Phase 5: Fix B-1 — nómina insumo siempre 0 (PR4) — DONE

`sdd-verify` bloqueó el deploy: `NominaPendienteUseCase` suma `serviciosItems[].costoBaseInsumos`
sobre los registros que devuelve `findBySalon`, pero esa consulta no cargaba la relación →
`totalCostoBaseInsumos` era siempre 0 en runtime. Los tests de PR3 lo enmascaraban inyectando
`serviciosItems` en el mock del repositorio.

- [x] 5.1 Listar consumidores de `IRegistroServicioRepository.findBySalon`: **único** consumidor `NominaPendienteUseCase` (`ResumenDiaUseCase` usa `findBySalonAndDateRange`, que ya carga `serviciosItems`). Opción (a) — agregar la relación — es segura y la menos invasiva.
- [x] 5.2 RED: test de borde de repositorio que asserta que `findBySalon` pasa `relations` incluyendo `serviciosItems` (`TypeORMRegistroServicioRepository.test.ts`).
- [x] 5.3 GREEN: agregar `'serviciosItems'` a las `relations` de `findBySalon` (sin migración, una sola línea + comentario).
- [x] 5.4 TRIANGULATE: segundo caso (salonId distinto) que fija `where: { salonId }` + `order: { creadoEn: 'DESC' }`.
- [x] 5.5 Prueba runtime: `docker restart posfinal-api`; `GET /api/salones/1/finanzas/nomina` (DUEÑA) → lucía período `2026-09-01→09-16`: `totalCostoBaseInsumos = 84000` (antes `0`), `totalAPagar = 297600` sin cambios.
- [x] 5.6 GREEN: `cd apps/api && npx vitest run` (613 passed / 5 fallas baseline en `NominaPendienteUseCase.test.ts`) + `npx tsc --noEmit` (exit 2, 1 error baseline `seed.ts`).

## Phase 6: Fix paginación de Registros (PR5) — DONE

Bug reportado por el owner (verificado con data real): en el período 2026-09-04..2026-09-29
(salón 1) hay **26** registros (15 activos + 11 anulados), pero la pestaña Registros mostraba
"26 registros" en la paginación y ~15 filas: el backend (`search`/`count`) no filtraba por
`estado`/`tipo` y el frontend filtraba client-side sobre una página paginada en servidor.

- [x] 6.1 RED backend: `TypeORMRegistroServicioRepository.test.ts` — `count` ACTIVOS excluye ANULADO, ANULADOS solo ANULADO, TODOS/ausente sin cláusula, `tipo` SERVICIOS/PRODUCTOS; **`search` y `count` aplican criterios idénticos**.
- [x] 6.2 RED backend: `ListRegistrosUseCase.test.ts` (nuevo) — reenvía `estado`/`tipo` a `search` Y `count`; sin params usa `TODOS`; `meta.total` = count del filtro (independiente del recorte de página).
- [x] 6.3 RED backend: `RegistroController.test.ts` — parsea `estado`/`tipo` válidos; inválidos/ausentes ⇒ `TODOS`.
- [x] 6.4 Domain: `IRegistroServicioRepository` — tipos `EstadoRegistroFilter`/`TipoRegistroFilter` y params `estado`/`tipo` en `search` y `count`.
- [x] 6.5 Repo: método privado único `aplicarFiltrosRegistro` usado por `search` y `count` (imposible divergir). Default (`TODOS`/ausente) = sin cláusula.
- [x] 6.6 Use case: `ListRegistrosInput.estado/tipo`, default `TODOS`, mismos valores a `search` y `count`.
- [x] 6.7 Controller: zod inline `REGISTRO_FILTERS_SCHEMA` (`.catch('TODOS')`), defaults y reenvío.
- [x] 6.8 RED/GREEN frontend: `FinanzasPage.test.tsx` (nuevo describe) — envía `estado`/`tipo`; total = `meta.total` del filtro (15/11/26); cambiar Activos→Anulados→Todos re-consulta; NO filtra client-side (renderiza la ANULADA si el server la manda).
- [x] 6.9 Frontend: `regParams.estado/tipo`; eliminado el `useMemo` `filteredRegistros` (se usa `registros`); `registroEstadoFilter` agregado a deps de `fetchData`; el botón de tipo resetea a página 1.
- [x] 6.10 Artifact sync: delta `finanzas-registros` (requirement de paginación server-side + escenarios), `design.md` (D6) y esta Phase 6.
- [x] 6.11 GREEN: `cd apps/api && npx vitest run` (623 passed / 5 baseline) + `npx tsc --noEmit` (1 baseline `seed.ts`); `cd apps/pos-dashboard && npx vitest run` (391 passed / 2 baseline) + `npx tsc --noEmit` (0).
- [x] 6.12 Prueba runtime (API :3001, DB local = prod): `GET /salones/1/registros` período 2026-09-04..09-29 → ACTIVOS `meta.total=15`/15 filas, ANULADOS `11`/11, TODOS `26`/26, SERVICIOS `25`, PRODUCTOS `1`; sin params `26` (compat). `meta.total == filas` en todos.

## Phase 7: PR6 first pass — aclaración Ingresos/Cobrado (SUPERSEDED — ver Phase 8)

> Superseded by the owner-approved UX revision (Phase 8). Phase 7 shipped in commit `b4967a9`; its
> `utils/aclaracionCobrado.ts` (+ test) and the conditional line are removed in Phase 8. Kept for history.

Scope: `apps/pos-dashboard/src/pages/FinanzasPage.tsx` summary de Registros + `__tests__/FinanzasPage.test.tsx`.
Spec delta already in `specs/finanzas-registros/spec.md` (2 requirements). No new primitives, cards, metrics, rows or API fields.

- [x] 7.1 RED (afijo ⓘ): en `FinanzasPage.test.tsx` nuevo `describe('... PR6')` — las cards Ingresos y Cobrado exponen un botón enfocable (`getByRole('button', { name })`) con nombre accesible; al `focus`/hover el Tooltip expone la descripción: Ingresos = devengado, sin propinas; Cobrado = efectivo recibido, con propinas y abonos.
- [x] 7.2 RED (línea condicional): `totalIngresos=935000, totalCobrado=940000, totalPropinas=5000` → UNA línea (`role="note"`, testid `aclaracion-cobrado`) que menciona `$5.000` de propinas; `totalCobrado===totalIngresos` → NO existe la línea en el DOM; `totalPropinas=0` y gap≠0 → línea sin cláusula de propinas.
- [x] 7.3 RED (residual no fabricado): `totalIngresos=935000, totalCobrado=955000, totalPropinas=5000` → línea menciona `$5.000` de propinas y describe el residual genéricamente (abonos/fiado); `fmt(15000)` NO está en el DOM.
- [x] 7.4 RED (sin tarjetas nuevas): `queryByText('🎁 Propinas')` ausente; el nodo de la línea NO es descendiente de `[class*="summaryCard"]`; la grilla de tarjetas no cambia; Ingresos/Cobrado + aclaración siguen visibles para rol no privilegiado.
- [x] 7.5 TRIANGULATE: gap negativo (`totalCobrado<totalIngresos`) → cláusula genérica "aún no cobró (fiado)" sin montos fabricados; `gap===tips` con `tips=0` → sin línea; `resumen` ausente → sin línea.
- [x] 7.6 GREEN (afijo): en `FinanzasPage.tsx` envolver un botón `ⓘ` enfocable en cada card con el `Tooltip` MUI ya usado en `LuxeLayout.tsx` (`describeChild`, `aria-label`); sin nuevas cards ni dependencias (ver D7).
- [x] 7.7 GREEN (línea): helper único que computa `gap`/`tips` con `Math.round` (valores enteros del API) y devuelve el texto según la tabla D7; renderizar una sola línea `role="note"` bajo `summaryGrid`, o `null` si `gap===0`/`resumen==null`. No altera ningún total.
- [x] 7.8 GREEN: `cd apps/pos-dashboard && npx vitest run` (objetivo: 391 previos + tests PR6, ≤2 fallas baseline) y `npx tsc --noEmit` (0 errores).
- [x] 7.9 Artifact sync: confirmar delta PR6 en `specs/finanzas-registros/spec.md`, addendum D7 en `design.md`, esta Phase 7 y Engram `sdd/insumos-en-resumen-reportes-nomina/tasks`.

## Phase 8: PR6 revisión — tira de reconciliación + `cobrosDeudaAnterior`

Supersedes Phase 7 (`b4967a9`). Two work units: **PR6a backend field**, **PR6b frontend UX**.
Specs already revised: `finanzas-registros` ("Nombres y aclaración accesible…" + "Tira de reconciliación…"),
`finanzas-reportes` ("Cobros de deuda anterior en el resumen"). PR6b base = PR6a branch; PR6a base = chain base.

### Work unit PR6a — backend `cobrosDeudaAnterior`

- [x] 8.1 RED repo: `TypeORMRegistroServicioRepository.test.ts` nuevo `describe('sumCobrosDeudaAnterior')` — Σ pagos con `FECHA_NEGOCIO_PAGO_SQL` en `[inicio, fin)` Y registro (`DATE_FORMAT(COALESCE(r.fechaHora,r.creadoEn),'%Y-%m-%d')`) `< fechaInicioStr`; ANULADO excluido; respeta `usuarioId`/`clienteId`; `SUM NULL` → 0.
- [x] 8.2 GREEN domain+repo: agregar `sumCobrosDeudaAnterior(salonId, inicio, fin, usuarioId?, clienteId?)` a `IRegistroServicioRepository` e implementarlo en `TypeORMRegistroServicioRepository`, reusando `FECHA_NEGOCIO_PAGO_SQL` + `fechaColombiaStr`.
- [x] 8.3 RED use case: `ResumenDiaUseCase.test.ts` — el mock agrega `sumCobrosDeudaAnterior`; asserta que el `Promise.all` lo llama, que `output.cobrosDeudaAnterior` refleja el valor y que es 0 sin deuda; identidad `Cobrado = Ventas − Fiado + CobrosDeudaAnterior + Propinas`.
- [x] 8.4 GREEN use case: agregarlo al `Promise.all`, a `ResumenDiaOutput` (`cobrosDeudaAnterior: number`) y al `return`.
- [x] 8.5 RED controller: `ReporteController.test.ts` — la respuesta NO privilegiada incluye `cobrosDeudaAnterior` (sobrevive al destructuring de omisión) y sigue omitiendo insumos+balanceNeto; la privilegiada lo incluye.
- [x] 8.6 GREEN controller + dead code: el passthrough `res.json(result)` ya expone el campo a todos los roles (sin cambios de omisión). Eliminar `apps/api/src/modules/finanzas/application/dtos/ResumenDiaDTO.ts` (dead code: nunca importado — contrato vivo es `ResumenDiaOutput`; ver `exploration.md:237`).
- [x] 8.7 TRIANGULATE backend: multi-pago en varios registros; un pago del período sobre un registro del período NO suma; período sin deuda → 0.
- [x] 8.8 GREEN: `cd apps/api && npx vitest run` (+ `npx tsc --noEmit`, baseline 1 error `seed.ts`).

### Work unit PR6b — frontend renombres + tira

- [x] 8.9 RED builder: nuevo `apps/pos-dashboard/src/utils/tiraReconciliacion.test.ts` — filas en orden; componentes con valor 0 ocultos; filas de cierre siempre; `TU CAJA REAL = totalCobrado − totalPropinas`; redondeo a enteros; input vacío → cierres en $0.
- [x] 8.10 GREEN builder + delete: crear `utils/tiraReconciliacion.ts` (`buildTiraReconciliacion(input): TiraRow[]`, unión discriminada component/divider/closing); ELIMINAR `utils/aclaracionCobrado.ts` y `aclaracionCobrado.test.ts` (superseded — sin código ni tests muertos).
- [x] 8.11 RED page: actualizar el `describe` PR6 de `FinanzasPage.test.tsx` — "Ventas del día"/"Entró a caja" presentes y `TOTAL INGRESOS`/`Cobrado` (etiqueta exacta) ausentes; ⓘ re-formulado y enfocable; tira SIEMPRE presente (aunque `Cobrado===Ingresos`); filas 0 ocultas / cierres visibles; `TU CAJA REAL` = Cobrado−Propinas; NO tarjetas nuevas (7); visible para rol no privilegiado.
- [x] 8.12 GREEN page: `FinanzasPage.tsx` — renombrar labels y reescribir títulos/`aria-label` del ⓘ; reemplazar `buildAclaracionCobrado` por el render de la tira (fuera de `summaryGrid`, texto explicativo); agregar `cobrosDeudaAnterior?: number` a `FinanzasResumen`; sin tarjetas nuevas.
- [x] 8.13 GREEN responsive: `FinanzasPage.module.css` — `.tiraReconciliacion` + filas flex con `flex-wrap`, `min-width: 0`, `overflow-wrap: anywhere`; `@media (max-width: 480px)` apila label/valor sin scroll horizontal; borrar `.aclaracionCobrado`.
- [x] 8.14 RED/GREEN responsive: component test de estructura (orden de filas + clases del wrapper); nota justificada de verificación manual mobile (jsdom no aplica layout/CSS).
- [x] 8.15 Actualizar los demás tests que referencian `💰 TOTAL INGRESOS` (`FinanzasPage.test.tsx:370`, `:2225`) y los testids viejos.
- [x] 8.16 TRIANGULATE frontend: `resumen` ausente/undefined → tira con cierres en $0; caso con todos los componentes en 0; no forzar `TU CAJA REAL` a positivo.
- [x] 8.17 GREEN: `cd apps/pos-dashboard && npx vitest run` (+ `npx tsc --noEmit`, baseline 0).
- [x] 8.18 Artifact sync: `design.md` D7 (NUEVA UX + campo backend), esta Phase 8, Engram `sdd/insumos-en-resumen-reportes-nomina/tasks`.

