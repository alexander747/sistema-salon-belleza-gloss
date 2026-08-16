# Verify Report — frecuencia-pago

**Change**: frecuencia-pago (PR1 Cuentas UX + PR2 frecuenciaPago)
**Version**: N/A
**Mode**: Standard (strict TDD not declared)
**Branch**: `feat/frecuencia-pago` @ `d9e9ed3`
**Date**: 2026-08-16

## Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 18 (PR1 1.1–1.3 · PR2 2.1–2.6, 3.1–3.4, 4.1–4.3, 5.1–5.5, 6.1–6.3) |
| Tasks complete | 17 |
| Tasks incomplete | 1 — 6.3 (flujo manual E2E; NO confirmado por el orquestador) |

## Build & Tests Execution

**Build**: ✅ Passed (solo errores pre-existentes en ambos typechecks)

```text
cd apps/api && npx tsc --noEmit        → 3 errores pre-existentes, NINGUNO en archivos del cambio:
  - src/infrastructure/persistence/seed.ts(238,23)
  - src/modules/finanzas/application/use-cases/registro/__tests__/CreateRegistroUseCase.test.ts(86,9)
  - src/modules/finanzas/application/use-cases/registro/__tests__/RegistroServicioItemDTO.test.ts(3,44)

cd apps/pos-dashboard && npx tsc --noEmit → 5 errores pre-existentes, NINGUNO en archivos del cambio:
  - AgendaPage.tsx (3), DashboardPage.tsx(335), ServiciosPage.tsx(372)
```

**Tests API**: ✅ 344 passed / ❌ 2 failed (RegistroController.test.ts ×2 — pre-existentes, archivo no tocado)
```text
npx vitest run → Test Files 1 failed | 57 passed (58); Tests 2 failed | 344 passed (346)
Fallos: RegistroController.list "should return 200 with registros" + "should pass filter params" (spy 0 calls)
CajaCerradaFlows: no falló en esta corrida (flaky conocido, verde aquí)
```
Suites del área del cambio: NominaPendiente 13/13, LiquidarEmpleada 15/15, personas.schema 4/4, CreateEmpleada 3/3, UpdateEmpleada 3/3, EmpleadaDTO 4/4 — **todas verdes**.

**Tests Dashboard**: ✅ 66 passed / 0 failed (8 files, incluye CajaCerradaFlows)
```text
npx vitest run → Test Files 8 passed (8); Tests 66 passed (66)
FinanzasPage 25/25 (badge Al día + card período), EmpleadasPage 8/8 (4 nuevos de frecuenciaPago)
```

**Coverage** (objetivo ≥80% código nuevo): ✅

| Archivo | % Lines | Detalle |
|---------|---------|---------|
| NominaPendienteUseCase.ts | 100% (181/181) | período + factor 50% + guard |
| LiquidarEmpleadaUseCase.ts | 99.1% (221/223) | factor 50% en comp fijo |
| CreateEmpleadaUseCase.ts | 100% (63/63) | |
| UpdateEmpleadaUseCase.ts | 86.1% (62/72) | |
| EmpleadaDTO.ts | 88.7% (47/53) | máscara DUEÑA/ADMIN |
| EmpleadasPage.tsx | 90.6% stmts | select + badge frecuencia |
| FinanzasPage CuentasTab (código nuevo) | badge 28/28 (100%) · sort 15/16 (94%) | |
| FinanzasPage NominaTab handleLiquidar (código nuevo) | 1/11 | ⚠️ sin test de componente (ver WARN-1) |

## Spec Compliance Matrix

### finanzas-liquidacion (13 escenarios)

