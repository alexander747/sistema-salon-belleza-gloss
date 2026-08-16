# Proposal: Nómina para Todos los Roles (nomina-todos-roles)

## Intent

La nómina pendiente solo incluye MANICURISTAS con registros sin pagar. Empleadas con solo `sueldoFijo` quedan fuera (BUG: `continue` en L60), y RECEPCIONISTA / ADMINISTRADOR / DUEÑA nunca aparecen aunque el salón les pague. Se requiere nómina completa para todo rol pagado por el salón + modo de pago MIXTO en el formulario.

## Scope

**In:**
- Nómina pendiente incluye roles pagados por el salón: MANICURISTA, RECEPCIONISTA, ADMINISTRADOR, DUEÑA (paga su propio sueldo; ganancia aparte)
- Empleada con solo `sueldoFijo` (0 registros pendientes) aparece y es liquidable
- Excluir CONTADOR (no lo paga el salón); SUPERADMIN excluido naturalmente (`salonId` null)
- Frontend MIXTO (`sueldoFijo` + `porcentaje` simultáneos) + tests de ambos use cases y formulario

**Out:**
- Cambios de endpoints (solo cambia comportamiento, no superficie)
- Migraciones / esquema (columnas existen, son independientes)
- Cambios en `IUsuarioRepository` (ya soporta omitir rol)
- Historial, reportes, exportación

## Capabilities

- **New**: None
- **Modified**: `finanzas-liquidacion` — roles incluidos, 0 registros liquidable, MIXTO

## Approach

Backend-first (API-first):
1. `NominaPendienteUseCase`: `findBySalon(salonId, undefined, true)` + excluir CONTADOR + skip solo si 0 registros **Y** fijo<=0 **Y** bono<=0
2. `LiquidarEmpleadaUseCase`: error solo si 0 registros **Y** fijo<=0 **Y** bono<=0; guard anti-doble-pago intacto (`.every()` vacío → ya liquidada → error)
3. `EmpleadasPage`: `tipoPago: 'COMISION' | 'FIJO' | 'MIXTO'`; payload setea ambos campos en MIXTO
4. Tests RED→GREEN para ambos use cases + formulario

## API Surface & Data Model

Sin cambios de endpoints (`GET/POST /finanzas/nomina`, `GET /nomina/historial` conservan request/response) ni de esquema: `usuarios.sueldoFijo`, `bonoHorario`, `porcentajeComisionServicio` ya soportan MIXTO (columnas independientes). Cambia solo el contenido de la respuesta.

## Risks

| Riesgo | Prob | Mitigación |
|---|---|---|
| Doble pago de sueldo fijo | Low | Guard L78-94 existente + tests |
| DUEÑA "fantasma" (0 config, 0 registros) | Low | Skip condicional fijo/bono <= 0 |
| Masking EmpleadaDTO | None | Endpoint nómina devuelve DTO del use case (sin masking) |
| Regresión frontend | Med | Test formulario MIXTO + verificación manual |

## Rollback

Revertir los 2 use cases y quitar `MIXTO` de `tipoPago`. Sin migración ni cambio de interfaz → git revert limpio.

## Dependencies

- Ninguna externa. `@pos-final/types` Rol ya incluye todos los roles.

## Success Criteria

- [ ] Nómina incluye RECEPCIONISTA/ADMINISTRADOR/DUEÑA con sueldoFijo; excluye CONTADOR
- [ ] Solo-sueldo aparece y liquida 201; 0 registros con fijo=0 lanza 4xx; doble pago bloqueado
- [ ] Formulario MIXTO persiste ambos campos
- [ ] Tests api + dashboard pasan; coverage ≥ 80%

## Size & File Plan

~350-450 líneas → **single PR** (< 800).

**Nuevos:** `__tests__/NominaPendienteUseCase.test.ts`, `__tests__/LiquidarEmpleadaUseCase.test.ts` (use-cases/liquidacion), `EmpleadasPage.test.tsx`.

**Modificados:** `NominaPendienteUseCase.ts`, `LiquidarEmpleadaUseCase.ts`, `EmpleadasPage.tsx`, `specs/finanzas-liquidacion/spec.md` (merge del delta).
