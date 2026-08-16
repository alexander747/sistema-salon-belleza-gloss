# Proposal: Caja — Apertura y Cierre

**Status**: propuesto
**Change**: caja-apertura-cierre
**Artifact Store**: openspec
**Fases completadas**: explore ✅, propose ✅

## Intent
Control diario del efectivo por salón: caja abierta cada mañana con fondo inicial, cerrada con arqueo (esperado vs real → diferencia). Regla de oro: sin caja abierta no se vende ni se completan citas (código machine-readable `CAJA_CERRADA`). API-first para web/mobile/n8n.

## Scope
**In:** entidad Caja + migraciones (cajas, cajaId en registros/gastos); apertura/cierre con arqueo (S/D/A/R); regla de oro en 3 chokepoints; reporte por método de pago × tipo; historial de cierres; UI tab "Caja" + banners AgendaPage/VentasPage; tests actualizados.

**Out:** export Excel → cambio `reportes-exportacion-excel`; snapshot caja_cierre_detalle (DECISIÓN: recomendado al-vuelo v1); edición/anulación de cierres.

## Capabilities
- **New** `finanzas-caja`: apertura, cierre+arqueo, regla de oro, historial, endpoints
- **Modified** `finanzas-registros` (exige caja abierta + cajaId), `finanzas-gastos` (cajaId)

## Approach
Backend-first: migraciones → entity/repos → use cases → controllers/routes → Zod (rebuild validation dist) → container. Luego frontend. Códigos nuevos: `CAJA_CERRADA`, `CAJA_YA_ABIERTA`, `CAJA_YA_CERRADA` (422/409).

## API Surface
| Endpoint | Roles | Cuerpo | Resp |
|---|---|---|---|
| POST /salones/:id/caja/abrir | S,D,A,R | {montoInicial} | 201 |
| POST /salones/:id/caja/cerrar | S,D,A,R | {montoRealEfectivo} | 200 + reporte |
| GET /salones/:id/caja/actual | S,D,A,R | — | 200/404 |
| GET /salones/:id/caja/cierres | S,D,A,R | page,limit | {data,meta} |

Formato `{ok,data,error}`; errores `{error:{code,message,details}}`.

## Data Model
`cajas`: salon_id, fecha_caja (DATE), monto_inicial, monto_real, diferencia, estado, abierta_por/en, cerrada_por/en; UNIQUE(salon_id, fecha_caja). FKs nullable: registros_servicio.caja_id, gastos.caja_id. Día comercial = colombia-date.ts (05:00 UTC→+24h).

## Golden Rule (chokepoints)
1. CreateRegistroUseCase.ts (antes de validar cliente): caja abierta o 422; set cajaId en create()
2. CompletarCitaUseCase.ts: validar antes de cambiarEstado
3. CambiarEstadoCitaUseCase.ts: solo estado objetivo COMPLETADA

## Compatibility
cajaId nullable → filas legadas intactas; endpoints existentes sin cambios; tests existentes se actualizan (nueva dep ICajaRepository), no se eliminan; compose n8n intacto (timezone Argentina = gotcha documentado).

## Risks
| Riesgo | Prob | Mitigación |
|---|---|---|
| Cierre concurrente | Med | Update condicional estado=ABIERTA + unique index |
| Anulación post-cierre | Med | Reporte marca mov. fuera de caja |
| Backfill cajaId NULL | Med | Migración opcional, no bloqueante |
| Validation dist viejo | Low | Rebuild obligatorio tras schema |

## Rollback
Revertir migraciones en orden inverso; quitar checks de chokepoints; datos de cajas conservados; NULL cajaId mantiene operación.

## Success Criteria
- [ ] Sin caja: POST /registros y completar cita → 422 `CAJA_CERRADA`
- [ ] Cierre reporta esperado/real/diferencia correctos
- [ ] Historial consultable; coverage ≥80%

## Size & File Plan
~3,900 líneas (backend ~1,600, frontend ~1,200, tests ~700, specs ~400) → excede 400-800 → chained PRs (backend, luego UI).

Nuevos: module cajas/ (entity, repo, use-cases, controller, routes, schemas, tests), migraciones 0009-0011, frontend CajaTab/banners, openspec/specs/finanzas-caja/spec.md.
Modificados: CreateRegistro/CompletarCita/CambiarEstadoCita + tests, RegistroServicio/Gasto entities, container.ts, database.ts, specs finanzas-registros/gastos.
