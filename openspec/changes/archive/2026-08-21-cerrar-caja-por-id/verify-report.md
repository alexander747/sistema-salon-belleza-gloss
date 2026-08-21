# SDD Verify Report — cerrar-caja-por-id

**Verdict**: PASS WITH WARNINGS (READY TO ARCHIVE). Strict TDD active. 13/13 spec scenarios PASS with covering tests. 0 CRITICAL, 2 WARNING, 2 SUGGESTION.

## Spec compliance (5 reqs / 13 scenarios — all PASS)
- Req1 POST /caja/cerrar por id (3/3): CerrarCajaUseCase.test.ts:147 (huérfana id=9 → cerrar(9)), :176/:186 (404 CAJA_NO_ENCONTRADA inexistente/otro salón), :195 (409 CAJA_YA_CERRADA).
- Req2 Arqueo por id (2/2): :147-173 (esperado 210000, diferencia 0, CERRADA), :204 (race → 409).
- Req3 Bloqueo apertura (3/3): AbrirCajaUseCase.test.ts:78 (huérfana → mensaje nuevo exacto), :93 (hoy abierta), :39 (sin abiertas → 201).
- Req4 Botón Cerrar historial (2/2): CajaTab.test.tsx:886 (Cerrar → prefill GET /caja/5/cierre → POST {cajaId:5}), :852 (CERRADA solo Ver).
- Req5 UI gate Abrir (2/2): CajaTab.test.tsx:965 (sin Abrir + mensaje), CajaBanner.test.tsx:178 ("Ver caja" + count).

## Test results
- API: 65 files / 419 tests PASS (14.13s). Dashboard: 269 tests (268 PASS + 1 PRE-EXISTING flake AgendaPage.test.tsx "expected 4 to be greater than 4" — REPRODUCED on parent commit 5c90842 in git worktree (262 pass + same 1 fail); file untouched by this change; passes in isolation 20/20).
- tsc API: 3 errors PRE-EXISTING (seed.ts:238, CreateRegistroUseCase.test.ts:93, RegistroServicioItemDTO.test.ts:3) — files with zero diff in this change. tsc dashboard: 0 errors.
- Coverage: caja use-cases 99.61% stmts/91.76% branch (task 4.4 ✓); CajaBanner 99.01%, CajaTab ~97.85% stmts.

## TDD Compliance
Evidence table present in apply-progress. 6 test files exist + pass on execution. Triangulation adequate (Cerrar 10 casos, Abrir 6, CajaTab 4 nuevos, CajaBanner 2). Assertion quality audit: no tautologies, no ghost loops, real value assertions (montoEsperado/diferencia/statusCode/code). 15/15 tasks (4.5 smoke delegado a E2E).

## Issues
- WARNING: Dashboard flake AgendaPage.test.tsx (crear cliente desde el modal) — pre-existente, reproduzco en parent commit; no bloquea este cambio pero degrada la señal de CI.
- WARNING: Reabrir de hoy con huérfana ABIERTA puede producir 2 cajas ABIERTA (edge documentado en design Open Questions; CajaTab.test.tsx:741 lo fija como comportamiento actual).
- SUGGESTION: CajaBanner 404-path hace 3 fetches encadenados (actual → abiertas → historial) sin cache; acceptable hoy.
- SUGGESTION: apply deviation `abiertas.some(estado==='ABIERTA')` vs `length>0` — defensivo, mismo intención, documentado.

## Evidence files
CerrarCajaUseCase.ts:33-35,71-81; AbrirCajaUseCase.ts:26-31; ICajaRepository.ts:18; TypeORMCajaRepository.ts:25-27; CajaController.ts:43-51; caja.schema.ts:14; errors.ts:108-112; CajaTab.tsx:476,540-541,555,708,434-453,378; CajaBanner.tsx:92-103,196; n8n.routes.ts:20 (mismo handler).
