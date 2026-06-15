# Spec: Costo base/insumos por servicio para cálculo de comisión

## Entity Fields

### ServicioEntity (`servicios`)

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `costoBaseInsumos` | DECIMAL(12,2) | NO | 0 | Costo de insumos del servicio (materia prima, productos desechables) |

### RegistroServicioItemEntity (`registros_servicio_items`)

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `costoBaseInsumos` | DECIMAL(12,2) | NO | 0 | Snapshot del costo de insumos al momento de crear el registro |

## ComisionService Signature

```ts
// Current
calcularComision(totalServicios: number, porcentajeComision: number): number

// New
calcularComision(totalServicios: number, porcentajeComision: number, totalCostoBaseInsumos: number = 0): number
```

Formula: `comision = (totalServicios - totalCostoBaseInsumos) * (porcentajeComision / 100)`

If `totalServicios - totalCostoBaseInsumos < 0`, return 0 (no comisión negativa).

## Validation Schemas

### `packages/validation/src/catalogo.schema.ts`

```ts
// Add to createServicioSchema
costoBaseInsumos: z.number().min(0).default(0).optional(),

// updateServicioSchema inherits via .partial()
```

### `packages/validation/src/finanzas.schema.ts`

```ts
// Add to serviciosItems[] item inside createRegistroSchema
serviciosItems: z.array(z.object({
  servicioId: z.number().int().positive(),
  nombreServicio: z.string().min(1).max(200),
  precioServicio: z.number().min(0),
  costoBaseInsumos: z.number().min(0).default(0).optional(),  // NEW
})).optional().default([]),
```

## DTOs

### ServicioDTO

```
Added field: costoBaseInsumos: number  → fromEntity: Number(entity.costoBaseInsumos ?? 0)
```

### RegistroServicioItemDTO

```
Added field: costoBaseInsumos: number  → from entity Number(entity.costoBaseInsumos)
```

## Frontend Type

### `servicioService.ts` — `Servicio` interface

```ts
export interface Servicio {
  // ...existing fields
  costoBaseInsumos?: number;  // NEW
}
```

## Frontend Payload Changes

### WalkInModal — `serviciosItems[]` item

```ts
serviciosItems: cart.map((item) => ({
  servicioId: item.servicioId,
  nombreServicio: item.nombre,
  precioServicio: item.precio,
  costoBaseInsumos: item.costoBaseInsumos ?? 0,  // NEW
})),
```

The `CartItem` interface needs `costoBaseInsumos?: number`. This is populated from the servicio catalog data when the item is added to cart.

### AgendaPage — `handleConfirmarCompletar`

```ts
serviciosItems: [
  ...selectedCita.servicios.map(s => ({
    servicioId: s.id,
    nombreServicio: s.nombre,
    precioServicio: completarForm.serviciosPrecios[s.id] ?? s.precio,
    costoBaseInsumos: s.costoBaseInsumos ?? 0,  // NEW
  })),
  ...servicios.filter(s => completarForm.nuevosServiciosIds.includes(s.id)).map(s => ({
    servicioId: s.id,
    nombreServicio: s.nombre,
    precioServicio: s.precioBase ?? 0,
    costoBaseInsumos: s.costoBaseInsumos ?? 0,  // NEW
  })),
],
```

The `ServicioSimple` interface in AgendaPage needs `costoBaseInsumos?: number`.

## Acceptance Criteria

1. **Backend**: POST `/salones/:id/servicios` accepts `costoBaseInsumos`, returns it in response
2. **Backend**: PUT `/salones/:id/servicios/:id` accepts `costoBaseInsumos`, returns it
3. **Backend**: GET `/salones/:id/servicios` returns `costoBaseInsumos` for each service
4. **Backend**: ComisionService returns `(totalServicios - totalCostoBaseInsumos) * porcentaje/100`
5. **Backend**: CreateRegistroUseCase saves snapshot `costoBaseInsumos` in items
6. **Backend**: CreateRegistroUseCase calculates correct comisionCalculada using totalCostoBaseInsumos
7. **Backend**: Without `costoBaseInsumos` in payload, behavior matches current (default 0)
8. **Frontend**: ServiciosPage shows "Costo base insumos" input in create/edit modal
9. **Frontend**: WalkInModal includes `costoBaseInsumos` in POST payload
10. **Frontend**: AgendaPage (completar) includes `costoBaseInsumos` in POST payload
11. **All tests pass**: `cd apps/api && npx vitest run`

## Test Scenarios (TDD)

### ComisionService

| # | totalServicios | porcentaje | totalCostoBaseInsumos | Expected | Description |
|---|---------------|-----------|----------------------|----------|-------------|
| 1 | 100000 | 60 | 40000 | 36000 | (100k-40k)*60% |
| 2 | 100000 | 60 | 0 | 60000 | Legacy: sin insumos = actual |
| 3 | 50000 | 50 | 20000 | 15000 | (50k-20k)*50% |
| 4 | 30000 | 50 | 35000 | 0 | Insumos > total → 0 |
| 5 | 0 | 60 | 0 | 0 | Sin servicios |
| 6 | 100000 | 0 | 40000 | 0 | Porcentaje 0% |

### CreateRegistroUseCase

- Registro con servicios con costoBaseInsumos → comisionCalculada debe ser `(totalServicios - sumaCostoBaseInsumos) * porcentaje`
- Registro sin costoBaseInsumos en items → default 0, comisión sin cambios
