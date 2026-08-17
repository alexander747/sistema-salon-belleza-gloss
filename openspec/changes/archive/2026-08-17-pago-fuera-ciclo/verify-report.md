# Verification Report: pago-fuera-ciclo

**Change**: pago-fuera-ciclo (frecuencia SEMANAL + período editable en modal de auditoría)
**Version**: spec finanzas-liquidacion (delta)
**Mode**: Standard (Strict TDD no activo)
**Branch**: feat/pago-fuera-ciclo @ 904937f

## Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 13 (1.1-1.3, 2.1-2.4, 3.1-3.7, 4.1-4.5, 5.1-5.2) |
| Tasks complete | 12 |
| Tasks incomplete | 1 (5.2 flujo manual — E2E pendiente de confirmación del orquestador) |

## Build & Tests Execution

**Build (typecheck)**: ⚠️ Passed with pre-existing errors only
```text
apps/api:        npx tsc --noEmit → 3 errores, TODOS en archivos NO tocados por el cambio
                 (seed.ts:238, CreateRegistroUseCase.test.ts:86, RegistroServicioItemDTO.test.ts:3)
apps/pos-dashboard: npx tsc --noEmit → 5 errores, TODOS en archivos NO tocados por el cambio
                 (AgendaPage.tsx ×3, DashboardPage.tsx:335, ServiciosPage.tsx:372)
Ninguno de los 15 archivos del diff produce error de tipo.
```

**Tests**: ✅ API 350 passed / 2 failed (pre-existing) · ⚠️ Dashboard 71-72 passed / 1-2 failed (pre-existing + flake)
```text
apps/api:        npx vitest run → 350 passed | 2 failed (RegistroController.test.ts: list×2)
apps/pos-dashboard: npx vitest run → 71-72 passed | 1-2 failed (CajaBanner ×1 estable; CajaCerradaFlows ×1 flaky)
Pre-existing confirmado en worktree de main (dacadb4):
  - RegistroController.test.ts: 2 failed en main (idénticos)
  - CajaBanner.test.tsx: 1 failed en main (idéntico)
  - CajaCerradaFlows.test.tsx: pasa en main y pasa 3/3 en aislamiento en la branch (flake de suite completa;
    archivo no tocado por el cambio)
Suites relevantes al cambio: NominaPendienteUseCase (17/17), LiquidarEmpleadaUseCase (16/16),
personas.schema (all pass), FinanzasPage (29/29), EmpleadasPage (11/11).
```

**Coverage (nuevo código)**: ✅ Above 80%
```text
apps/api (scoped a liquidacion/*.ts): 94.36% stmts / 93.67% branch / 94.36% lines
  NominaPendienteUseCase.ts  100% stmts · 96.96% branch · 100% lines
  LiquidarEmpleadaUseCase.ts  99.11% stmts · 93.33% branch · 99.11% lines
apps/pos-dashboard (FinanzasPage + EmpleadasPage con sus suites):
  EmpleadasPage.tsx  90.64% lines (nuevo código cubierto por 3 tests nuevos)
  FinanzasPage.tsx   62.41% lines globales (archivo pre-existente enorme) — NUEVO código ≈ 93%
                     (88/95 líneas nuevas cubiertas; 7 sin cubrir: 2632 catch del fetch,
                     3153-3155 reset del botón Cerrar, 3938-3940 reset del botón Cancelar)
```

## Spec Compliance Matrix

| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| Período editable | Modal precarga el período calculado | `FinanzasPage.test.tsx > precarga Desde/Hasta con el período de la fila pendiente` | ✅ COMPLIANT |
| Período editable | Editar período re-filtra el detalle | `FinanzasPage.test.tsx > muestra solo los registros del período por defecto y re-filtra al editar Hasta` | ✅ COMPLIANT |
| Período editable | Confirmar envía el período editado | `FinanzasPage.test.tsx > confirmar la liquidación envía el período EDITADO en bordes Colombia (T05:00:00.000Z)` — asserts `periodoInicio=2026-08-01T05:00:00.000Z`, `periodoFin=2026-08-21T05:00:00.000Z` | ✅ COMPLIANT |
| Período editable | Solapamiento con liquidación previa | `FinanzasPage.test.tsx > avisa si el período editado se solapa con una liquidación previa del historial` | ✅ COMPLIANT |
| Frecuencia de pago | Crear empleada quincenal (regresión) | `personas.schema.test.ts > accepts QUINCENAL on create` + suite existente | ✅ COMPLIANT |
| Frecuencia de pago | Crear empleada semanal | `personas.schema.test.ts > accepts SEMANAL on create` + `EmpleadasPage.test.tsx > envía frecuenciaPago SEMANAL al crearla` | ✅ COMPLIANT |
| Frecuencia de pago | Default MENSUAL | `personas.schema.test.ts > defaults frecuenciaPago to MENSUAL when absent` | ✅ COMPLIANT |
| Frecuencia de pago | Valor inválido rechazado (422) | `personas.schema.test.ts > rejects ANUAL on create/update` (zod parse throw; mapeo HTTP 422 es middleware `validate()` pre-existente) | ✅ COMPLIANT |
| Período de nómina | Quincena 1ª mitad (regresión) | `NominaPendienteUseCase.test.ts > QUINCENAL día 10` | ✅ COMPLIANT |
| Período de nómina | Quincena 2ª mitad (regresión) | `NominaPendienteUseCase.test.ts > QUINCENAL día 20` | ✅ COMPLIANT |
| Período de nómina | Semana a mitad (jueves 13/08) → [10,16] | `NominaPendienteUseCase.test.ts > SEMANAL jueves 13/08` (colombiaDayStartUTC/EndUTC) | ✅ COMPLIANT |
| Período de nómina | Semana el lunes (17/08) → [17,23] | `NominaPendienteUseCase.test.ts > SEMANAL lunes 17/08` | ✅ COMPLIANT |
| Período de nómina | Mensual preserva comportamiento | `NominaPendienteUseCase.test.ts > MENSUAL día 10 (registros NO filtrados)` | ✅ COMPLIANT |
| Sueldo fijo | Quincenal 50% (regresión) | `NominaPendienteUseCase.test.ts > QUINCENAL sin registros → totalAPagar=125000` | ✅ COMPLIANT |
| Sueldo fijo | Semanal 25% | `NominaPendienteUseCase.test.ts > totalAPagar=62500` + `LiquidarEmpleadaUseCase.test.ts > sueldoFijo=50000, bonoHorario=12500` | ✅ COMPLIANT |
| Sueldo fijo | Mensual 100% (regresión) | suite existente MENSUAL | ✅ COMPLIANT |
| Guard anti-doble-pago | Quincenal 1ª quincena (regresión) | suite existente QUINCENAL | ✅ COMPLIANT |
| Guard anti-doble-pago | Semana liquidada sin registros nuevos | `NominaPendienteUseCase.test.ts > SEMANAL liquidada esta semana sin registros nuevos → no aparece` (guarda consulta semana: assert sobre `findBySalonEmpleadaAndPeriodo` con [10,16]) | ✅ COMPLIANT |
| Guard anti-doble-pago | Mensual sin registros nuevos (regresión) | suite existente MENSUAL | ✅ COMPLIANT |
| (checklist) | Registro fuera de semana excluido | `NominaPendienteUseCase.test.ts > SEMANAL filtra registros fuera de la semana` (registro 19/08 excluido) | ✅ COMPLIANT |

**Compliance summary**: 19/19 scenarios del spec con test que pasa en runtime (0 UNTESTED, 0 FAILING).

## Correctness (Static Evidence)

