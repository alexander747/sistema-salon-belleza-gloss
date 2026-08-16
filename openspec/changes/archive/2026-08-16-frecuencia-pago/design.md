# Design: Frecuencia de Pago por Empleada (MENSUAL/QUINCENAL)

## Technical Approach

PR1 (Cuentas UX) es puramente de cliente: badge + orden en `FinanzasPage.tsx` CuentasTab. PR2 agrega `frecuenciaPago` siguiendo el precedente exacto de `frecuenciaBono` en toda la pila, y parametriza `NominaPendienteUseCase` para calcular el período por empleada con `colombia-date.ts`. El comp fijo usa un factor por frecuencia. Guard anti-doble-pago recibe el período de la empleada.

## Architecture Decisions

| # | Decision | Optiones | Decisión | Rationale |
|---|----------|----------|----------|-----------|
| D1 | Almacenamiento | Enum int vs varchar | varchar(20) NOT NULL DEFAULT 'MENSUAL' | Mismo patrón que `frecuenciaBono`; backfill trivial; sin enum en DB |
| D2 | Exposición DTO | Siempre vs máscara | Máscara DUEÑA/ADMIN como `frecuenciaBono` | Dato de compensación sensible; consistencia con L36-46 de EmpleadaDTO |
| D3 | Cálculo de período | UTC vs local vs Colombia | `colombia-date.ts` (getColombiaDateString + colombiaDayStartUTC/EndUTC) | Corrige server-local vs UTC; día COT = 05:00 UTC, sin DST |
| D4 | Comp fijo quincenal | Pagar 100% y "ajustar" manual | Factor 0.5 en NominaPendiente Y LiquidarEmpleada | El historial debe registrar lo realmente pagado; evita drift UI vs liquidación |
| D5 | Registro period-filtering | Filtrar por período siempre | Solo QUINCENAL filtra registros por período; MENSUAL mantiene comportamiento actual | Owner: "MENSUAL keeps today's exact behavior — do NOT change it" |
| D6 | Guard anti-doble-pago | Mes global vs período empleada | Período por empleada | La quincena 1-15 no debe bloquear la 16-31 |

## Período — Algoritmo (NominaPendienteUseCase)

```
para cada empleada:
  hoy = getColombiaDateString()                       # 'YYYY-MM-DD' COT
  si frecuenciaPago == 'QUINCENAL':
    dia = Number(hoy.slice(8,10))
    si dia <= 15: inicio = hoy[1..15]; fin = hoy[15]
    si no:       inicio = '16';     fin = último día del mes
  si no (MENSUAL):                                    # byte-idéntico a L44-46
    inicio = 1; fin = hoy
  periodoInicio = colombiaDayStartUTC(inicio)
  periodoFin    = colombiaDayEndUTC(fin)              # excl. 05:00 UTC día sig.

  factor = (frecuenciaPago == 'QUINCENAL') ? 0.5 : 1
  sueldoFijoPeriodo  = Number(empleada.sueldoFijo) * factor
  bonoHorarioPeriodo = Number(empleada.bonoHorario) * factor

  liquidaciones = findBySalonEmpleadaAndPeriodo(salonId, id, periodoInicio, periodoFin)
  # guard existente L76-92, ahora con período de la empleada
  registrosPendientes = (frecuenciaPago == 'QUINCENAL')
    ? allRegistros.filter(unpaid && !ANULADO && creadoEn ∈ [periodoInicio, periodoFin])
    : allRegistros.filter(unpaid && !ANULADO)          # MENSUAL: sin cambio
  totalAPagar = comisiones + propinas + sueldoFijoPeriodo + bonoHorarioPeriodo
  resultado += { ..., periodoInicio, periodoFin, frecuenciaPago }
```

## Data Flow

