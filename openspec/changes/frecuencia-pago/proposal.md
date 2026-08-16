# Proposal: Frecuencia de Pago por Empleada (MENSUAL/QUINCENAL)

## Intent

La nómina paga una vez al mes; el salón necesita pagar quincenal a empleadas con sueldo fijo. El período es un mes global hardcodeado en `NominaPendienteUseCase` (L44-46, hora local del servidor, inconsistente con UTC/Colombia). CuentasTab "Por pagar" muestra empleadas sin pendiente sin distinción.

## Scope

### In Scope
- **PR1** — CuentasTab UX: badge verde "Al día" si `pendienteActual === 0`, filas al día al final. Solo cliente.
- **PR2** — `frecuenciaPago` por empleada (`MENSUAL` default | `QUINCENAL`): migración, tipos, entidad, DTO, use cases, validación, formulario, período de nómina y comp fijo 50% quincenal.

### Out of Scope
- Historial partido por quincena; correcciones cross-period de frontera de mes; consumidores n8n/móvil de los nuevos campos.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `finanzas-liquidacion`: período por frecuencia (MENSUAL 1→hoy; QUINCENAL 1-15 / 16-fin), sueldo fijo quincenal = 50%, guard usa período de la empleada, `frecuenciaPago` en formulario.
- `finanzas-cuentas`: Tab Cuentas Pagar badge "Al día" + orden al final.

## Approach

2 PRs: PR1 UX primero (cero riesgo). PR2 agrega `frecuenciaPago` siguiendo el precedente de `frecuenciaBono` (varchar → DTO máscara DUEÑA/ADMIN → use cases → schema Zod → form). Período con `colombia-date.ts`; guard por empleada; comp fijo = factor (QUINCENAL 0.5, MENSUAL 1) en NominaPendiente Y LiquidarEmpleada.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `migrations/1700000000012-*` | New | varchar(20) NOT NULL DEFAULT 'MENSUAL' |
| `types/user.ts`, `UsuarioEntity.ts` | Modified | `FrecuenciaPago` union, `IUser` + columna |
| `EmpleadaDTO.ts` + Create/UpdateEmpleadaUseCase | Modified | campo bajo máscara DUEÑA/ADMIN |
| `personas.schema.ts` | Modified | `z.enum` default MENSUAL + rebuild dist |
| `NominaPendienteUseCase.ts` | Modified | período por empleada, factor 50%, 3 campos nuevos |
| `LiquidarEmpleadaUseCase.ts` | Modified | factor 50% en comp fijo registrado |
| `FinanzasPage.tsx` | Modified | NominaTab período; handleLiquidar usa `emp.periodoInicio/periodoFin`; CuentasTab badge+orden |
| `EmpleadasPage.tsx` | Modified | select Frecuencia de pago, buildPayload, openEdit, badge Pago |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| MENSUAL cambia comportamiento | Low | Rama byte-idéntica; guard overlap (1→hoy ≡ 1→fin mes); tests existentes pasan |
| Rebuild `packages/validation` olvidado | Med | Task explícito `npx tsc` + test create/update |
| `EmpleadasPage.test` combobox ambiguity | High | `getByRole('combobox')` matchea 1 select hoy; el segundo rompe el test → `getByLabelText('Frecuencia de pago')` |
| 50% solo en un use case | Med | Factor en ambos: NominaPendiente y LiquidarEmpleada |
| Liquidaciones existentes | — | Backfill `DEFAULT 'MENSUAL'` preserva historial |

## Rollback Plan

PR1: revert del diff de CuentasTab (solo cliente). PR2: `down()` migración 0012 + revert código; filas conservan `MENSUAL`, sin pérdida.

## Dependencies

- `colombia-date.ts` (existente). Migración 0012 previa al deploy; rebuild de `packages/validation` previo al restart.

## Success Criteria

- [ ] Tests existentes de NominaPendiente pasan sin modificación (MENSUAL byte-idéntico).
- [ ] Empleada QUINCENAL muestra período 1-15 o 16-fin y 50% de comp fijo.
- [ ] Formulario guarda `frecuenciaPago`; DTO lo expone bajo DUEÑA/ADMIN; CuentasTab badge "Al día".
