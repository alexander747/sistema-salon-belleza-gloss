# Design: Nómina para Todos los Roles

## Technical Approach

Backend-first: ajustar los 2 use cases de liquidación sin tocar interfaces ni migraciones. `IUsuarioRepository.findBySalon(salonId, rol?, activo?, q?)` ya acepta omitir rol (devuelve todos los usuarios del salón; SUPERADMIN con `salonId=null` queda fuera por el `where`). Luego frontend MIXTO en EmpleadasPage. TDD estricto (`strict_tdd: true` en config): tests RED → GREEN.

## Architecture Decisions

| Decisión | Opciones | Rationale |
|---|---|---|
| Omitir rol en `findBySalon(salonId, undefined, true)` | (a) omitir rol; (b) array de roles en repo (cambia interfaz + `where IN`); (c) llamada por rol y merge (N+1) | Interfaz ya soporta rol opcional; cero cambios en TypeORMUsuarioRepository; SUPERADMIN excluido por `where.salonId` |
| Excluir CONTADOR en el use case (`if (empleada.rol === Rol.CONTADOR) continue;`) | (a) filter en use case; (b) exclusión en repo (`NOT IN`) | CONTADOR es regla de negocio solo para nómina; otros callers (`/empleadas`, selectores) SÍ lo incluyen. La regla vive en el caso de uso |
| Skip condicional: `0 registros && sueldoFijo<=0 && bonoHorario<=0 → continue` | (a) skip condicional; (b) siempre incluir y filtrar en frontend | Evita filas fantasma (DUEÑA 0/0); contrato: pendientes = liquidable |
| Mantener guard anti-doble-pago existente (L78-94 Liquidar / L64-81 Nomina) | (a) sin cambios; (b) guard nuevo por sueldoFijo | Con 0 registros, `soloRegistrosViejos = [].every(...) = true` → ya liquidada en período → error/skip. Guard probado correcto para el caso 0-registro |

## Data Flow

    GET /salones/:id/finanzas/nomina
      → NominaPendienteUseCase.execute({salonId})
      → findBySalon(salonId, undefined, true)      [todos los roles activos]
      → filter empleada.rol !== CONTADOR
      → por empleada: registros no pagados (no ANULADO)
      → skip si 0 registros Y fijo<=0 Y bono<=0
      → liquidaciones del período: si existen, solo registros posteriores (anti-doble-pago)
      → push {comisiones, propinas, bonoHorario, sueldoFijo, totalAPagar}

    POST /salones/:id/finanzas/nomina/liquidar
      → LiquidarEmpleadaUseCase.execute
      → empleada + registros del período no pagados
      → throw SOLO si 0 registros Y fijo<=0 Y bono<=0
      → guard: liquidación previa + 0 registros nuevos → 409/422
      → calculatedTotal = comisiones + propinas + bonoHorario + sueldoFijo (0 registros → solo fijo)

## File Changes

| File | Acción | Descripción |
|---|---|---|
| `apps/api/src/modules/finanzas/application/use-cases/liquidacion/NominaPendienteUseCase.ts` | Modificar | `findBySalon(salonId, undefined, true)`; filter CONTADOR; skip condicional (L60-62) |
| `apps/api/src/modules/finanzas/application/use-cases/liquidacion/LiquidarEmpleadaUseCase.ts` | Modificar | L67-69: `throw` condicional (0 registros Y fijo<=0 Y bono<=0) |
| `apps/api/src/modules/finanzas/application/use-cases/liquidacion/__tests__/NominaPendienteUseCase.test.ts` | Crear | 6 escenarios (ver Testing) |
| `apps/api/src/modules/finanzas/application/use-cases/liquidacion/__tests__/LiquidarEmpleadaUseCase.test.ts` | Crear | mock AppDataSource (patrón CreateRegistroUseCase.test.ts) |
| `apps/pos-dashboard/src/pages/EmpleadasPage.tsx` | Modificar | tipoPago 3 estados (L36); openEdit detecta MIXTO (L227); buildPayload (L250-251); toggle + inputs (L873-918); columna Pago |
| `apps/pos-dashboard/src/pages/__tests__/EmpleadasPage.test.tsx` | Crear | MIXTO → payload ambos campos |
| `openspec/specs/finanzas-liquidacion/spec.md` | Modificar | merge del delta al archivar |

## Interfaces / Contracts

Sin cambios de interfaz. `IUsuarioRepository.findBySalon` queda igual (rol opcional).

Payload empleada (buildPayload):
```ts
porcentajeComisionServicio: (tipoPago === 'COMISION' || tipoPago === 'MIXTO') ? Number(porcentajeComisionServicio) : 0,
sueldoFijo: (tipoPago === 'FIJO' || tipoPago === 'MIXTO') ? Number(sueldoFijo) : 0,
```

## Testing Strategy

| Capa | Qué | Cómo |
|---|---|---|
| Unit (api) | NominaPendienteUseCase | Constructor con fakes (`as never`); casos: manicurista incluida; solo-sueldo incluido; CONTADOR excluido; DUEÑA con config incluida; DUEÑA 0/0 excluida; ya-liquidada skip |
| Unit (api) | LiquidarEmpleadaUseCase | Mock `shared/database.js` (queryRunner.manager.getRepository) + fakes; casos: fijo-solo liquida 201; 0 registros+0 fijo lanza; doble-pago lanza |
| Unit (dashboard) | EmpleadasPage form | Render con api mock (patrón FinanzasPage.test.tsx); MIXTO → ambos campos; exclusivos anulan |

Comandos: `cd apps/api && npx tsc --noEmit && npx vitest run` · `cd apps/pos-dashboard && npx vitest run`

## Migration / Rollout

Sin migración. Deploy único (backend → frontend). Retro-compatible: empleadas con 0 config y 0 registros siguen excluidas; MIXTO es opt-in del formulario.

## Open Questions

- [ ] Reliquidación parcial (registros nuevos tras liquidación previa en el mes) vuelve a sumar sueldoFijo en `calculatedTotal` — comportamiento PRE-EXISTENTE, fuera de alcance; requiere decisión de negocio separada.
