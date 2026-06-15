# Design: Guardar detalle de servicios en registros financieros

## Technical Approach

Add `RegistroServicioItemEntity` following the exact `RegistroProductoEntity` pattern: lightweight entity with FK + snapshot columns. `CreateRegistroUseCase` persists items in its existing transaction. Frontend sends `serviciosItems[]` from WalkInModal and AgendaPage. Detail modal renders items below the existing service description.

## Architecture Decisions

| Option | Tradeoffs | Decision |
|--------|-----------|----------|
| Separate table vs JSON column | JSON enables no joins but breaks referential integrity and audit | **Separate table** — same pattern as `registro_productos` |
| Cascade save vs manual insert | Cascade is simpler but less explicit; manual follows existing `productosVendidos` pattern | **Manual insert** in use case transaction, same as products |
| Snapshot columns vs relation join | Joins show current catalog data (price may change); snapshot shows registration-time truth | **Snapshot columns** — `nombreServicio` and `precioServicio` are frozen at creation |

## Data Flow

```
Frontend (WalkInModal / AgendaPage)
  │ POST /salones/:id/registros
  │ {..., serviciosItems: [{servicioId, nombreServicio, precioServicio}]}
  ▼
createRegistroSchema (Zod) → validates serviciosItems[]
  ▼
CreateRegistroUseCase.execute()
  │ 1. Validate cliente + usuario
  │ 2. Create RegistroServicioEntity (existing)
  │ 3. Create PagoTransaccion rows (existing)
  │ 4. Create DivisionRegistro rows (existing)
  │ 5. Create RegistroProducto rows + decrement stock (existing)
  │ 6. Create RegistroServicioItem rows ← NEW
  │ 7. Commit transaction
  ▼
registroServicioToDTO() → includes serviciosItems[]
  ▼
Response sent to frontend
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `apps/api/src/.../RegistroServicioItemEntity.ts` | Create | New entity: `registroServicioId`, `servicioId`, `nombreServicio`, `precioServicio` |
| `apps/api/src/.../RegistroServicioEntity.ts` | Modify | Add `OneToMany(() => RegistroServicioItemEntity)` relation `serviciosItems` |
| `apps/api/src/.../migrations/...-CreateRegistroServicioItem.ts` | Create | Migration for `registros_servicio_items` table |
| `apps/api/src/.../dtos/RegistroServicioItemDTO.ts` | Create | DTO + mapper function |
| `apps/api/src/.../dtos/RegistroServicioDTO.ts` | Modify | Add `serviciosItems` field + mapper call |
| `apps/api/src/.../CreateRegistroUseCase.ts` | Modify | Save `RegistroServicioItemEntity` rows in transaction (step 6) |
| `apps/api/src/.../TypeORMRegistroServicioRepository.ts` | Modify | Add `leftJoinAndSelect('r.serviciosItems', 'si')` to `findById` and `search` |
| `packages/validation/src/finanzas.schema.ts` | Modify | Add `serviciosItems` array to `createRegistroSchema` |
| `apps/pos-dashboard/src/components/WalkInModal.tsx` | Modify | Send `serviciosItems` in submit payload |
| `apps/pos-dashboard/src/pages/AgendaPage.tsx` | Modify | Send `serviciosItems` in completar payload |
| `apps/pos-dashboard/src/pages/FinanzasPage.tsx` | Modify | Render `serviciosItems` in detail modal + add to `Registro` interface |

## Interfaces / Contracts

```typescript
// Validation schema (packages/validation)
serviciosItems: z.array(z.object({
  servicioId: z.number().int().positive(),
  nombreServicio: z.string().max(200),
  precioServicio: z.number().min(0),
})).optional().default([]),

// Entity (infrastructure)
@Entity('registros_servicio_items')
export class RegistroServicioItemEntity extends BaseEntity {
  @Column() registroServicioId: number;
  @ManyToOne(() => RegistroServicioEntity) registroServicio: RegistroServicioEntity;
  @Column() servicioId: number;
  @Column({ length: 200 }) nombreServicio: string;
  @Column({ precision: 12, scale: 2 }) precioServicio: number;
}

// DTO
export interface RegistroServicioItemDTO {
  id: number;
  servicioId: number;
  nombreServicio: string;
  precioServicio: number;
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit (use case) | Servicio items persisted in transaction | CreateRegistroUseCase.test.ts — add `serviciosItems` to input, assert `registroServicioItemRepo.create` called with correct data |
| Unit (DTO) | Mapper from entity to DTO | New test: `RegistroServicioItemDTO.test.ts` — verify `registroServicioItemToDTO` maps correctly |
| Unit (schema) | serviciosItems validation | Add test in finanzas.schema tests for valid/invalid items |
| Integration | Full flow via controller | Update RegistroController test — payload includes serviciosItems, assert response includes them |
| E2E (Playwright) | WalkInModal + detail modal | Manual: create registro with services, verify items shown in detail modal |

## Migration / Rollout

**Migration**: `CREATE TABLE registros_servicio_items (...)` with FK to `registros_servicio`. Existing registros have no items — detail modal shows empty state gracefully.

**Rollback**: Drop table via down migration. Revert schema, DTO, entity, and query changes.

## Open Questions

- None
