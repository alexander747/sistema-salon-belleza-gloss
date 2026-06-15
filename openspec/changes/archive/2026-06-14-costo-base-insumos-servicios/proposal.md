# Proposal: Costo base/insumos por servicio para cálculo de comisión

## Intent

Permitir que cada servicio tenga un costo base de insumos asociado, de modo que al calcular la comisión de la empleada se descuente ese costo de los ingresos. Actualmente la comisión se calcula sobre el precio total del servicio sin descontar insumos.

## Scope

- **Backend entities**: `ServicioEntity` (+`costoBaseInsumos`), `RegistroServicioItemEntity` (+`costoBaseInsumos` snapshot)
- **Business logic**: `ComisionService.calcularComision` — nuevo parámetro `totalCostoBaseInsumos` (default 0)
- **Use case**: `CreateRegistroUseCase` — calcular `totalCostoBaseInsumos` desde serviciosItems y pasarlo
- **Schema/validation**: `catalogo.schema.ts`, `finanzas.schema.ts` — nuevo campo opcional
- **DTOs**: `ServicioDTO`, `RegistroServicioItemDTO` — exponer campo
- **Frontend**: `ServiciosPage.tsx` (form), `servicioService.ts` (type), `WalkInModal.tsx` / `AgendaPage.tsx` (payload)
- **Migration**: TypeORM migration con ALTER TABLE + DEFAULT 0

**No afectados**: reportes downstream (`ResumenDiaUseCase`, `ROIMensualUseCase`, `CierreTurnoUseCase`, `NominaPendienteUseCase`, `LiquidarEmpleadaUseCase`) — todos leen `comisionCalculada` ya persistida.

## Approach

Añadir `costoBaseInsumos` como columna `DECIMAL(12,2) DEFAULT 0 NOT NULL` en:
1. `servicios` — costo de insumos del servicio (configurable en ServiciosPage)
2. `registros_servicio_items` — snapshot al momento de crear el registro

Modificar `ComisionService.calcularComision` a `(totalServicios, porcentaje, totalCostoBaseInsumos = 0)`:
```
comision = (totalServicios - totalCostoBaseInsumos) * (porcentaje / 100)
```

En `CreateRegistroUseCase`, sumar `costoBaseInsumos` de cada `serviciosItems` y pasar el total al service.

## Affected Files

### Backend (entities + business)
- `apps/api/src/infrastructure/persistence/entities/ServicioEntity.ts` — +1 column
- `apps/api/src/infrastructure/persistence/entities/RegistroServicioItemEntity.ts` — +1 column
- `apps/api/src/modules/finanzas/application/services/ComisionService.ts` — new param
- `apps/api/src/modules/finanzas/application/use-cases/registro/CreateRegistroUseCase.ts` — calc + pass
- `apps/api/src/modules/catalogo/application/dtos/ServicioDTO.ts` — expose field
- `apps/api/src/modules/finanzas/application/dtos/RegistroServicioItemDTO.ts` — expose field
- `apps/api/src/modules/catalogo/application/use-cases/servicio/CreateServicioUseCase.ts` — pass input
- `apps/api/src/modules/catalogo/application/use-cases/servicio/UpdateServicioUseCase.ts` — pass input

### Backend (validation)
- `packages/validation/src/catalogo.schema.ts` — +`costoBaseInsumos` optional
- `packages/validation/src/finanzas.schema.ts` — +`costoBaseInsumos` en `serviciosItems[]`

### Frontend
- `apps/pos-dashboard/src/services/servicioService.ts` — +`costoBaseInsumos` en type
- `apps/pos-dashboard/src/pages/ServiciosPage.tsx` — +campo en modal
- `apps/pos-dashboard/src/components/WalkInModal.tsx` — +`costoBaseInsumos` en payload
- `apps/pos-dashboard/src/pages/AgendaPage.tsx` — +`costoBaseInsumos` en payload (handleConfirmarCompletar)

### Tests
- `apps/api/src/modules/finanzas/application/services/__tests__/ComisionService.test.ts` — nuevos tests
- `apps/api/src/modules/finanzas/application/use-cases/registro/__tests__/CreateRegistroUseCase.test.ts` — actualizar tests

## Migration Plan

1. Crear migración `AddCostoBaseInsumos1700000000008.ts`:
   - `ALTER TABLE servicios ADD costo_base_insumos DECIMAL(12,2) DEFAULT 0 NOT NULL`
   - `ALTER TABLE registros_servicio_items ADD costo_base_insumos DECIMAL(12,2) DEFAULT 0 NOT NULL`
2. Actualizar seed (`seed-servicios.sql`) — costoBaseInsumos para Alisado ($40.000), Tintura ($25.000), etc.
3. No requiere backfill (DEFAULT 0 mantiene comportamiento actual).

## Backward Compatibility

- Servicios existentes sin costoBaseInsumos → 0 (no afecta comisión)
- Registros existentes sin snapshot → 0 (no afecta comisión)
- `calcularComision` con default 0 mantiene firma compatible
- Frontend envía campo opcional; si no se envía, default 0

## Risks

| Risk | Mitigation |
|------|-----------|
| Tests existentes se rompen (firma cambia) | Actualizar con param default 0 |
| Frontend no envía campo en algún flujo | Default 0 en backend |
| Downstream lee comisionCalculada desactualizada | Ya es snapshot correcto — no se recalcula |

## Success Criteria

1. `ComisionService.calcularComision(100000, 60, 40000)` → 36000 (60% de 60000)
2. Servicio con costoBaseInsumos se persiste y expone en API
3. Registro creado con snapshot de costoBaseInsumos en cada item
4. Comisión calculada correcta en el registro
5. Frontend permite configurar costoBaseInsumos en ServiciosPage
6. WalkInModal y AgendaPage envían costoBaseInsumos en payload
7. Tests existentes pasan (vitest)
