# Archive Report — cerrar-caja-por-id

**Change**: cerrar-caja-por-id
**Archived**: 2026-08-21
**Archive location**: `openspec/changes/archive/2026-08-21-cerrar-caja-por-id/`
**Artifact store mode**: openspec (hybrid — archive report persisted to Engram `sdd/cerrar-caja-por-id/archive-report`)
**Verify verdict**: PASS WITH WARNINGS (READY TO ARCHIVE) — 13/13 spec scenarios, 0 CRITICAL, 2 WARNING, 2 SUGGESTION
**Delivery**: Merged to main (b7e2216)

## Intent

2 cajas ABIERTA huérfanas no se podían cerrar (`CerrarCajaUseCase` solo cerraba la de HOY) y `AbrirCajaUseCase` solo bloqueaba si había una abierta HOY — permitía abrir una nueva caja con una vieja sin cerrar. El cambio permite cerrar CUALQUIER caja ABIERTA por `cajaId` y bloquea la apertura si existe CUALQUIER caja abierta (incluidas huérfanas).

## What Changed

| Área | Cambio |
|------|--------|
| `ICajaRepository.findAbiertaBySalon` | Nuevo método: busca cualquier caja ABIERTA del salón (cualquier fecha) + impl TypeORM (`findOne({ salonId, estado: 'ABIERTA' })`) |
| `AbrirCajaUseCase` | Any-open block: `findAbiertaBySalon` ANTES del chequeo de día → 409 `CAJA_YA_ABIERTA` con mensaje "Ya existe una caja abierta — cerrá la caja pendiente antes de abrir una nueva"; conserva la regla de día (409 `CAJA_YA_CERRADA`) y el backstop `ER_DUP_ENTRY` |
| `CerrarCajaUseCase` | `cajaId` opcional en el input: con id → `findById` → verifica `salonId` (404 `CAJA_NO_ENCONTRADA`) → exige ABIERTA (409 `CAJA_YA_CERRADA`) → arqueo + UPDATE condicional; sin id → fallback caja de hoy (comportamiento existente) |
| `packages/validation` `cerrarCajaSchema` | `cajaId: z.number().int().positive().optional()` + rebuild (`npx tsc`) + restart API; controller pasa `cajaId` de body y query con spread condicional |
| `CajaTab.tsx` | Botón "Cerrar" en filas ABIERTA del historial (junto a "Ver") + en el aviso de pendientes; modal pre-apuntado (`cerrarModalPorId` → prefill `GET /caja/:id/cierre` → POST `{cajaId, montoRealEfectivo}`); gate "Abrir" oculto con cualquier abierta + mensaje "No se puede abrir: hay una caja abierta pendiente de cierre" |
| `CajaBanner.tsx` | Camino 404 de `/caja/actual` → fetch `estado=ABIERTA&limit=0`; con abiertas → "Ver caja" en vez de "Abrir" |

Mirror n8n: sin cambios (comparte handler → mismo contrato).

## Specs Synced (delta → main)

| Domain | Action | Details |
|--------|--------|---------|
| finanzas-caja | Updated (ADDED 5) | `POST Cerrar Caja por ID`, `Arqueo al Cerrar por ID`, `Bloqueo de Apertura con Cualquier Caja Abierta`, `Botón Cerrar en el Historial`, `Apertura Bloqueada en la UI` (13 escenarios). 12 existing requirements preserved verbatim. |

Final requirement count: finanzas-caja 17. No duplicate headings.

## Merge Decisions

- **Heading normalized**: `## ADDED Requirements` → `## Requirements` in `openspec/specs/finanzas-caja/spec.md` (source-of-truth convention, matches finanzas-liquidacion/finanzas-cuentas main specs; the previous archive for this domain had not normalized it yet).
- **Delta annotation dropped**: The delta's `# Delta for finanzas-caja` header and `## ADDED Requirements` wrapper were omitted from the main spec (change metadata; full delta retained in archive).
- **Related (not duplicate) requirements flagged**: `Alerta Caja Pendiente de Cierre` (pre-existing) and `Apertura Bloqueada en la UI` (added) share the orphan-detection semantics — the new requirement covers the UI gate (hide "Abrir"/"Ver caja"), which the alert alone did not specify. Both retained.

## Verification Summary

- **Spec scenarios**: 13/13 PASS (5 requirements: cerrar por id 3/3, arqueo por id 2/2, bloqueo apertura 3/3, botón Cerrar 2/2, UI gate 2/2)
- **Tests**: API 419 PASS (65 files, 14.13s) + Dashboard 268 PASS (1 pre-existing flake AgendaPage.test.tsx, reproduced on parent commit — file untouched by this change)
- **Coverage**: caja use-cases 99.61% stmts / 91.76% branch; CajaBanner 99.01%; CajaTab ~97.85%
- **Type check**: tsc dashboard 0 errors; tsc API 3 PRE-EXISTING errors (zero-diff files)
- **TDD**: strict TDD, 6 test files, RED→GREEN evidence in apply-progress; 15/15 tasks (4.5 smoke delegado a E2E)

## Rollback

`git revert b7e2216` (commit that merged the change to main). Reverts repo + use cases + controller + schema + CajaTab/CajaBanner + tests. No migrations, no data changes — clean revert.

## Residual Risks

- **Reabrir edge con huérfana**: `POST /caja/reabrir` de hoy con una huérfana ABIERTA puede producir 2 cajas ABIERTA (edge documentado en design Open Questions; CajaTab.test.tsx:741 fija el comportamiento actual). El negocio debe cerrar primero las huérfanas.
- **AgendaPage flake (pre-existing)**: Dashboard test "crear cliente desde el modal" falla 1/269 — reproducido en el commit padre 5c90842; no relacionado con este cambio pero degrada la señal de CI.
- **CajaBanner 404-path**: 3 fetches encadenados sin cache (actual → abiertas → historial) — acceptable hoy, candidato a optimización futura.

## Archive Contents

- proposal.md ✅
- specs/finanzas-caja/spec.md ✅
- design.md ✅
- tasks.md ✅ (15/15 tasks complete; 4.5 smoke delegado a E2E)
- verify-report.md ✅ (PASS WITH WARNINGS)
- archive-report.md ✅ (this file)

## Source of Truth Updated

- `openspec/specs/finanzas-caja/spec.md` (12 → 17 requirements)

## SDD Cycle Complete

Change fully planned, implemented, verified (PASS WITH WARNINGS, non-blocking), merged to main (b7e2216), and archived.