| Requisito | Escenario | Test | Resultado |
|-----------|-----------|------|-----------|
| Frecuencia de pago por empleada | Crear empleada quincenal | `CreateEmpleadaUseCase.test.ts > should pass frecuenciaPago through` | ✅ COMPLIANT |
| Frecuencia de pago por empleada | Default MENSUAL | `personas.schema.test.ts > defaults frecuenciaPago to MENSUAL` + `EmpleadasPage.test.tsx > envía frecuenciaPago MENSUAL por defecto` | ✅ COMPLIANT |
| Frecuencia de pago por empleada | Valor inválido rechazado | `personas.schema.test.ts > rejects SEMANAL` (rechazo ✓) — status HTTP es **400**, spec dice **422** | ⚠️ PARTIAL |
| Período según frecuencia | Quincena primera mitad (día 10 → 1..15) | `NominaPendienteUseCase.test.ts > QUINCENAL día 10` | ✅ COMPLIANT |
| Período según frecuencia | Quincena segunda mitad (día 20 → 16..31) | `> QUINCENAL día 20` (assert periodoInicio/Fin + guard [16,31]) | ✅ COMPLIANT |
| Período según frecuencia | Mensual preserva comportamiento | `> MENSUAL día 10` (período [1,hoy], registros sin filtro, comp 100%) | ✅ COMPLIANT |
| Sueldo fijo quincenal = 50% | Quincenal paga mitad (125000; registra 100000/25000) | `NominaPendiente > QUINCENAL sin registros` + `LiquidarEmpleada > liquida QUINCENAL registrando 50%` | ✅ COMPLIANT |
| Sueldo fijo quincenal = 50% | Mensual paga el fijo completo (250000) | `NominaPendiente > incluye empleada con solo sueldo fijo` + `> MENSUAL día 10` | ✅ COMPLIANT |
| Guard anti-doble-pago por período | Quincenal liquidada en la 1ª quincena (hoy=20) | `> QUINCENAL día 20` (findBySalonEmpleadaAndPeriodo llamado con quincena 16-31) | ✅ COMPLIANT |
| Guard anti-doble-pago por período | Mensual sin registros nuevos | `> excluye empleada ya liquidada en el período sin registros nuevos` | ✅ COMPLIANT |
| GET Nómina Pendiente (MOD) | Pendiente con múltiples registros (298000) | Composición cubierta: `> incluye una manicurista` (comisión+propina) + `> solo sueldo fijo` (comp fijo); fixture exacta del escenario no existe | ⚠️ PARTIAL |
| GET Nómina Pendiente (MOD) | Pendiente con no registros (0/0) | `> incluye empleada con solo sueldo fijo` (asserts 0/0) | ✅ COMPLIANT |
| GET Nómina Pendiente (MOD) | Quincenal con registros (130000, 1-15) | `> QUINCENAL día 10` (misma composición, fixture numérica distinta: 137000) | ⚠️ PARTIAL |

### finanzas-cuentas (3 escenarios)

| Requisito | Escenario | Test | Resultado |
|-----------|-----------|------|-----------|
| Badge "Al día" + orden | Empleada al día con historial | `FinanzasPage.test.tsx > muestra badge "Al día"...` — badge ✓ y liquidadoAcumulado ✓; **el orden DOM (Sofía después de María) NO se asevera** | ⚠️ PARTIAL |
| Badge "Al día" + orden | Sin badge cuando hay pendiente | Renders de María se verifican (monto 298000) pero ausencia de badge NO se asevera explícitamente | ⚠️ PARTIAL |
| Badge "Al día" + orden | Todas al día | (ningún test con fixture 100% pendienteActual=0) | ❌ UNTESTED (ver CRIT-1) |

**Compliance summary**: 10/14 escenarios completamente compliant, 4 parciales, 1 untested. La lógica subyacente del badge (condicional `pendienteActual > 0`) está 100% cubierta por los tests existentes — las brechas son de aserción/fixture, no de código.

## Correctness (Static Evidence)

| Requisito | Estado | Notas |
|-----------|--------|-------|
| Migración 0012 | ✅ Implementado | `ALTER TABLE usuarios ADD frecuenciaPago VARCHAR(20) NOT NULL DEFAULT 'MENSUAL'`; down = DROP COLUMN |
| `FrecuenciaPago` union + IUser | ✅ Implementado | `packages/types/src/user.ts`; exportado en index; **dist rebuild** (18:43 hoy) |
| UsuarioEntity columna | ✅ Implementado | varchar 20, default 'MENSUAL' |
| Schema Zod | ✅ Implementado | create `.optional().default('MENSUAL')` (orden correcto documentado en comentario); update `.optional()`; **dist rebuild** (18:34 hoy) verificado con el default compilado |
| Create/Update empleada | ✅ Implementado | `frecuenciaPago` en input + paso al repo (patrón frecuenciaBono) |
| EmpleadaDTO máscara | ✅ Implementado | DUEÑA/ADMIN expone, otros null |
| Período por empleada (D3) | ✅ Implementado | `calcularPeriodo()` con `colombia-date.ts`; MENSUAL 1→hoy; QUINCENAL 1-15 / 16-último |
| MENSUAL byte-idéntico (D5) | ✅ Implementado | Filtro de registros por período SOLO en QUINCENAL; tests existentes pasan **sin cambios de aserción** (solo se agregó default `frecuenciaPago: 'MENSUAL'` al fixture + describe nuevo) |
| Factor 50% ambos use cases (D4) | ✅ Implementado | `FACTOR_FIJO_QUINCENAL = 0.5` en NominaPendiente Y LiquidarEmpleada (L114-116) — historial no deriva |
| Guard por período de la empleada (D6) | ✅ Implementado | `findBySalonEmpleadaAndPeriodo` con `periodoInicio/Fin` de la empleada; MENSUAL conserva semántica (equivalencia probada: toda liquidación existente está en [1,hoy] ⊆ [1,fin-mes]) |
| EmpleadasPage form | ✅ Implementado | select con `aria-label="Frecuencia de pago"`, EMPTY_FORM 'MENSUAL', buildPayload, openEdit precarga, badge Pago (L692-693) |
| FinanzasPage NominaTab | ✅ Implementado | `NominaEmpleado` +3 campos; card "Período {frec} · inicio → fin" (L2777) con `formatPeriodoFecha` (resta 1 día en esFin para límite exclusivo); handleLiquidar usa `emp.periodoInicio/Fin` con fallback a mes actual |
| FinanzasPage CuentasTab | ✅ Implementado | badge verde "Al día" (L4599-4626); sort client-side pendientes primero / al día al final (L4419-4430) |

