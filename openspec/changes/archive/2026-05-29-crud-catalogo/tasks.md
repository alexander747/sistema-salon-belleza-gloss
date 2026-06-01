# Tasks: CRUD Catálogo (Categorías, Servicios, Productos)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~1,050 production + ~600 tests = ~1,650 total |
| 800-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (Foundation + Categorías + Servicios → ~600 prod) → PR 2 (Productos + Routes/Wiring → ~450 prod) |
| Delivery strategy | ask-on-risk |
| Chain strategy | feature-branch-chain |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Foundation + Categorías + Servicios | PR 1 | Base = `feature/crud-catalogo`. Ports, DTOs, validation, repos, use cases, controllers, routes, container partial. Tests included. |
| 2 | Productos + Routes/Wiring | PR 2 | Base = `feature/crud-catalogo`. Producto repo/use cases/controller. Final routes, container, app.ts mount. Tests included. |

## Phase 1: Foundation — Interfaces & Validation

- [x] 1.1 Create `packages/validation/src/catalogo.schema.ts` — Zod schemas: createCategoria, createServicio, createProducto, descontarStock, reabastecerStock + partial variants
- [x] 1.2 Modify `packages/validation/src/index.ts` — re-export catalogo schemas
- [x] 1.3 Create `apps/api/src/modules/catalogo/domain/ports/ICategoriaServicioRepository.ts`
- [x] 1.4 Create `apps/api/src/modules/catalogo/domain/ports/IServicioRepository.ts`
- [x] 1.5 Create `apps/api/src/modules/catalogo/domain/ports/IProductoRepository.ts`
- [x] 1.6 Create `apps/api/src/modules/catalogo/domain/entities/index.ts` — barrel re-export

## Phase 2: DTOs

- [x] 2.1 Create `apps/api/src/modules/catalogo/application/dtos/CategoriaServicioDTO.ts` — class with `fromEntity()`
- [x] 2.2 Create `apps/api/src/modules/catalogo/application/dtos/ServicioDTO.ts` — class with `fromEntity()`, injects `precioFinal` via seasonal pricing
- [x] 2.3 Create `apps/api/src/modules/catalogo/application/dtos/ProductoDTO.ts` — class with `fromEntity(entity, userRol)`, strips `precioCompra` per role

## Phase 3: TypeORM Repositories

- [x] 3.1 Create `apps/api/src/modules/catalogo/infrastructure/persistence/TypeORMCategoriaServicioRepository.ts` — implements ICategoriaServicioRepository
- [x] 3.2 Create `apps/api/src/modules/catalogo/infrastructure/persistence/TypeORMServicioRepository.ts` — implements IServicioRepository
- [x] 3.3 Create `apps/api/src/modules/catalogo/infrastructure/persistence/TypeORMProductoRepository.ts` — implements IProductoRepository incl. stock mutations

## Phase 4: Use Cases — Categorías

- [x] 4.1 Create `.../use-cases/categoria/ListCategoriasUseCase.ts`
- [x] 4.2 Create `.../use-cases/categoria/CreateCategoriaUseCase.ts` — check duplicate nombre per salon
- [x] 4.3 Create `.../use-cases/categoria/UpdateCategoriaUseCase.ts`
- [x] 4.4 Create `.../use-cases/categoria/DeleteCategoriaUseCase.ts` — soft delete, count active servicios, return warning

## Phase 5: Use Cases — Servicios

- [x] 5.1 Create `.../use-cases/servicio/ListServiciosUseCase.ts` — optional categoriaId filter, compute precioFinal from reglasTemporada
- [x] 5.2 Create `.../use-cases/servicio/GetServicioUseCase.ts` — includes fotosCount
- [x] 5.3 Create `.../use-cases/servicio/CreateServicioUseCase.ts` — validate categoria belongs to same salon
- [x] 5.4 Create `.../use-cases/servicio/UpdateServicioUseCase.ts`
- [x] 5.5 Create `.../use-cases/servicio/DeleteServicioUseCase.ts`

## Phase 6: Use Cases — Productos

- [x] 6.1 Create `.../use-cases/producto/ListProductosUseCase.ts` — optional tipoInventario filter, role-based DTO
- [x] 6.2 Create `.../use-cases/producto/GetProductoUseCase.ts`
- [x] 6.3 Create `.../use-cases/producto/CreateProductoUseCase.ts`
- [x] 6.4 Create `.../use-cases/producto/UpdateProductoUseCase.ts`
- [x] 6.5 Create `.../use-cases/producto/DescontarStockUseCase.ts` — reject if cantidadStock < cantidad (422)
- [x] 6.6 Create `.../use-cases/producto/ReabastecerStockUseCase.ts` — increment stock, optionally update precioCompra
- [x] 6.7 Create `.../use-cases/producto/DeleteProductoUseCase.ts`

## Phase 7: Controllers

- [x] 7.1 Create `.../presentation/controllers/CategoriaController.ts` — list, create, update, delete
- [x] 7.2 Create `.../presentation/controllers/ServicioController.ts` — list, get, create, update, delete
- [x] 7.3 Create `.../presentation/controllers/ProductoController.ts` — list, get, create, update, delete, descontarStock, reabastecerStock

## Phase 8: Routes & Wiring

- [x] 8.1 Create `.../presentation/routes/catalogo.routes.ts` — categorías + servicios + productos routes under `/api/salones/:salonId`, with authGuard/tenantGuard/requireRole/validate
- [x] 8.2 Modify `apps/api/src/shared/container.ts` — register 3 repos + 9 use cases + 2 controllers (PR #1) + 7 producto use cases + ProductoController (PR #2)
- [x] 8.3 Modify `apps/api/src/app.ts` — mount catalogoRouter

## Phase 9: Tests

- [x] 9.1 Unit test validation schemas — all Zod schemas (required fields, type checks, partial variants)
- [x] 9.2 Unit test DTOs — test `fromEntity` role filtering for each Rol (precioCompra presence/absence)
- [x] 9.3 Unit test all 15 use cases — vitest + mocked repos (ListCategorias, ListServicios with seasonal pricing, DescontarStock with stock validation)
- [x] 9.4 Unit test CategoriaController — mock use cases, verify status codes + response shape
- [x] 9.5 Unit test ServicioController — mock use cases, verify status codes + response shape
- [x] 9.6 Unit test ProductoController — mock use cases, verify status codes + response shape
- [ ] 9.7 Integration test auth guards — verify unauthenticated, cross-tenant, unauthorized role rejection for each endpoint group
