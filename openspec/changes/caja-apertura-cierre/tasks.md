# Tasks: Caja — Apertura y Cierre

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~3,070 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR1 → PR2 → PR3 → PR4 |
| Delivery strategy | auto-forecast (chained) |
| Chain strategy | stacked-to-main |
| Review budget | 800 lines (D2) |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Backend caja completo: migraciones→entidad→repo→use cases→guard→errores→controller→rutas→schemas→container→n8n→specs (~1,600) | PR 1 | Branch `feat/caja-backend` desde main; tests y specs incluidos |
| 2 | Regla de oro en 3 chokepoints + CreateGasto cajaId + tests (~350) | PR 2 | Branch desde PR 1 |
| 3 | Frontend: CajaTab + modals + CajaBanner + tab FinanzasPage (~600) | PR 3 | Branch desde PR 2 |
| 4 | Manejo CAJA_CERRADA en WalkInModal/AgendaPage/VentasPage (~230) | PR 4 | Branch desde PR 3 |

## PR 1 — Backend caja (feat/caja-backend)

Inicio: `git checkout -b feat/caja-backend`. Fin: API sirve los 5 endpoints con envelope `{ok,data,error}` y 4 códigos CAJA_*. Verificación: `cd apps/api && npx vitest run && npx tsc --noEmit` + curls.

### Foundation (migraciones + entidades)