## Coherence (Design)

| Decisión | ¿Seguida? | Notas |
|----------|-----------|-------|
| D1 varchar(20) NOT NULL DEFAULT 'MENSUAL' | ✅ Sí | Migración + entidad |
| D2 Máscara DUEÑA/ADMIN en DTO | ✅ Sí | EmpleadaDTO L37-49 |
| D3 colombia-date.ts | ✅ Sí | `getColombiaDateString` + `colombiaDayStart/EndUTC` |
| D4 Factor 0.5 en ambos use cases | ✅ Sí | NominaPendiente y LiquidarEmpleada |
| D5 MENSUAL sin filtro de período | ✅ Sí | `if (frecuenciaPago === 'QUINCENAL')` |
| D6 Guard con período de la empleada | ✅ Sí | Assert en tests QUINCENAL |
| Testing: vi.useFakeTimers + setSystemTime | ✅ Sí | 10/08 → [1,15], 20/08 → [16,31], MENSUAL → [1,10] |
| Testing: combobox → getByLabelText | ✅ Sí | EmpleadasPage.test.tsx usa `getByLabelText('Rol')` y `getByLabelText('Frecuencia de pago')` |

## Issues Found

**CRITICAL**:
- CRIT-1 (UNTESTED, brecha de test — no defecto de código): Escenario finanzas-cuentas "Todas al día" no tiene test que cubra el caso 100% `pendienteActual=0`. El código del badge está 100% cubierto (mismo condicional que escenarios 1-2); falta la fixture. Un test con `cuentasResponse([{pendienteActual: 0}, {pendienteActual: 0}])` cierra la brecha.

**WARNING**:
- WARN-1: `handleLiquidar` de FinanzasPage (wiring de `emp.periodoInicio/periodoFin` hacia el body, L2498-2510) tiene cobertura de componente 1/11 líneas — sin test que abra el modal de liquidar y verifique el body. Solo verificado estáticamente + cobertura del use case en API.
- WARN-2: Spec finanzas-liquidacion "Valor inválido rechazado" dice **422**; la plataforma responde **400** (`ValidationError` en `shared/errors.ts` L51-55, convención pre-existente NO tocada por el cambio). El rechazo funciona y está testeado; el status difiere del spec.
- WARN-3: Tarea 6.3 (flujo manual E2E) incompleta — pendiente confirmación del orquestador (ya conocido).
- WARN-4: El orden "pendientes primero / al día al final" de CuentasTab NO se asevera en ningún test; la fixture del mock ya devuelve María antes que Sofía, así que el sort es no-op en los tests. Un test con fixture desordenada validaría el orden real.

**SUGGESTION**:
- SUG-1: Añadir test de orden: mock devuelve `[Sofía(pendiente 0), María(298000)]` y aseverar que el primer `<tr>` es María.
- SUG-2: En `FinanzasPage.test.tsx`, aseverar explícitamente que la fila de María NO contiene el badge (`queryByText(/al día/i)` null).

## Verdict

**PASS-WITH-ISSUES**

Implementación cumple spec + design en código (14/14 requisitos implementados, 2/2 PRs, 17/18 tasks). Todos los tests nuevos pasan, builds limpios (solo errores pre-existentes), cobertura del código nuevo ≥80% salvo el wiring de handleLiquidar (WARN-1). Las brechas restantes son de test (CRIT-1, WARN-1, WARN-4) y una discrepancia de status HTTP 400 vs 422 heredada de la plataforma (WARN-2). E2E manual (6.3) pendiente de confirmación del orquestador.
