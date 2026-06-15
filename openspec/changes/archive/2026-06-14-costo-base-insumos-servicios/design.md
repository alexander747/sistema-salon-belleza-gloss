# Design: Costo base/insumos por servicio para cálculo de comisión

## Technical Approach

Añadir `costoBaseInsumos` como campo en entidad Servicio y snapshot en RegistroServicioItemEntity. Modificar `ComisionService.calcularComision` para aceptar `totalCostoBaseInsumos` y restarlo del total antes de aplicar el porcentaje. El frontend envía el snapshot desde el catálogo al crear registros.

## Architecture Decisions

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Snapshot en item vs recalcular de servicio | Recalcular rompe si el precio cambia; snapshot preserva el histórico | Snapshot en RegistroServicioItemEntity |
| Parámetro opcional vs obligatorio en calcularComision | Opcional mantiene compatibilidad con tests y otros callers | Parámetro con default 0 |
| Campo en frontend siempre visible vs solo si aplica | Siempre visible es más claro, con placeholder "0" | Campo numérico con valor 0 por defecto |

## Exact Entity Changes

### ServicioEntity

```ts
@Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
costoBaseInsumos: number;
```

### RegistroServicioItemEntity

```ts
@Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
costoBaseInsumos: number;
```

## Migration SQL (TypeORM)

```ts
// AddCostoBaseInsumos1700000000008.ts
await queryRunner.query(`ALTER TABLE servicios ADD costo_base_insumos DECIMAL(12,2) NOT NULL DEFAULT 0`);
await queryRunner.query(`ALTER TABLE registros_servicio_items ADD costo_base_insumos DECIMAL(12,2) NOT NULL DEFAULT 0`);
```

## Data Flow Sequence

```
ServiciosPage (form)                    WalkInModal / AgendaPage
      │                                       │
      │  costoBaseInsumos: 40000              │
      ▼                                       │
 API POST /servicios                          │
      │                                       │
      ▼                                       │
 ServicioEntity.costoBaseInsumos = 40000      │
      │                                       │
      │  GET /servicios → {...,               │
      │    costoBaseInsumos: 40000 }           │
      ▼                                       ▼
      │                         CartItem.costoBaseInsumos = 40000
      │                                       │
      │                          POST /registros {
      │                            serviciosItems: [{
      │                              servicioId, nombreServicio,
      │                              precioServicio, costoBaseInsumos
      │                            }],
      │                            totalServicios: 100000
      │                          }
      │                                       │
      │            ┌───────────────────────────┘
      │            ▼
      │   CreateRegistroUseCase.execute()
      │      │
      │      ├─ sum = serviciosItems.reduce((a,i) => a + i.costoBaseInsumos, 0)
      │      │     → totalCostoBaseInsumos = 40000
      │      │
      │      ├─ comisionCalculada = comisionService.calcularComision(
      │      │      totalServicios=100000, porcentaje=60,
      │      │      totalCostoBaseInsumos=40000
      │      │    ) → 36000
      │      │
      │      ├─ RegistroServicioItem.save({
      │      │     ..., costoBaseInsumos: 40000
      │      │   })
      │      │
      │      └─ RegistroServicio.comisionCalculada = 36000
```

## Repository Changes

None. `IServicioRepository.create(data: Partial<ServicioEntity>)` and `update(id, data: Partial<ServicioEntity>)` already accept partial entities — new column passes through automatically.

## Frontend Changes

### 1. `servicioService.ts` — Servicio interface

```diff
 export interface Servicio {
   id: number;
   nombre: string;
   precioBase: number;
+  costoBaseInsumos?: number;
 }
```

### 2. `ServiciosPage.tsx` — Modal form

- Add `costoBaseInsumos: 0` to form state initial value
- Add input field in modal body: `<input type="number" min={0} ...>` con label "Costo base insumos"
- Include in payload: `costoBaseInsumos: form.costoBaseInsumos`
- In `openEdit`: set `costoBaseInsumos: svc.costoBaseInsumos ?? 0`

### 3. `WalkInModal.tsx` — CartItem + payload

- Add `costoBaseInsumos?: number` to `CartItem` interface
- When fetching servicios, store `costoBaseInsumos`
- In `addToCart`: include `costoBaseInsumos: serv.costoBaseInsumos ?? 0`
- In payload mapping: add `costoBaseInsumos: item.costoBaseInsumos ?? 0`

### 4. `AgendaPage.tsx` — Completar payload

- Add `costoBaseInsumos?: number` to `ServicioSimple` interface
- In `handleConfirmarCompletar`: add `costoBaseInsumos: s.costoBaseInsumos ?? 0` to both original and extra servicios items

## CreateRegistroUseCase Change

In step 4 (calculate financial values), after `comisionCalculada`:

```ts
const totalCostoBaseInsumos = (input.serviciosItems ?? [])
  .reduce((sum, si) => sum + (si.costoBaseInsumos ?? 0), 0);

const comisionCalculada = this.comisionService.calcularComision(
  input.totalServicios,
  porcentaje,
  totalCostoBaseInsumos,
);
```

In step 11 (persist servicio items):

```ts
const item = servicioItemRepo.create({
  registroServicioId: registro.id,
  servicioId: si.servicioId,
  nombreServicio: si.nombreServicio,
  precioServicio: si.precioServicio,
  costoBaseInsumos: si.costoBaseInsumos ?? 0,  // NEW
});
```

## Test Plan (vitest)

### ComisionService.test.ts — nuevos tests

```ts
it('should subtract totalCostoBaseInsumos before applying percentage', () => {
  const result = service.calcularComision(100000, 60, 40000);
  expect(result).toBe(36000);  // (100000-40000)*0.6
});

it('should return 0 when insumos exceed totalServicios', () => {
  const result = service.calcularComision(30000, 50, 35000);
  expect(result).toBe(0);
});

it('should default to 0 when totalCostoBaseInsumos not provided', () => {
  const result = service.calcularComision(100000, 60);
  expect(result).toBe(60000);
});
```

### CreateRegistroUseCase.test.ts

- Update existing test to include serviciosItems with costoBaseInsumos
- Add assertion that comisionCalculada reflects the deduction

## Migration / Rollout

No migration required for data. TypeORM migration runs as part of deploy.

## Open Questions

None.