- [x] 1.1 Crear migración `apps/api/src/infrastructure/persistence/migrations/1700000000009-CreateCajas.ts` — tabla `cajas` (estilo SQL crudo 0008): salonId/fechaCaja UNIQUE, estado ENUM ABIERTA/CERRADA, montoInicial/montoEsperado/montoRealEfectivo/diferencia DECIMAL(12,2), auditores NULL, FK salones/usuarios, idx (salonId, estado); down = DROP TABLE
- [x] 1.2 Crear migración `1700000000010-AddCajaIdRegistros.ts` — `ALTER TABLE registros_servicio ADD cajaId INT NULL` + FK→cajas + idx; down inverso
- [x] 1.3 Crear migración `1700000000011-AddCajaIdGastos.ts` — `ALTER TABLE gastos ADD cajaId INT NULL` + FK→cajas + idx; down inverso
- [x] 1.4 Crear `apps/api/src/infrastructure/persistence/entities/CajaEntity.ts` — extiende BaseEntity; @Unique(['salonId','fechaCaja']); campos del diseño; ManyToOne salon/aperturaPor/cierrePor (auditores nullable)
- [x] 1.5 Registrar CajaEntity en `apps/api/src/shared/database.ts` (lista de entities)
- [x] 1.6 Modificar `RegistroServicioEntity.ts` — `@Column({type:'int', nullable:true}) cajaId` + ManyToOne CajaEntity (patrón liquidacionId nullable, gotcha #9)
- [x] 1.7 Modificar `GastoEntity.ts` — `cajaId` nullable + ManyToOne CajaEntity

### Repositorios + errores

- [x] 1.8 Crear `apps/api/src/modules/finanzas/domain/ports/ICajaRepository.ts` — findBySalonYFecha, findAbiertaBySalonYFecha, create, cerrar (update condicional→boolean), listBySalonPaginated
- [x] 1.9 Crear `apps/api/src/modules/finanzas/infrastructure/persistence/TypeORMCajaRepository.ts` — patrón getRepo() de TypeORMGastoRepository; `cerrar()` con queryBuilder update `WHERE id AND estado='ABIERTA'` → `affected===1`; listBySalonPaginated con skip/take + getCount, orden fechaCaja DESC
- [x] 1.10 Modificar `IRegistroServicioRepository.ts` + `TypeORMRegistroServicioRepository.ts` — param opcional `cajaId` en search()/count() (patrón pagination existente)
- [x] 1.11 Modificar `IGastoRepository.ts` + `TypeORMGastoRepository.ts` — nuevo método `findByCajaId(cajaId)`
- [x] 1.12 Modificar `apps/api/src/shared/errors.ts` — 4 subclases AppError: CajaCerradaError(422), CajaYaAbiertaError(409), CajaYaCerradaError(409), CajaNoAbiertaError(404) con codes CAJA_*
- [x] 1.13 Modificar errorHandler (junto a errors.ts) — envelope aditivo `{ok:false, data:null, error:{code,message,details}}` sin romper endpoints existentes

### Use cases + DTOs + guard

- [x] 1.14 Crear `application/dtos/CajaDTO.ts` + `ReporteCierreDTO.ts` — mappers desde CajaEntity / reporte
- [x] 1.15 Crear `use-cases/caja/calcularReporteCierre.ts` — función pura; arqueo cash-only: `montoEsperado = Σ pagos EFECTIVO − Σ gastos EFECTIVO`; filtra estado!==ANULADO; breakdown completo por método como info (decisión owner; claves = enum MetodoPago)
- [x] 1.16 Crear `application/services/verificarCajaAbierta.ts` — `findAbiertaBySalonYFecha(salonId, getColombiaDateString())` → throw CajaCerradaError si null
- [x] 1.17 Crear `use-cases/caja/AbrirCajaUseCase.ts` — pre-check ABIERTA→CajaYaAbierta/CERRADA→CajaYaCerrada; create con fechaCaja=colombia-date; catch ER_DUP_ENTRY → re-query → 409 correcto
- [x] 1.18 Crear `use-cases/caja/CerrarCajaUseCase.ts` — null→CajaNoAbierta(404); no ABIERTA→CajaYaCerrada; cargar movs por cajaId (registroRepo.search cajaId + gastoRepo.findByCajaId); calcularReporteCierre; cerrar() condicional false→CajaYaCerrada (race); persistir solo si ganó
- [x] 1.19 Crear `use-cases/caja/ObtenerCajaActualUseCase.ts` — findAbiertaBySalonYFecha → null → CajaNoAbiertaError
- [x] 1.20 Crear `use-cases/caja/ListarCierresCajaUseCase.ts` — listBySalonPaginated(estado default 'CERRADA') + paginate() → `{data, meta}`
- [x] 1.21 Crear `use-cases/caja/ObtenerEsperadoCajaUseCase.ts` — preview read-only vía calcularReporteCierre sin persistir (endpoint `/actual/esperado`)

### API + validación + container

- [x] 1.22 Crear `packages/validation/src/caja.schema.ts` — abrirCajaSchema `{montoInicial: z.number().min(0)}`, cerrarCajaSchema `{montoRealEfectivo: z.number().min(0)}` + exports en `index.ts`
- [x] 1.23 Rebuild validation dist — `cd packages/validation && npx tsc` (el API importa de dist/, gotcha #6)
- [x] 1.24 Crear `presentation/controllers/CajaController.ts` — 5 handlers (abrir/cerrar/actual/actualEsperado/cierres); roles S,D,A,R; `salonId: req.salonId!`; auditores `req.user?.id`; respuestas `{ok:true, data}`
- [x] 1.25 Modificar `finanzas.routes.ts` — montar rutas `/salones/:salonId/caja/{abrir,cerrar,actual,actual/esperado,cierres}` con requireRole + validate schemas
- [x] 1.26 Modificar `apps/api/src/modules/salon/presentation/routes/n8n.routes.ts` — mirrors `/:salonId/caja/*` con apiKeyGuard + tenantGuard, mismos handlers (auditores null en n8n)
- [x] 1.27 Modificar `apps/api/src/shared/container.ts` — registrar ICajaRepository, 4-5 use cases + CajaController

### Tests nuevos (PR 1)

- [x] 1.28 Crear `use-cases/caja/__tests__/calcularReporteCierre.test.ts` — arqueo cash-only (260000 spec→170000 owner), diferencia ±, ANULADO excluido, porMetodoPago, comisiones
- [x] 1.29 Crear `__tests__/AbrirCajaUseCase.test.ts` — éxito 201 ABIERTA, CajaYaAbierta, CajaYaCerrada, ER_DUP_ENTRY→re-query
- [x] 1.30 Crear `__tests__/CerrarCajaUseCase.test.ts` — cierre exitoso, diferencia, ya cerrada, race (cerrar→false), CajaNoAbierta
- [x] 1.31 Crear `__tests__/ObtenerCajaActualUseCase.test.ts` + `ListarCierresCajaUseCase.test.ts` — 200/404 y paginación con orden
- [x] 1.32 Crear `services/__tests__/verificarCajaAbierta.test.ts` — lanza CajaCerradaError sin caja
- [x] 1.33 Crear `controllers/__tests__/CajaController.test.ts` — envelope {ok,data}, status 201/200/404/409/422, auditor req.user
- [x] 1.34 Crear `packages/validation/__tests__/caja.schema.test.ts` — patrón finanzas.schema.test.ts (montoInicial requerido, negativo rechazado)
- [x] 1.35 Verificar delta specs openspec commited con PR1 (finanzas-caja/registros/gastos ya escritos por sdd-spec)

## PR 2 — Regla de oro (chokepoints)

Inicio: branch desde PR1. Fin: POST /registros y completar → 422 CAJA_CERRADA sin caja; gasto con cajaId cuando hay. Verificación: vitest + curl.

- [x] 2.1 Modificar `CreateRegistroUseCase.ts` — @inject('ICajaRepository'); paso 0 antes de validar cliente: `verificarCajaAbierta`; `cajaId: caja.id` en create() dentro de la transacción existente
- [x] 2.2 Modificar `CreateGastoUseCase.ts` — `findAbiertaBySalonYFecha` → `cajaId: caja?.id ?? null` (NO lanza 422, spec gastos)
- [x] 2.3 Modificar `CompletarCitaUseCase.ts` — tras findById, antes de cambiarEstado: `verificarCajaAbierta(repo, cita.salonId)`; cita permanece en estado previo
- [x] 2.4 Modificar `CambiarEstadoCitaUseCase.ts` — verificar solo si `input.estado === 'COMPLETADA'` (tras validarTransicion); otros estados no bloqueados
- [x] 2.5 Actualizar `CreateRegistroUseCase.test.ts` — mock ICajaRepository; casos: sin caja→422 CAJA_CERRADA sin persistir, con caja id=5→cajaId=5
- [x] 2.6 Actualizar `CambiarEstadoCitaUseCase.test.ts` — nueva dep; COMPLETADA→422 y estado intacto; CANCELADA sin caja→200
- [x] 2.7 Crear `cita/__tests__/CompletarCitaUseCase.test.ts` (no existe, gotcha #5) — 422 CAJA_CERRADA, cita queda CONFIRMADA
- [x] 2.8 Crear `gasto/__tests__/CreateGastoUseCase.test.ts` (no existe, gotcha #5) — cajaId=5 con caja, NULL sin caja
- [x] 2.9 Verificar PR2: `npx vitest run` + curls (sin caja → 422 CAJA_CERRADA; abrir → POST registros 201 con cajaId) — vitest ✓ (233 pass, 2 fallas pre-existentes RegistroController); curls pendientes de entorno con server/DB (sdd-verify)

## PR 3 — Frontend Caja (CajaTab + CajaBanner)

Inicio: branch desde PR2. Fin: abrir/cerrar desde UI + historial paginado + banner. Verificación: `cd apps/pos-dashboard && npx vitest run && npx tsc --noEmit` + manual.

- [x] 3.1 Crear `components/caja/CajaBanner.tsx` — fetch `GET /salones/:id/caja/actual` en mount; verde "Caja abierta 💰 $montoInicial" / ámbar "Caja cerrada — Abrir para vender" (link tab Caja); escucha/dispara custom event `caja-refresh`
- [x] 3.2 Crear `components/caja/CajaTab.tsx` — badge estado actual + botón Abrir (modal inline montoInicial → POST /caja/abrir); botón Cerrar → modal arqueo con `GET /caja/actual/esperado` (efectivo esperado + breakdown), input montoRealEfectivo, preview diferencia en vivo, POST /caja/cerrar → render ReporteCierreDTO; dispara caja-refresh
- [x] 3.3 En CajaTab: historial paginado `GET /caja/cierres?page=&limit=12` — tabla fecha/apertura/cierre/esperado/real/diferencia/estado
- [x] 3.4 Modificar `pages/FinanzasPage.tsx` — TabKey + TABS += `{key:'caja', label:'💰 Caja'}`; render `<CajaTab/>`; montar CajaBanner
- [x] 3.5 Montar `CajaBanner` en `pages/AgendaPage.tsx` y `pages/VentasPage.tsx` (bajo header/toolbar)
- [x] 3.6 Crear `components/caja/__tests__/CajaBanner.test.tsx` + `CajaTab.test.tsx` (light: render, fetch, estados)

## PR 4 — Manejo CAJA_CERRADA en flujos de venta

Inicio: branch desde PR3. Fin: vender con caja cerrada muestra mensaje, banner y mantiene modal abierto. Verificación: manual E2E + vitest.

- [x] 4.1 Modificar `components/WalkInModal.tsx` — catch POST registros: `err.response?.data?.error?.code === 'CAJA_CERRADA'` → mensaje "Abrí la caja primero para vender", modal permanece abierto, `dispatchEvent('caja-refresh')`
- [x] 4.2 Modificar `pages/AgendaPage.tsx` — `handleConfirmarCompletar`: nuevo estado `completarError` (reemplaza console.error); CAJA_CERRADA → mensaje visible + caja-refresh
- [x] 4.3 Modificar `pages/VentasPage.tsx` — catch POST registros CAJA_CERRADA → mensaje visible + caja-refresh
- [x] 4.4 Tests frontend PR4 — casos CAJA_CERRADA en WalkInModal/AgendaPage/VentasPage (modal permanece, banner refrescado)
- [ ] 4.5 E2E manual: caja cerrada → intentar vender → banner ámbar + mensaje + modal sigue abierto; abrir caja → banner verde + venta 201

## PR 5 — Reapertura de caja (Opción A: misma caja del día)

- [x] 5.1 Backend — `ReabrirCajaUseCase`: buscar caja de hoy por `findBySalonYFecha`; si no existe → 404 CAJA_NO_ABIERTA; si está ABIERTA → 409 CAJA_YA_ABIERTA; si está CERRADA → set estado ABIERTA + limpiar montoEsperado/montoRealEfectivo/diferencia/cierrePorId/cierreEn (mismo id, NO crear nueva)
- [x] 5.2 Backend — repo: método `reabrir(id)` con UPDATE condicional (estado='CERRADA' → ABIERTA) para evitar race
- [x] 5.3 Backend — `CajaController` + ruta `POST /salones/:id/caja/reabrir` con `requireRole(S,D,A,R)`
- [x] 5.4 Backend — mirror n8n `POST /api/n8n/:salonId/caja/reabrir` (auditores null)
- [x] 5.5 Tests — `ReabrirCajaUseCase.test.ts` (3 escenarios: reabrir OK / ya abierta 409 / sin caja 404) + controller test (no existe patrón de repo test en el codebase — el contrato del repo se cubre vía use case + tsc)
- [x] 5.6 Frontend — `CajaTab`: botón "Reabrir caja" visible cuando la caja de hoy está CERRADA; confirma y llama POST /caja/reabrir; dispara caja-refresh
- [x] 5.7 Spec — requisito "POST Reabrir Caja" + 3 escenarios (ya agregado en finanzas-caja/spec.md, verificado consistente)
- [ ] 5.8 Verificación — tsc ✓ + vitest API ✓ / dashboard ✓ en apply; E2E manual (cerrar → reabrir → vender → cerrar con arqueo correcto) pendiente de sdd-verify (no se levanta server en apply)

## Test Inventory

**Nuevos:** `use-cases/caja/__tests__/{calcularReporteCierre,AbrirCajaUseCase,CerrarCajaUseCase,ObtenerCajaActualUseCase,ListarCierresCajaUseCase}.test.ts`, `services/__tests__/verificarCajaAbierta.test.ts`, `controllers/__tests__/CajaController.test.ts`, `gasto/__tests__/CreateGastoUseCase.test.ts`, `cita/__tests__/CompletarCitaUseCase.test.ts`, `packages/validation/__tests__/caja.schema.test.ts`, `components/caja/__tests__/{CajaBanner,CajaTab}.test.tsx`, tests PR4.

**Modificados:** `CreateRegistroUseCase.test.ts`, `CambiarEstadoCitaUseCase.test.ts`.

## Risks / Gotchas

- **Validation rebuild obligatorio** (1.23) antes de levantar API — el API importa de `dist/`.
- **Orden de migraciones** 0009→0010→0011 secuencial; down() inverso (rollback PR1).
- **PR1 (~1,600) excede el budget de 800** del split decidido — opcional sub-split interno (migraciones+core / API+schemas / tests) si el reviewer lo pide; NO redecidir el split.
- **Spec vs owner en arqueo**: escenario "Reporte completo" (finanzas-caja) espera 260000 (todos los pagos); decisión owner = cash-only → 170000. sdd-verify debe ajustar el escenario.
- **n8n sin `req.user`** → auditores null (columnas nullable ya contempladas).
- **Enum MetodoPago** es `EFECTIVO|TARJETA|TRANSFERENCIA` — claves de porMetodoPago usan el enum, no labels del frontend.
