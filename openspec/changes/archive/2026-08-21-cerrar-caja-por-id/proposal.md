# Proposal: Cerrar Caja por ID

## Intent

2 cajas ABIERTA huérfanas no se pueden cerrar (`CerrarCajaUseCase` solo cierra la de HOY) y `AbrirCajaUseCase` solo bloquea si hay abierta HOY — permite abrir otra con una vieja abierta. Cambio: cerrar cualquier ABIERTA por `cajaId` y bloquear apertura si existe CUALQUIER abierta.

## Scope

**In:**
- `ICajaRepository.findAbiertaBySalon(salonId)` + impl TypeORM (índice existente)
- `AbrirCajaUseCase`: cualquier ABIERTA → 409 `CAJA_YA_ABIERTA`; conserva día + backstop `ER_DUP_ENTRY`
- `CerrarCajaUseCase`: `cajaId` opcional → cierra ESA caja (404 inexistente/otro salón; 409 no ABIERTA); sin id → hoy
- Controller: passthrough `cajaId` (body + query); mirror n8n sin cambios
- `cerrarCajaSchema` + `cajaId` → rebuild validation + restart API
- CajaTab: "Cerrar" por fila ABIERTA + aviso; modal pre-apuntado (prefill `GET /caja/:id/cierre`); "Abrir" oculto con cualquier abierta
- CajaBanner: "Ver caja" (no "Abrir") con huérfanas
- Tests backend + frontend

**Out:** `Reabrir` intacto; edge "reabrir con huérfana → 2 abiertas"; app mobile; migraciones.

## Capabilities

- **Modified** `finanzas-caja`: cerrar por id; bloqueo de apertura con cualquier abierta; UI historial/banner

## Approach

Backend-first (API-first): repo + 2 use cases + schema, luego CajaTab/CajaBanner. Prefill reutiliza `GET /caja/:id/cierre` (por-id, null-safe) → cero endpoints nuevos. Mirror n8n comparte handler.

## API Surface

- `POST /caja/cerrar`: body opcional `cajaId`. Con id → ESA caja; sin él → la de hoy. Envelope/errores idénticos.
- `POST /caja/abrir`: 409 `CAJA_YA_ABIERTA` con cualquier abierta, mensaje "Ya existe una caja abierta — cerrá la caja pendiente antes de abrir una nueva".

## Affected Areas

| Area | Impact |
|------|--------|
| `ICajaRepository.ts` + `TypeORMCajaRepository.ts` | Modified (+`findAbiertaBySalon`) |
| `AbrirCajaUseCase.ts` / `CerrarCajaUseCase.ts` | Modified |
| `CajaController.ts` | Modified |
| `packages/validation/src/caja.schema.ts` | Modified (+`cajaId`) |
| `CajaTab.tsx` + `CajaBanner.tsx` | Modified |
| 6 archivos de test (API + dashboard) | Modified |

## Risks

| Riesgo | Prob | Mitigación |
|--------|------|------------|
| Cerrar caja de otro salón vía id | Media | Verificación `salonId` → 404 |
| Rebuild validation olvidado → `cajaId` strippado | Media | Task explícita + test de schema |
| Tests rompen por `cajaId: undefined` | Baja | Spread condicional |

## Rollback

Revertir el diff (repo + use cases + controller + schema + CajaTab/CajaBanner + tests). Sin migración ni datos.

## Dependencies

Rebuild `packages/validation` (`npx tsc`) + restart API. Sin migraciones ni feature flags.

## Success Criteria

- [ ] `POST /caja/cerrar {cajaId}` cierra la huérfana; historial la muestra CERRADA
- [ ] `POST /caja/abrir` con huérfana → 409 `CAJA_YA_ABIERTA` con mensaje nuevo
- [ ] CajaTab: filas ABIERTA con "Cerrar" → modal por id → POST con `cajaId`; "Abrir" oculto
- [ ] vitest api + dashboard verdes; coverage ≥80%; tsc sin errores nuevos