| Requirement | Status | Notes |
|------------|--------|-------|
| `FrecuenciaPago` incluye SEMANAL | ✅ Implementado | `packages/types/src/user.ts:12` |
| z.enum SEMANAL create+update | ✅ Implementado | `personas.schema.ts:23,43` + **dist rebuild confirmado** (`dist/personas.schema.js` contiene SEMANAL) |
| `calcularPeriodo` rama SEMANAL lunes→domingo | ✅ Implementado | ancla `T12:00:00Z` + `getUTCDay()`, `colombiaDayStartUTC/EndUTC` (D1) |
| Factor 0.25 en NominaPendiente | ✅ Implementado | `FACTOR_FIJO_SEMANAL=0.25` (L34), factor L181-186 |
| Factor 0.25 en LiquidarEmpleada | ✅ Implementado | `factorFijo` L115-116 |
| Filtro de registros por período incluye SEMANAL | ✅ Implementado | L136 `QUINCENAL \|\| SEMANAL` (D3) |
| Modal: estado auditarAllRegistros + período editable | ✅ Implementado | `auditarAllRegistros`, `auditDesde/auditHasta` (L2372-2378) |
| Re-filtro client-side + totales useMemo | ✅ Implementado | `auditarRegistros`/`auditarTotales` useMemo (D5) |
| Confirm envía período editado en bordes T05:00:00.000Z | ✅ Implementado | L2652-2653 (`hasta` inclusive + 1 día, colombiaDayEndUTC) |
| Aviso solapamiento vs historial | ✅ Implementado | `liquidacionSolapada` useMemo + bloque `role="alert"` (D6) |
| EmpleadasPage: opción Semanal + openEdit passthrough | ✅ Implementado | option SEMANAL L928; passthrough 3 valores L239 |
| Rutas aplican schemas | ✅ Implementado | `personas.routes.ts:27,33` `validate(create/updateEmpleadaSchema)` |
| MENSUAL/QUINCENAL byte-idénticos | ✅ Verificado | ramas pre-existentes intactas; suites de regresión pasan |

## Coherence (Design)

| Decision | Followed? | Notes |
|----------|-----------|-------|
| D1 Cálculo semana (ancla 12:00Z + getUTCDay) | ✅ Yes | `calcularPeriodo` L62-64 |
| D2 Factor 25% en ambos use cases | ✅ Yes | NominaPendiente con constante; LiquidarEmpleada inline (estilo pre-existente del archivo, según tabla File Changes del design "mantener 1/0.5") |
| D3 SEMANAL filtra por período | ✅ Yes | L136 |
| D4 Inputs date + bordes T05:00:00.000Z | ✅ Yes | `auditDesde/auditHasta` + body L2652-2653 |
| D5 Totales recalculados (useMemo) | ✅ Yes | `auditarTotales` |
| D6 Aviso client-side (sin cambio de semántica backend) | ✅ Yes | `liquidacionSolapada` + alert |
| D7 z.enum en create+update + rebuild dist | ✅ Yes | dist verificado con SEMANAL |

## Issues Found

**CRITICAL**: None

**WARNING**:
1. Task 5.2 (flujo manual: crear SEMANAL → nómina semana+25% → auditoría con período editado → liquidar) NO completada — el orquestador aún no confirmó el E2E. Es verificación manual, no implementación.
2. Fallos pre-existentes fuera del alcance del cambio (confirmados en baseline `main`): `RegistroController.test.ts` (2, API) y `CajaBanner.test.tsx` (1, dashboard) fallan también en main; `CajaCerradaFlows.test.tsx` es flaky bajo la suite completa (pasa en aislamiento). No son introducidos por esta rama.

**SUGGESTION**:
1. Líneas de reset de los botones Cerrar/Cancelar del modal (3153-3155, 3938-3940) y el catch del fetch de registros (2632) quedan sin cobertura directa — triviales, pero un test de cierre del modal las cerraría.
2. La escena "ANUAL → 422" se verifica a nivel zod (`.toThrow()`); un test de controller HTTP con 422 explícito sería más fiel a la escena (patrón actual del repo usa el nivel schema).
3. `LiquidarEmpleadaUseCase` podría usar la constante `FACTOR_FIJO_SEMANAL` compartida en lugar del 0.25 inline para evitar drift futuro (estilo pre-existente actualmente).

## Verdict

**PASS WITH WARNINGS**
19/19 escenarios del spec con test pasando en runtime; typecheck y suites sin errores nuevos (fallos pre-existentes confirmados en baseline); cobertura de código nuevo ≥93% (≥80%). Única tarea pendiente: E2E manual 5.2, que depende del orquestador. `next: ready-for-archive` tras confirmar E2E, o archivo directo si el E2E se delega por separado.
