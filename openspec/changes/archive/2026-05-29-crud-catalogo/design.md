# Design: CRUD Catálogo (Categorías, Servicios, Productos)

## Technical Approach

Single `modules/catalogo/` dir following the hexagonal pattern from `modules/salon/`: ports → use cases → repos → controllers → routes. The only divergence is DTOs as classes (not interfaces) to encapsulate role-based `precioCompra` filtering. Seasonal pricing is computed in use cases from `Salon.reglasTemporada` JSON. Stock mutations validate `cantidadStock >= cantidad` before writing.

## Architecture Decisions

| Decision | Option | Tradeoff | Choice |
|----------|--------|----------|--------|
| DTO shape | Interfaces (salon pattern) | Simpler, consistent with existing code | Classes |
| DTO shape | Classes with `static fromEntity()` | Encapsulates role filtering, testable in isolation | Classes |
| `precioCompra` stripping | Use case level | Every use case repeats the logic | DTO factory |
| `precioCompra` stripping | DTO factory method | Single place, easy to test | DTO factory |
| Route mount | `/api/catalogo/*` (proposal) | Flat, simpler | `/api/salones/:salonId/*` (spec) |
| Route mount | `/api/salones/:salonId/*` (spec) | Tenant-scoped, matches spec tables | `/api/salones/:salonId/*` |
| Seasonal pricing | Compute in repository | Violates separation of concerns | Compute in use case |
| Seasonal pricing | Compute in use case | Clean, testable independently | Compute in use case |
| Categoria delete warning | Controller check | Tight coupling | Use case returns warning field |
| Categoria delete warning | Use case returns warning | Domain logic stays in application layer | Use case returns warning field |

## Data Flow

```
Express Router (catalogo.routes.ts)
  │ authGuard / tenantGuard / requireRole / validate (middleware)
  ▼
Controller (CategoriaController.ts)
  │ calls use case with {salonId, ...body}
  ▼
Use Case (ListCategoriasUseCase.ts)
  │ calls repo.findBySalon(salonId)
  ▼
Repository (TypeORMCategoriaServicioRepository.ts)
  │ AppDataSource.getRepository(...).find({ where: { salonId, activo: true } })
  ▼
TypeORM → PostgreSQL
```

For `precioCompra` filtering, req.user.rol flows:
`controller → use case → CategoriaServicioDTO.fromEntity(entity, userRol)`

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `packages/validation/src/catalogo.schema.ts` | Create | Zod schemas: createCategoria, createServicio, createProducto, descontarStock, reabastecerStock + partial variants for update |
| `packages/validation/src/index.ts` | Modify | Re-export catalogo schemas |
| `apps/api/src/modules/catalogo/domain/ports/ICategoriaServicioRepository.ts` | Create | Interface: findBySalon, findBySalonAndId, create, update, softDelete, countActiveServicios |
| `apps/api/src/modules/catalogo/domain/ports/IServicioRepository.ts` | Create | Interface: findBySalon, findBySalonAndId, create, update, softDelete |
| `apps/api/src/modules/catalogo/domain/ports/IProductoRepository.ts` | Create | Interface: findBySalon, findBySalonAndId, create, update, descontarStock, reabastecerStock, softDelete |
| `apps/api/src/modules/catalogo/domain/entities/index.ts` | Create | Re-export barrel (no TypeORM entities — those live in infrastructure/persistence/) |
| `apps/api/src/modules/catalogo/application/dtos/CategoriaServicioDTO.ts` | Create | Class with fromEntity() |
| `apps/api/src/modules/catalogo/application/dtos/ServicioDTO.ts` | Create | Class with fromEntity(), includes precioFinal computation |
| `apps/api/src/modules/catalogo/application/dtos/ProductoDTO.ts` | Create | Class with fromEntity(entity, userRol), conditionally strips precioCompra |
| `apps/api/src/modules/catalogo/application/use-cases/categoria/` (4 files) | Create | List, Create, Update, DeleteCategoriaUseCase |
| `apps/api/src/modules/catalogo/application/use-cases/servicio/` (5 files) | Create | List, Get, Create, Update, DeleteServicioUseCase |
| `apps/api/src/modules/catalogo/application/use-cases/producto/` (7 files) | Create | List, Get, Create, Update, DescontarStock, ReabastecerStock, DeleteProductoUseCase |
| `apps/api/src/modules/catalogo/infrastructure/persistence/TypeORMCategoriaServicioRepository.ts` | Create | Implements ICategoriaServicioRepository with TypeORM |
| `apps/api/src/modules/catalogo/infrastructure/persistence/TypeORMServicioRepository.ts` | Create | Implements IServicioRepository with TypeORM |
| `apps/api/src/modules/catalogo/infrastructure/persistence/TypeORMProductoRepository.ts` | Create | Implements IProductoRepository with TypeORM |
| `apps/api/src/modules/catalogo/presentation/controllers/CategoriaController.ts` | Create | 4 endpoints: list, create, update, delete |
| `apps/api/src/modules/catalogo/presentation/controllers/ServicioController.ts` | Create | 5 endpoints: list, get, create, update, delete |
| `apps/api/src/modules/catalogo/presentation/controllers/ProductoController.ts` | Create | 7 endpoints: list, get, create, update, delete, descontarStock, reabastecerStock |
| `apps/api/src/modules/catalogo/presentation/routes/catalogo.routes.ts` | Create | Express Router with all 16 routes |
| `apps/api/src/shared/container.ts` | Modify | Register 3 repos + 15 use cases + 3 controllers |
| `apps/api/src/app.ts` | Modify | Mount `catalogoRouter` under `/api/salones/:salonId` |

