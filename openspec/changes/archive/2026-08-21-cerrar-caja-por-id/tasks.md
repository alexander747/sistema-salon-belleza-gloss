# Tasks: Cerrar Caja por ID

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~400–480 (código + tests) |
| 400-line budget risk | Low (budget de sesión: 800) |
| Chained PRs recommended | No |
| Suggested split | single PR |
| Delivery strategy | auto-forecast |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Backend: repo + use cases + controller + schema + tests | PR 1 | base main; tests incluidos |
| 2 | Frontend: CajaTab + CajaBanner + tests | PR 1 | mismo PR (diff < 800) |

## Phase 1: Backend — foundation (TDD)

- [x] 1.1 RED: `caja.schema.test.ts` — acepta `cajaId` opcional, rechaza no positivo
- [x] 1.2 GREEN: `caja.schema.ts` — `cajaId: z.number().int().positive().optional()`; **rebuild** `cd packages/validation && npx tsc`
- [x] 1.3 GREEN: `ICajaRepository.ts` + `TypeORMCajaRepository.ts` — `findAbiertaBySalon(salonId)` (cualquier fecha)

## Phase 2: Backend — use cases y controller (TDD)

- [x] 2.1 RED: `AbrirCajaUseCase.test.ts` — mock `findAbiertaBySalon`; huérfana → `CajaYaAbiertaError` mensaje nuevo; abierta de hoy → 409; sin abiertas → OK; backstop intacto
- [x] 2.2 GREEN: `AbrirCajaUseCase.ts` — `findAbiertaBySalon` primero; conserva día + backstop
- [x] 2.3 RED: `CerrarCajaUseCase.test.ts` — mock `findById`; por id (cerrar con ese id, reporte); otro salón/inexistente → 404; CERRADA → 409; fallback hoy; race
- [x] 2.4 GREEN: `CerrarCajaUseCase.ts` — input `cajaId?`: by-id (findById → salonId → ABIERTA) vs fallback hoy; arqueo + `cerrar()` compartidos
- [x] 2.5 RED: `CajaController.test.ts` — `cajaId` en body y query; tests previos verdes
- [x] 2.6 GREEN: `CajaController.ts` — `cajaId` body/query + spread condicional

## Phase 3: Frontend — CajaTab y CajaBanner (TDD)

- [x] 3.1 RED: `CajaTab.test.tsx` — fila ABIERTA con "Cerrar" (CERRADA no); click → GET `/caja/:id/cierre` prefill + POST `{cajaId, montoRealEfectivo}`; Abrir oculto con huérfana + mensaje; aviso con "Cerrar"
- [x] 3.2 GREEN: `CajaTab.tsx` — `cerrarCajaId`; `cerrarModalPorId(c)`; `handleCerrar` con spread `cajaId`; "Cerrar" en filas ABIERTA + aviso; gating `abiertas.length > 0`
- [x] 3.3 RED: `CajaBanner.test.tsx` — con huérfana → "Ver caja" (no "Abrir"); hoy CERRADA → "Reabrir"; ajustar mocks encadenados
- [x] 3.4 GREEN: `CajaBanner.tsx` — camino 404 de `/caja/actual` → fetch `estado=ABIERTA&limit=0`; con abiertas → pendientes + "Ver caja"

## Phase 4: Verification

- [x] 4.1 Rebuild `packages/validation` + restart API
- [x] 4.2 `cd apps/api && npx vitest run` + `npx tsc --noEmit` (sin errores nuevos)
- [x] 4.3 `cd apps/pos-dashboard && npx vitest run`
- [x] 4.4 Cobertura API ≥80%
- [ ] 4.5 Smoke: cerrar huérfana por id → CERRADA; abrir → 409 mensaje nuevo; mirror n8n `{cajaId}`; CajaTab sin Abrir

## Phase 5: Cleanup / Docs

- [x] 5.1 Revisar comentarios desactualizados ("solo hoy")
- [x] 5.2 Commits por unidad de trabajo (backend, luego frontend) con Conventional Commits

Notas: sin migraciones. Rebuild de `packages/validation` obligatorio (sin él `validate()` strippea `cajaId`). Mirror n8n intacto (mismo handler). 4.5 (smoke) queda para el verify/E2E del orquestador (no se levantan servicios en apply).
