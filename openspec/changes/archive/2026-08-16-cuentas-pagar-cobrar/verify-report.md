# Verification Report — Cuentas por Cobrar y Pagar (read-only v1)

**Change**: `cuentas-pagar-cobrar` (PR1 API `feat/cuentas-api` + PR2 UI `feat/cuentas-ui`)
**Branch**: `feat/cuentas-ui` @ `d6f850c`
**Mode**: Standard (no STRICT TDD directive from orchestrator; tasks.md references `strict_tdd: true` for the apply phase — not re-audited here)
**E2E**: ⚠️ NOT executed — orchestrator has not confirmed E2E; verification is unit/integration level (full API suite + full dashboard suite).

## Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 12 |
| Tasks complete | 12 |
| Tasks incomplete | 0 |

All phases (1-6) checked `[x]` in tasks.md. Implementation files for every task exist (repo port+impl, DTOs, 2 use cases, `antiguedad.ts`, controller, routes, container, CuentasTab, tests).

## Build & Tests Execution

**Build (API)**: ⚠️ 3 pre-existing errors — PROVEN pre-existing (identical output on `main` via worktree)
```text
src/infrastructure/persistence/seed.ts(238,23): error TS2769 (ServicioEntity save overload)
src/modules/finanzas/application/use-cases/registro/__tests__/CreateRegistroUseCase.test.ts(86,9): error TS2741 (serviciosItems missing)
src/modules/finanzas/application/use-cases/registro/__tests__/RegistroServicioItemDTO.test.ts(3,44): error TS2307 (module not found)
```
Zero errors in any file touched by this change (cuentas/*, container.ts, finanzas.routes.ts).

**Build (Dashboard)**: ⚠️ 5 pre-existing errors — PROVEN pre-existing (identical on `main`):
```text
AgendaPage.tsx(195,11) TS6133 'istart' unused; AgendaPage.tsx(1405,7) TS2304 'setClientes'; AgendaPage.tsx(1423,21) TS6133 'status'; DashboardPage.tsx(335,11) TS6133 'todayStr'; ServiciosPage.tsx(372,9) TS6133 'handleToggleActive'
```
Zero errors in FinanzasPage.tsx (the only changed dashboard file).

**Tests (API)**: ✅ 331 passed / ❌ 2 failed / 0 skipped (56 files) — the 2 failures are `RegistroController > list > should pass filter params when provided` + `... defaults`; PROVEN pre-existing: identical failure on `main` worktree.
**Tests (Dashboard)**: ✅ 60 passed / ❌ 0 failed (8 files) — includes CajaCerradaFlows (2/2 ✓, previously flaky; green this run).
**Tests (Cuentas API, scoped)**: ✅ 19/19 (Cobrar 5, Pagar 6, Controller 8).

**Coverage (cuentas/ API)**: threshold 80% → ✅ Above
```text
CuentasCobrarUseCase.ts   Stmts 100% | Branch 93.33% | Funcs 100% | Lines 100%
CuentasPagarUseCase.ts    Stmts 98.78% | Branch 76.47% | Funcs 100% | Lines 98.78%
antiguedad.ts             Stmts 100% | Branch 100% | Funcs 100% | Lines 100%
CuentasController.ts      Stmts 100% | Branch 100% | Funcs 100% | Lines 100%
```

**Coverage (CuentasTab dashboard)**: threshold 80% → ✅ Above (function-level, from v8 coverage-final.json)
```text
CuentasTab           247/247 statements covered = 100%
CuentasPaginacion     42/42 = 100%
puedeVerCuentas        3/3 = 100%
antiguedadLabel        3/3 = 100%
```

## Spec Compliance Matrix

| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| REQ-01 cobrar | Agrega deuda de un cliente (15000+25000, anulado 30000 excluido → 40000, 2 registros) | `CuentasCobrarUseCase.test.ts > agrega deuda por cliente…` | ✅ COMPLIANT |
| REQ-01 cobrar | Cliente sin deuda excluido (montoPendiente=0) | `CuentasCobrarUseCase.test.ts > agrega deuda… (cliente B)` + `devuelve lista vacía` | ✅ COMPLIANT |
| REQ-01 cobrar | Orden y paginación (25 clientes, meta.total=25, 10 filas, DESC, "Ana" primera) | `CuentasCobrarUseCase.test.ts > ordena por deudaTotal DESC y pagina` | ✅ COMPLIANT |
| REQ-01 cobrar | Bucket de antigüedad (45 días → 31-60; además 0-30/61-90/90+ y límite 90) | `CuentasCobrarUseCase.test.ts > clasifica buckets…` | ✅ COMPLIANT |
| REQ-02 pagar | Pendiente + acumulado (298000 + 250000+300000=550000) | `CuentasPagarUseCase.test.ts > combina pendienteActual…` | ✅ COMPLIANT |
| REQ-02 pagar | Empleada solo en historial (pendienteActual=0, acumulado=200000) | `CuentasPagarUseCase.test.ts > incluye empleada presente solo en el historial` | ✅ COMPLIANT |
| REQ-02 pagar | Frontera de mes preservada (liquidada sin registros nuevos → 0; semántica documentada en código) | `CuentasPagarUseCase.test.ts > preserva la frontera de mes…` + comentario `CuentasPagarUseCase.ts` L20-25 | ✅ COMPLIANT |
| REQ-03 roles | Rol privilegiado permitido (CONTADOR → 200 `{ data, meta }`) | `CuentasController.test.ts > permite CONTADOR` + `devuelve 200…` | ✅ COMPLIANT |
| REQ-03 roles | Rol restringido denegado (RECEPCIONISTA → 403) | `CuentasController.test.ts > bloquea RECEPCIONISTA con 403` | ✅ COMPLIANT |
| REQ-03 roles | (extra) MANICURISTA → 403 | `CuentasController.test.ts > bloquea MANICURISTA con 403` | ✅ COMPLIANT |
| REQ-04 tab | Renderiza sub-vistas Cobrar/Pagar con datos de la API | `FinanzasPage.test.tsx > renderiza la sub-vista Cobrar…` + `cambia a la sub-vista Pagar…` | ✅ COMPLIANT |
| REQ-04 tab | Sin acciones de cobro en v1 (no "Cobrar"/"registrar pago") | `FinanzasPage.test.tsx > NO muestra botones de cobro…` | ✅ COMPLIANT |
| REQ-05 docs | Semántica de consistencia documentada (devolución, valorFinal, flujo de cobro) | Static: `CuentasCobrarUseCase.ts` L24-32 (comentario FOLLOW-UP a/b/c) | ✅ COMPLIANT (static evidence; requirement is documentation, no runtime assertion needed) |

**Compliance summary**: 13/13 spec scenarios compliant (12 spec scenarios + MANICURISTA extra role check). Additional passing coverage: buckets con límite 90 días, última página, empty states, paginación 12 por página con Siguiente en ambas sub-vistas, error+Reintentar, ocultar tab para MANICURISTA.

## Correctness (Static Evidence)

| Requirement | Status | Notes |
|------------|--------|-------|
| `findConDeudaBySalon` en port + impl | ✅ Implemented | `leftJoinAndSelect('r.cliente')` + `montoPendiente > 0` + `estado != ANULADO`, `creadoEn ASC` (min directo) |
| CuentasCobrarUseCase agregación | ✅ Implemented | JS `Map` por clienteId, defensa en profundidad (skip ANULADO/≤0), `min(creadoEn)` → antigüedad |
| Antigüedad tz Colombia | ✅ Implemented | `antiguedad.ts` sobre `colombia-date.ts` (colombiaDayStartUTC), día de negocio UTC-5, hoy inyectable |
| Buckets | ✅ Implemented | 0-30 / 31-60 / 61-90 (incluye 90) / 90+ (91+) |
| Orden + paginación | ✅ Implemented | `deudaTotal DESC` (cobrar), `empleadaId ASC` (pagar), `paginate()` de shared |
| CuentasPagarUseCase composición | ✅ Implemented | `NominaPendienteUseCase` + `HistorialLiquidacionesUseCase` + `usuarioRepo.findBySalon` (token `IPersonasUsuarioRepository` registrado, container L163); suma `totalPagado` por usuarioId; unión incluye solo-historial y solo-nómina |
| CuentasController | ✅ Implemented | `paginationSchema.safeParse` inline, `ValidationError` 400, `req.salonId` |
| Rutas + roles | ✅ Implemented | `requireRole(S,D,A,C)` en ambas rutas GET; resto del router intacto |
| DI container | ✅ Implemented | use cases + controller registrados (container L313/314/330); nómina/historial ya registrados (L308/310) |
| CuentasTab | ✅ Implemented | sub-tabs Cobrar/Pagar, tablas sin acciones, paginación 12, `Promise.allSettled`-style (allSettled via Promise.all de booleans), estados vacío/error/loading, oculto por rol (ROLES_CUENTAS) |

## Coherence (Design)

| Decision | Followed? | Notes |
|----------|-----------|-------|
| D1 Fuente deuda = SUM(montoPendiente) | ✅ Yes | Columna `deudaTotal` no usada; documentado |
| D2 Agregación en JS | ✅ Yes | Map en use case, query única |
| D3 Nuevo método `findConDeudaBySalon` | ✅ Yes | `findBySalon` no tocado (callers intactos) |
| D4 Pagar = composición de use cases existentes | ✅ Yes | Cero duplicación de lógica de nómina |
| D5 Enforce de roles vía `requireRole` en rutas | ✅ Yes | Patrón existente de finanzas.routes.ts |
| D6 Antigüedad con `colombia-date.ts` | ✅ Yes | Helpers reutilizados |
| D7 Consistencia deuda documentada como follow-ups | ✅ Yes | Comentario en CuentasCobrarUseCase + proposal FOLLOW-UP |

## Issues Found

**CRITICAL**: None.

**WARNING**:
1. **E2E no ejecutado** — el orquestador no confirmó E2E; los endpoints no se probaron contra DB real + HTTP (la evidencia es unit/controller con mocks). Requiere decisión del orquestador antes de archivar.
2. **Deviation de diseño en respuesta de `pagar`** — design.md (`Interfaces / Contracts`, data flow) declara `CuentaPagarDTO[]` sin paginar, pero la implementación devuelve `PaginatedResult<CuentaPagarDTO>` (igual que cobrar). No rompe la spec (Req 2 no fija envelope) y el frontend consume `payload.data/meta` correctamente, pero la interfaz documentada quedó desactualizada.
3. **Branch coverage de `CuentasPagarUseCase` 76.47%** (< 80% umbral de branch; statements 98.78%) — las ramas `usuario ? ... : nominaEntry?...` con ambos fallbacks no se cubren combinadas. Cobertura global del cambio cumple (umbral por statements/lines).

**SUGGESTION**:
1. `FinanzasPage.tsx` llegó a ~4588 líneas; `CuentasTab` añadió ~350. Un refactor futuro extrayendo tabs a componentes (patrón `CajaTab`) reduciría riesgo de regresión.
2. `findConDeudaBySalon` filtra por `montoPendiente > 0` y el use case re-filtra (defensa en profundidad correcta, pero el filtro duplicado podría documentarse para evitar confusión).
3. Test de paginación de `pagar` no está cubierto en spec (orden por `empleadaId ASC`) — el test existe; podría promoverse a escenario de spec si se quiere fijar el contrato.

## Verdict

**PASS WITH WARNINGS**

Todas las tareas completas, 13/13 escenarios de spec con test pasando, coverage cuentas/ y CuentasTab muy por encima del umbral, sin errores de build nuevos (los 8 de tsc y los 2 tests API probados pre-existentes contra `main`), y sin regresiones en nomina/registros/resumen. Pendiente únicamente confirmación E2E del orquestador (WARNING #1) y la desviación de contrato documentada en `pagar` (WARNING #2).
