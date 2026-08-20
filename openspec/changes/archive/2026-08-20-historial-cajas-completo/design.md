# Design: Historial de Cajas Completo

## Technical Approach

The list endpoint already supports an optional `estado`: the repository (`TypeORMCajaRepository.listBySalonPaginated`, no filter = all) and the controller (parses `estado` query, maps unknown values → `undefined`) need no changes. The single backend deviation is the use case forcing `estado ?? 'CERRADA'` — remove it so no-estado lists ALL cajas. Then make the open-caja detail null-safe (today `Number(null)` = 0 fabricates a false arqueo) and update CajaTab to render both estados + the pending-closure warning. Endpoint name, URL, roles, and envelope stay identical → n8n mirror (same handler) is consistent automatically.

## Architecture Decisions

| # | Option | Tradeoff | Decision |
|---|--------|----------|----------|
| 1 | Keep `/caja/cierres` (default ALL) vs new `/caja/historial` alias | Alias = clearer name but duplicate surface + ambiguity for mobile; keep = zero diff in routes/controller/repo, mirror n8n intact | **Keep `/caja/cierres`, default ALL**. `estado=TODAS` maps to no filter for free (controller already sends unknown → `undefined`) |
| 2 | Backward compat del default | Callers relying on implicit CERRADA (dashboard, n8n) | Dashboard updated in the same PR; spec documents explicit `estado=CERRADA`; mirror n8n comparte handler → mismo shape |
| 3 | Fuente del aviso: derivar del listado página 1 vs fetch dedicado `estado=ABIERTA&limit=0` | Página 1 = 0 requests extra pero pierde huérfanas >12 filas atrás; fetch dedicado = 1 request liviana, count exacto, ejercita el filtro nuevo (prueba API-first) | **Fetch dedicado** en mount: `GET /caja/cierres?estado=ABIERTA&limit=0` → `abiertas.filter(fechaCaja < getColombiaDateString())` → banner con count |
| 4 | Detalle de caja ABIERTA | `Number(null)` = 0 → reporte falso (montoReal 0, diferencia −esperado) | **Null-safe**: `montoRealEfectivo === null ? null : Number(...)` → reporte.montoReal/diferencia null (mismo patrón que `ObtenerEsperadoCajaUseCase`) |
| 5 | Dependencia `hoyCerrada` (botón "Reabrir") | `cierres[0]` en CajaTab (L414) y CajaBanner (L91) confía en orden DESC; verificado: sigue correcto tras el cambio (hoy siempre primero si existe; sin caja hoy → primer item no es CERRADA+today) | **Mantener semántica**; hardening en CajaTab con `.find(c => c.estado === 'CERRADA' && c.fechaCaja === hoy)` (inmune a futuros filtros). CajaBanner intacto |
| 6 | Badges/labels | Badge de fila ámbar hardcodeado + modales con "CERRADA" fijo | Dinámico: ABIERTA verde / CERRADA ámbar en filas y modales (`reporte.caja.estado`, `detalleCierre.estado`); "Historial de cierres" → "Historial de cajas" |

## Data Flow

    CajaTab mount
      ├─ GET /caja/actual                            → estado actual (card abierta/cerrada)
      ├─ GET /caja/cierres?page=1&limit=12           → historial (TODAS, fechaCaja DESC) → badges + paginación
      └─ GET /caja/cierres?estado=ABIERTA&limit=0    → abiertas → warning "caja pendiente" si fechaCaja < hoy
    Clic "Ver" → GET /caja/:id/cierre                → detalle (reporte con montoReal/diferencia null si ABIERTA)

## File Changes

| File | Action | Descripción |
|------|--------|-------------|
| `apps/api/src/modules/finanzas/application/use-cases/caja/ListarCierresCajaUseCase.ts` | Modify | L22 `estado ?? 'CERRADA'` → `estado` (undefined = todas) + comentario |
| `apps/api/src/modules/finanzas/application/use-cases/caja/ObtenerDetalleCierreCajaUseCase.ts` | Modify | L61 `Number(caja.montoRealEfectivo)` → null-safe para ABIERTA |
| `apps/api/src/modules/finanzas/application/use-cases/caja/__tests__/ListarCierresCajaUseCase.test.ts` | Modify | Default → `undefined` (todas); casos filtro ABIERTA/CERRADA; total con solo abiertas |
| `apps/api/src/modules/finanzas/application/use-cases/caja/__tests__/ObtenerDetalleCierreCajaUseCase.test.ts` | Modify | Caso ABIERTA → montoReal/diferencia null |
| `apps/pos-dashboard/src/components/caja/CajaTab.tsx` | Modify | Badges dinámicos, `fetchCajasAbiertas` + banner aviso, `—` para null, labels, hardening `hoyCerrada` |
| `apps/pos-dashboard/src/components/caja/__tests__/CajaTab.test.tsx` | Modify | +4 tests (lista mixta, aviso con/sin huérfana, hoyCerrada mixta, detalle ABIERTA) + mock `estado=ABIERTA` |

Sin cambios (verificado en código): `CajaController.ts`, `finanzas.routes.ts`, `n8n.routes.ts`, `ICajaRepository.ts`, `TypeORMCajaRepository.ts`, `CajaDTO.ts`, `CajaBanner.tsx`, `CajaEntity.ts`, `pagination.ts`.

## Interfaces / Contracts

    GET /api/salones/:salonId/caja/cierres?page=1&limit=12[&estado=ABIERTA|CERRADA|TODAS]
    200 → { ok: true, data: { data: CajaDTO[], meta: { page, limit, total, totalPages } } }
    Sin estado o estado=TODAS → todas las cajas del salón, fechaCaja DESC.
    CajaDTO completo: id, salonId, fechaCaja, montoInicial, montoEsperado, montoRealEfectivo,
      diferencia, estado, aperturaPorId, aperturaEn, cierrePorId, cierreEn, creadoEn.
    Contrato idéntico en el mirror n8n (/api/n8n/:salonId/caja/cierres) — mismo handler.
    App mobile futura: usa este endpoint para el historial; filtra con estado=ABIERTA para "abiertas".

## Testing Strategy

| Layer | Qué | Cómo |
|-------|-----|------|
| Unit API | Sin estado → todas; filtros ABIERTA/CERRADA; `meta.total` con 2 abiertas = 2 | `ListarCierresCajaUseCase.test.ts` |
| Unit API | Detalle ABIERTA → montoReal/diferencia null; CERRADA sin regresión | `ObtenerDetalleCierreCajaUseCase.test.ts` |
| Controller | Passthrough de `estado` — sin cambios; verificar suite | `CajaController.test.ts` (ya cubre `undefined`/`CERRADA`) |
| Unit UI | Lista mixta (badges ABIERTA/CERRADA), aviso con y sin huérfana, `—` en fila ABIERTA, hoyCerrada con lista mixta, detalle ABIERTA | `CajaTab.test.tsx` |

TDD estricto (config `strict_tdd: true`): test que falla → implementar → verde.

## Migration / Rollout

No migration required. Sin feature flags. Sin cambios de schema → **no** rebuild de `packages/validation`. Reiniciar API tras los cambios de use cases.

## Open Questions

Ninguna — decisiones resueltas arriba. Nota: edge pre-existente "Reabrir en página 2+ del historial" (depende de `cierres[0]`, rompe al paginar) queda fuera de alcance.
