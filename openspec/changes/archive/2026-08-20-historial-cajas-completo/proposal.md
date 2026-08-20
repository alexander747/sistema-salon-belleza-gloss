# Proposal: Historial de Cajas Completo

## Intent

El historial (`GET /caja/cierres`) solo devuelve cajas CERRADAS (default `'CERRADA'` en el use case); las cajas ABIERTAS de días anteriores quedan huérfanas e invisibles (hoy: 2 abiertas). Cambio: historial con TODAS las cajas + filtro por estado, aviso "caja pendiente de cierre" y contrato API listo para la app mobile.

## Scope

**In:** backend sin default CERRADA (sin `estado` = todas) + filtro `estado=ABIERTA|CERRADA|TODAS`; detalle de caja ABIERTA con `montoReal`/`diferencia` null (hoy `Number(null)`=0 fabrica arqueo); CajaTab con ambas estados, badges, columnas completas y aviso de pendientes; tests.

**Out:** cerrar huérfanas vía API → futuro; aviso global en `CajaBanner` → futuro; renombrar `/caja/cierres`; edge pre-existente "Reabrir en página 2+".

## Capabilities

- **Modified** `finanzas-caja`: semántica de `GET /caja/cierres`, detalle de caja abierta, alerta de pendientes, render del historial

## Approach

Backend-first mínimo: repo y controller ya soportan `estado` opcional; la única desviación es `?? 'CERRADA'` en `ListarCierresCajaUseCase`. Se elimina (~3 líneas) + null-safe en detalle. Luego CajaTab: badges, fetch de abiertas para el aviso, labels. Sin migraciones ni cambios de URL/envelope.

## API Surface (decisión)

Mantener `GET /caja/cierres`; sin `estado` → TODAS (DESC, paginado); filtro `estado=ABIERTA|CERRADA|TODAS` (TODAS = sin filtro, gratis). Respuesta `{ ok, data: { data, meta } }`.

Por qué no un alias `/caja/historial`: ① cero diff (mirror n8n comparte handler); ② la spec archivada ya documentaba `estado` opcional — el default CERRADA era la desviación; ③ un único endpoint = un único contrato mobile/n8n; ④ `estado=CERRADA` preserva compatibilidad.

## Data Model

Ninguno. Sin migraciones.

## Affected Areas

| Area | Impact |
|------|--------|
| `.../caja/ListarCierresCajaUseCase.ts` | Modified |
| `.../caja/ObtenerDetalleCierreCajaUseCase.ts` | Modified |
| `.../caja/__tests__/ListarCierresCajaUseCase.test.ts` | Modified |
| `.../caja/__tests__/ObtenerDetalleCierreCajaUseCase.test.ts` | Modified |
| `apps/pos-dashboard/.../CajaTab.tsx` | Modified |
| `apps/pos-dashboard/.../CajaTab.test.tsx` | Modified |

Sin cambios (verificado): `CajaController.ts`, `finanzas.routes.ts`, `n8n.routes.ts`, repos caja, `CajaDTO.ts`, `CajaBanner.tsx`.

## Risks

| Riesgo | Prob | Mitigación |
|--------|------|------------|
| Consumidores con default CERRADA implícito (n8n) | Baja | Spec documenta `estado=CERRADA`; dashboard en el mismo PR |
| `hoyCerrada` (Reabrir) depende de `cierres[0]` | Baja | Orden DESC garantiza la caja de hoy primero; tests |
| Badge "CERRADA" hardcodeado en modales | Baja | Badge dinámico por `estado` |

## Rollback

Revertir el diff (2 use cases + CajaTab + tests). Sin migración ni datos; endpoint vuelve a default CERRADA.

## Dependencies

Ninguna. Sin rebuild de `packages/validation`.

## Success Criteria

- [ ] `GET /caja/cierres` sin estado → 2 ABIERTA (`meta.total=2`)
- [ ] Filtros ABIERTA/CERRADA/TODAS OK; controller test sin cambios
- [ ] CajaTab: badge ABIERTA verde + aviso de pendientes con count
- [ ] "Reabrir caja" sigue funcionando (hoy CERRADA)
- [ ] vitest api + dashboard verdes; coverage ≥80%