## Interfaces / Contracts

```typescript
// ICategoriaServicioRepository.ts
export interface ICategoriaServicioRepository {
  findBySalon(salonId: number): Promise<CategoriaServicioEntity[]>;
  findBySalonAndId(salonId: number, id: number): Promise<CategoriaServicioEntity | null>;
  findByNameAndSalon(nombre: string, salonId: number): Promise<CategoriaServicioEntity | null>;
  create(data: Partial<CategoriaServicioEntity>): Promise<CategoriaServicioEntity>;
  update(id: number, data: Partial<CategoriaServicioEntity>): Promise<CategoriaServicioEntity | null>;
  softDelete(id: number): Promise<boolean>;
  countActiveServicios(categoriaId: number): Promise<number>;
}

// IServicioRepository.ts
export interface IServicioRepository {
  findBySalon(salonId: number, categoriaId?: number): Promise<ServicioEntity[]>;
  findBySalonAndId(salonId: number, id: number): Promise<ServicioEntity | null>;
  create(data: Partial<ServicioEntity>): Promise<ServicioEntity>;
  update(id: number, data: Partial<ServicioEntity>): Promise<ServicioEntity | null>;
  softDelete(id: number): Promise<boolean>;
  countFotos(servicioId: number): Promise<number>;
}

// IProductoRepository.ts
export interface IProductoRepository {
  findBySalon(salonId: number, tipoInventario?: TipoInventario): Promise<ProductoEntity[]>;
  findBySalonAndId(salonId: number, id: number): Promise<ProductoEntity | null>;
  create(data: Partial<ProductoEntity>): Promise<ProductoEntity>;
  update(id: number, data: Partial<ProductoEntity>): Promise<ProductoEntity | null>;
  decrementStock(id: number, cantidad: number): Promise<ProductoEntity | null>;
  incrementStock(id: number, cantidad: number, precioCompra?: number): Promise<ProductoEntity | null>;
  softDelete(id: number): Promise<boolean>;
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit — Use Cases | All 15 use cases | vitest + mocked repositories. Test role-based DTO output, stock validation rejection, seasonal pricing computation, duplicate-nombre conflict |
| Unit — DTOs | fromEntity role filtering | Test with each Rol, verify precioCompra presence/absence |
| Integration — Controllers | All 16 endpoints per role | supertest + real (test) DB. Verify 200/201/403/422 status, response shape, precioCompra hiding |
| Integration — Routes | Auth/tenant/role guards | Test that unauthenticated, cross-tenant, and unauthorized requests are rejected |
| Validation — Schemas | All Zod schemas | Test required fields, type checks, partial update variants |

## Migration / Rollout

No DB migration needed — entities exist. Rollback: revert DI registrations in `container.ts` and route mount in `app.ts`, delete `modules/catalogo/` dir.

## Open Questions

None — all design decisions resolved.
