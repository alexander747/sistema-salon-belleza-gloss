# Design: Cerrar Caja por ID

## Technical Approach

Backend-first (API-first): `findAbiertaBySalon` en el repo, `AbrirCajaUseCase` chequea cualquier ABIERTA antes de la regla de día, `CerrarCajaUseCase` acepta `cajaId` opcional con el mismo arqueo y UPDATE condicional. El prefill reutiliza `GET /caja/:id/cierre` (por-id, null-safe) → cero endpoints nuevos. Mirror n8n comparte handler (solo verificar). Luego CajaTab/CajaBanner.

## Architecture Decisions

| # | Opción | Tradeoff | Decisión |
|---|--------|----------|----------|
| 1 | Prefill esperado: reusar `GET /caja/:id/cierre` vs nuevo endpoint vs `/actual/esperado` | Nuevo endpoint = más superficie; `/actual/esperado` es SOLO hoy; `/caja/:id/cierre` ya trae `reporte` por-id, null-safe | **Reusar `GET /caja/:id/cierre`**: `setEsperado(data.data.reporte)` — reporte ABIERTA con nulls que el modal ya maneja |
| 2 | Guard de apertura: `findAbiertaBySalon` nuevo vs listado paginado | Nuevo método = 1 query simple; listado acopla el guard a paginación | **`findAbiertaBySalon`** ANTES del chequeo de día; `findBySalonYFecha` conserva la regla de día (CERRADA hoy → 409) y el backstop `ER_DUP_ENTRY` (UNIQUE solo cubre mismo día) |
| 3 | `cajaId` en `CerrarCajaUseCase`: input opcional vs endpoint separado | Input opcional = mismo endpoint, fallback natural (n8n/mobile sin cambio) | **Input opcional**. Con id: `findById` → verificar `salonId` (404) → no ABIERTA → 409. Sin id: flujo actual (404 `CAJA_NO_ABIERTA`). Reporte + `cerrar()` condicional compartidos |
| 4 | Cómo llega `cajaId` al controller | `validate()` reemplaza `req.body` → `cajaId` fuera del schema se strippea | **Extender `cerrarCajaSchema`** con `cajaId: z.number().int().positive().optional()` + fallback query; controller con spread condicional `...(cajaId ? { cajaId } : {})` |
| 5 | Modal de cierre generalizado (CajaTab) | Hoy `cerrarModal()` prefill de hoy y `handleCerrar()` postea solo `montoRealEfectivo` | **Estado `cerrarCajaId`**: null = hoy; `cerrarModalPorId(c)` → id + prefill `GET /caja/${id}/cierre`; `handleCerrar` postea `{ montoRealEfectivo, ...(cerrarCajaId ? { cajaId } : {}) }` |
| 6 | Gating "Abrir" (CajaTab y CajaBanner) | `abiertas` (fetch `estado=ABIERTA&limit=0`) ya existe en CajaTab y cuenta TODAS las fechas | CajaTab: `hayAbierta = abiertas.length > 0`; rama cerrada con `hayAbierta && !hoyCerrada` → sin "Abrir" + mensaje. CajaBanner: en el camino 404 de `/caja/actual`, fetch `estado=ABIERTA&limit=0`; con abiertas → "Ver caja". `hoyCerrada` intacto (spec exige) |
| 7 | Botón "Cerrar" en el aviso de pendientes | El aviso ya lista la huérfana más reciente; el historial está paginado (12 filas) | Agregar "Cerrar" junto a "Ver" → `cerrarModalPorId(pendientes[0])`. Costo mínimo |

## Data Flow

    CajaTab — fila ABIERTA/aviso → "Cerrar" → cerrarModalPorId(c)
      ├─ GET /caja/:id/cierre → reporte → modal arqueo
      └─ POST /caja/cerrar {cajaId, montoRealEfectivo} → CerrarCajaUseCase: findById → salonId → ABIERTA → reporte → UPDATE
    AbrirCajaUseCase: findAbiertaBySalon → 409 → findBySalonYFecha (día) → create → backstop
    Mirror n8n: mismo handler → mismo contrato

## File Changes

| File | Action | Descripción |
|------|--------|-------------|
| `.../domain/ports/ICajaRepository.ts` | Modify | +`findAbiertaBySalon(salonId)` |
| `.../infrastructure/persistence/TypeORMCajaRepository.ts` | Modify | `findOne({ where: { salonId, estado: 'ABIERTA' } })` |
| `.../caja/AbrirCajaUseCase.ts` | Modify | Check `findAbiertaBySalon` + mensaje nuevo; conserva día/backstop |
| `.../caja/CerrarCajaUseCase.ts` | Modify | Input `cajaId?`; by-id vs fallback hoy; arqueo/UPDATE compartidos |
| `.../presentation/controllers/CajaController.ts` | Modify | `cajaId` de body/query, spread condicional |
| `packages/validation/src/caja.schema.ts` | Modify | +`cajaId` opcional (rebuild + restart) |
| `apps/pos-dashboard/.../CajaTab.tsx` | Modify | `cerrarCajaId`, `cerrarModalPorId`, "Cerrar" en filas ABIERTA + aviso, gating |
| `apps/pos-dashboard/.../CajaBanner.tsx` | Modify | Fetch `estado=ABIERTA` en camino 404; "Ver caja" vs "Abrir" |

## Interfaces / Contracts

    POST /caja/cerrar  body: { montoRealEfectivo, cajaId? } (fallback ?cajaId=)
      200 → { ok, data: { caja: CajaDTO, reporte } }
      404 → CAJA_NO_ENCONTRADA | CAJA_NO_ABIERTA (fallback hoy)    409 → CAJA_YA_CERRADA
    POST /caja/abrir  409 → CAJA_YA_ABIERTA "Ya existe una caja abierta — cerrá la caja pendiente antes de abrir una nueva"
    Mirror n8n: mismo handler → mismo contrato.

## Testing Strategy

| Layer | Qué | Cómo |
|-------|-----|------|
| Unit API | Abrir: bloquea con huérfana y abierta de hoy; ok sin abiertas; backstop | `AbrirCajaUseCase.test.ts` (+mock `findAbiertaBySalon`) |
| Unit API | Cerrar: por id (reporte, `cerrar` con ese id); otro salón/inexistente → 404; CERRADA → 409; fallback hoy; race | `CerrarCajaUseCase.test.ts` (+mock `findById`) |
| Controller | `cajaId` passthrough body y query | `CajaController.test.ts` |
| Schema | `cerrarCajaSchema` acepta `cajaId` opcional | `caja.schema.test.ts` |
| Unit UI | CajaTab: "Cerrar" por fila ABIERTA → modal esperado de ESA caja → POST `{cajaId, ...}`; Abrir oculto + mensaje | `CajaTab.test.tsx` |
| Unit UI | CajaBanner: con huérfana → "Ver caja"; hoy CERRADA → "Reabrir" intacto | `CajaBanner.test.tsx` |

TDD estricto (`strict_tdd: true`): RED → GREEN.

## Migration / Rollout

No migration. **Rebuild de `packages/validation`** (`npx tsc`) + restart API — sin esto `validate()` strippea `cajaId`. Smoke del mirror n8n.

## Open Questions

Ninguna. Edge documentado: `Reabrir` de hoy con huérfana puede producir 2 ABIERTA — la spec exige mantener la reapertura; el negocio cierra primero las huérfanas.