```
Form EmpleadasPage ──POST/PUT /empleadas──▶ Create/UpdateEmpleadaUseCase ──▶ UsuarioEntity.frecuenciaPago
                                                                                │
GET /finanzas/nomina ◀── NominaPendienteUseCase (período+factor por empleada) ──┘
        │  periodoInicio/periodoFin/frecuenciaPago (additivo)
NominaTab: cards "Período {frec} · inicio → fin"  ·  handleLiquidar usa emp.periodoInicio/periodoFin
CuentasTab Pagar ◀── CuentasPagarUseCase (sin cambios) ── badge "Al día" si pendienteActual===0
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `apps/api/src/infrastructure/persistence/migrations/1700000000012-AddFrecuenciaPagoToUsuarios.ts` | Create | `ALTER TABLE usuarios ADD frecuenciaPago VARCHAR(20) NOT NULL DEFAULT 'MENSUAL'` + index/down |
| `packages/types/src/user.ts` | Modify | `export type FrecuenciaPago = 'MENSUAL' \| 'QUINCENAL'` + `frecuenciaPago?: FrecuenciaPago` en IUser |
| `apps/api/src/infrastructure/persistence/entities/UsuarioEntity.ts` | Modify | `@Column({ type: 'varchar', length: 20, default: 'MENSUAL' }) frecuenciaPago: FrecuenciaPago` |
| `apps/api/src/modules/personas/application/dtos/EmpleadaDTO.ts` | Modify | `frecuenciaPago: string \| null` bajo máscara L36-46 |
| `.../empleada/CreateEmpleadaUseCase.ts` + `UpdateEmpleadaUseCase.ts` | Modify | input + paso a repo (patrón frecuenciaBono) |
| `packages/validation/src/personas.schema.ts` | Modify | create: `z.enum(['MENSUAL','QUINCENAL']).default('MENSUAL')`; update: `.optional()`; **rebuild dist** (`cd packages/validation && npx tsc`) |
| `apps/api/src/modules/finanzas/application/use-cases/liquidacion/NominaPendienteUseCase.ts` | Modify | período por empleada + factor + 3 campos nuevos en `NominaPendienteEmpleada` |
| `.../liquidacion/LiquidarEmpleadaUseCase.ts` | Modify | factor 0.5 sobre sueldoFijo/bonoHorario registrados (L111-113) |
| `apps/pos-dashboard/src/pages/EmpleadasPage.tsx` | Modify | select "Frecuencia de pago" tras Esquema de Pago; EMPTY_FORM `'MENSUAL'`; buildPayload; openEdit precarga; badge en columna Pago (L679-687) |
| `apps/pos-dashboard/src/pages/FinanzasPage.tsx` | Modify | `NominaEmpleado` +3 campos; card período (L2738); handleLiquidar (L2475-2482) usa `emp.periodoInicio/periodoFin`; CuentasTab: badge+orden (L4552-4567) |

## Interfaces / Contracts

```ts
// @pos-final/types
export type FrecuenciaPago = 'MENSUAL' | 'QUINCENAL';
// IUser: frecuenciaPago?: FrecuenciaPago  (aditivo, opcional)

// NominaPendienteEmpleada (additivo — 3 campos)
periodoInicio: Date;
periodoFin: Date;
frecuenciaPago: FrecuenciaPago;

// EmpleadaDTO (additivo)
frecuenciaPago: string | null;
```

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit (api) | Período por frecuencia | `NominaPendienteUseCase.test.ts`: `vi.useFakeTimers()` + `vi.setSystemTime(new Date('2026-08-10T12:00:00Z'))` → quincena 1-15; setSystemTime 20/08 → 16-31; MENSUAL 10/08 → 1→10. Assert `findBySalonEmpleadaAndPeriodo` llamado con período de la empleada |
| Unit (api) | Factor 50% | Empleada QUINCENAL sueldoFijo=200000,bono=50000 → totalAPagar=125000; LiquidarEmpleada registra 100000/25000 |
| Unit (api) | MENSUAL byte-idéntico | Tests existentes corren sin cambios (assert adicional: no filtrar registros por período en MENSUAL) |
| Unit (api) | Schema | create sin frecuenciaPago → MENSUAL; 'SEMANAL' → 422 |
| Unit (dashboard) | Combobox fix | `EmpleadasPage.test.tsx` L64: `screen.getByRole('combobox')` → `getByLabelText('Frecuencia de pago')` (select con aria-label) |
| Unit (dashboard) | Badge al día | `FinanzasPage.test.tsx`: fixture ya tiene Sofía `pendienteActual:0` (L454) → assert badge + orden DOM tras María |

## Migration / Rollout

Migración 0012 en el primer commit de PR2 (previo a código). Down: `ALTER TABLE usuarios DROP COLUMN frecuenciaPago`. Backfill: `DEFAULT 'MENSUAL'` aplica a filas existentes al migrar. Deploy: rebuild `packages/validation` antes de restart del API. Sin feature flag: MENSUAL preserva comportamiento, QUINCENAL es opt-in por empleada.

## Open Questions

- [ ] ¿El badge de EmpleadasPage (columna Pago) muestra texto "MENSUAL"/"QUINCENAL" o solo el bono? → Asumido: texto corto junto al comp fijo.
