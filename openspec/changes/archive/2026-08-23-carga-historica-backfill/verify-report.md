# SDD Verify Report — carga-historica-backfill (3 PRs, HEAD e46868b)

**Verdict**: PASS WITH WARNINGS → READY TO ARCHIVE (sin blockers).

## Resultados ejecución

- API: `npx vitest run` → 450/450 pass (65 files) ✅
- Dashboard: 283/284 — único fail = flake PRE-EXISTENTE AgendaPage "crear cliente desde el modal" (pasa 22/22 en aislamiento; idéntico al reportado en PR2/PR3) ✅
- API `tsc --noEmit`: 3 errores, TODOS pre-existentes (seed.ts:238, CreateRegistroUseCase.test.ts:94 [era 93, corrió 1 línea por import nuevo], RegistroServicioItemDTO.test.ts:3) — verificado contra base 3c6b655 (diffs vacíos en seed.ts y DTO test; validInput no tocado) ✅
- Dashboard `tsc --noEmit`: 0 errores ✅
- `packages/validation/dist` reconstruido (fechaHora/fechaCaja presentes en .js y .d.ts) ✅

## Matriz de escenarios spec (14/14 PASS)

1. POST /registros fechaHora opcional default ahora — CreateRegistroUseCase.ts:50, finanzas.schema.ts:32 + tests
2. fechaHora pasada → caja de ESA fecha — CreateRegistroUseCase.ts:51-52 + test L670
3. Sin caja de esa fecha → 409 CAJA_NO_ABIERTA_EN_FECHA sin registro — verificarCajaAbierta.ts:27, errors.ts:90 + test L683
4. Hoy (explícito o ausente) mantiene 422 CAJA_CERRADA — verificarCajaAbierta.ts:24 + tests
5. Reportes COALESCE(fechaHora, creadoEn) — repo search/count/findBySalonAndDateRange (L69-70,97-100), findConDeudaBySalon L53, DetalleCierre L78, Cuentas L68/72; PyL/Resumen vía repo (mock en unit, COALESCE verificado por smoke E2E P&L 18/08 = 150.000)
6. Nómina: período por fechaHora + guard anti-doble-pago en creadoEn — NominaPendienteUseCase.ts:141/169 + tests L307/L341
7. CreateGasto honra fecha + caja de esa fecha — CreateGastoUseCase.ts:33-34 + tests
8. AbrirCaja fechaCaja opcional default hoy — AbrirCajaUseCase.ts:24, caja.schema.ts:8, CajaController.ts:33 + tests
9. Any-open intacta (fecha pasada bloquea) — AbrirCajaUseCase.ts:28-33 + test L107
10. Cerrar SIN fecha — cerrarCajaSchema sin date, CajaController.cerrar, CajaTab (1 solo type="date", modal abrir) + tests
11. AgendaPage sin min + default hoy — AgendaPage.tsx:250/499/1673 + tests L615-648
12. Completar/CambiarEstado fechaHora = input ?? cita.fechaHora — CompletarCitaUseCase.ts:44/86, CambiarEstadoCitaUseCase.ts:40-44 + tests
13. WalkInModal/VentasPage fecha default hoy + fechaHora mediodía local — WalkInModal.tsx:189/458, VentasPage.tsx:156/347/956 + tests
14. FinanzasPage muestra fechaHora ?? creadoEn — FinanzasPage.tsx:1121/1125/1301/2471/3549 + tests

## TDD Compliance

- Evidence table presente en apply-progress (PR3 detallado: 4 tareas RED/GREEN/TRIANGULATE con safety nets). PR1/PR2 marcados como batch previo sin tabla por tarea — mitigado por verificación independiente: TODOS los archivos de test PR1/PR2 existen y pasan.
- Assertion quality: sin tautologías/ghost loops/type-only (scan limpio).

## WARNINGS

1. **ResumenDia gastos fuera de su día** (pre-existente, no bloqueante): design.md AD7 afirma que ResumenDia compara "a medianoche UTC", pero ResumenDiaUseCase pasa límites 05:00 UTC a sumBySalonAndDateRange y MySQL compara DATE X como X 00:00 UTC → `DATE >= 05:00` = FALSE (verificado empíricamente en MySQL). Consecuencia: gastos (actuales Y backfilleados) NO aparecen en el resumen de su día; caen en el del día anterior. PRE-EXISTENTE (base 3c6b655 tiene los mismos límites y almacenamiento DATE). P&L correcto (límites 00:00 UTC cerrados). El comentario del fix de gasto sobre-afirma consistencia.
2. **apply-progress PR1/PR2 sin tabla TDD por tarea** (proceso): solo PR3 tiene tabla detallada; PR1/PR2 "batch previo". Verificado independientemente — no bloquea.

## SUGGESTIONS

1. CreateRegistroUseCase.ts:186-190: `ultimaVisita: new Date()` — para registros backfilleados estampa NOW en vez de la fecha de negocio. Fuera de spec, leak semántico menor.
2. CreateGastoUseCase.ts:44: gasto backfilleado sin caja de esa fecha → cajaId=null silencioso (no chokepoint, consistente con legacy; no aparece en ningún arqueo). Considerar aviso cuando fecha ≠ hoy y no hay caja.

## Files clave

- apps/api/src/modules/finanzas/application/services/verificarCajaAbierta.ts
- apps/api/src/modules/finanzas/application/use-cases/registro/CreateRegistroUseCase.ts
- apps/api/src/modules/finanzas/infrastructure/persistence/TypeORMRegistroServicioRepository.ts
- apps/api/src/modules/finanzas/application/use-cases/gasto/CreateGastoUseCase.ts
- apps/api/src/modules/finanzas/application/use-cases/caja/AbrirCajaUseCase.ts
- apps/api/src/modules/agenda/application/use-cases/cita/CompletarCitaUseCase.ts
