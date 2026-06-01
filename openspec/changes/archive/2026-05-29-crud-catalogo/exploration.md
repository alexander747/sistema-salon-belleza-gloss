## Exploration: CRUD Catálogo (Categorías, Servicios, Productos)

### Current State

The **pos-final** project has all three entities fully migrated from pos-ok with matching schemas:

- **CategoriaServicioEntity**: `nombre`, `descripcion`, `emoji`, `orden`, `activo`, `salonId` — identical to pos-ok
- **ServicioEntity**: `nombre`, `descripcion`, `precioBase`, `duracionMinutos`, `activo`, `categoriaId`, `fotos` (OneToMany), `citas` (ManyToMany), `recompensas` (OneToMany) — identical to pos-ok
- **ProductoEntity**: `nombre`, `marca`, `color`, `tamano`, `descripcion`, `urlFoto`, `precioCompra`, `precioVenta`, `cantidadStock`, `stockMinimo`, `tipoInventario` (RETAIL|INTERNAL), `activo`, `salonId` — identical to pos-ok

All extend `BaseEntity` (`id`, `creadoEn`, `actualizadoEn`). Salon already has `@OneToMany` relations for `categorias` and `productos`.

**What does NOT exist yet:**
- No module structure for catalogo (no `modules/catalogo/` directory)
- No domain ports (repositories)
- No use cases
- No repositories
- No controllers or routes
- No DTOs
- No DI registrations

### Affected Areas

| Path | Why affected |
|------|-------------|
| `apps/api/src/modules/catalogo/` | **New module** — full hexagonal layers (domain, application, infrastructure, presentation) |
| `apps/api/src/shared/container.ts` | Register 3 controllers, ~12 use cases, 3 repositories |
| `apps/api/src/app.ts` | Mount new routes for `catalogoRouter` |
| `apps/api/src/presentation/middleware/tenantGuard.ts` | Already handles salonId routing, no changes needed |
| `apps/api/src/infrastructure/persistence/entities/` | Already complete, no entity changes needed |

### Approaches

1. **Single `catalogo` module** — one module with all 3 sub-domains
   - Pros: Cohesive, single DI registration block, fewer files to import in app.ts
   - Cons: Module can grow large, but still manageable at this stage
   - Effort: Medium

2. **Split into 3 modules** (`categoria`, `servicio`, `producto`)
   - Pros: Cleaner separation per domain
   - Cons: 3x container registrations, 3x route imports, overlapping patterns → boilerplate
   - Effort: High

3. **Embed in existing `salon` module**
   - Pros: No new module, catalogo "belongs to" salon conceptually
   - Cons: Salon module becomes bloated, violates Single Responsibility, harder to maintain
   - Effort: Low (short-term) but increases tech debt

### Recommendation

**Approach 1: Single `catalogo` module.** It's the sweet spot: cohesive (all catalog-related), avoids the bloat of 3 modules, and follows the existing pattern where `auth` and `salon` are standalone modules. The module will have 3 sub-directories per entity within each layer (e.g. `application/use-cases/categoria/`, `application/use-cases/servicio/`, `application/use-cases/producto/`) to keep files organized.

### Use Case Inventory

**Categorías (4 use cases):**
| Use Case | Input | Output | Notes |
|----------|-------|--------|-------|
| `ListCategoriasUseCase` | salonId | CategoriaDto[] | Filter activo=true by default, order by orden+nombre |
| `CreateCategoriaUseCase` | nombre, descripcion?, emoji?, orden? | CategoriaDto | Auto-assign salonId from context |
| `UpdateCategoriaUseCase` | id, partial fields | CategoriaDto | Salon-scoped lookup |
| `DeleteCategoriaUseCase` | id | void | Soft-delete (activo=false). Validate no servicios active? |

**Servicios (5 use cases):**
| Use Case | Input | Output | Notes |
|----------|-------|--------|-------|
| `ListServiciosUseCase` | salonId, categoriaId? | ServicioDto[] | Include precioFinal from seasonal calc, include fotos count |
| `GetServicioUseCase` | id, salonId | ServicioDto | With fotos URLs, precioFinal |
| `CreateServicioUseCase` | nombre, precioBase, duracionMinutos, categoriaId, descripcion? | ServicioDto | Validate categoria belongs to salon |
| `UpdateServicioUseCase` | id, partial fields | ServicioDto | Salon-scoped via categoria |
| `DeleteServicioUseCase` | id | void | Soft-delete (activo=false) |

**Productos (6 use cases):**
| Use Case | Input | Output | Notes |
|----------|-------|--------|-------|
| `ListProductosUseCase` | salonId, tipoInventario? | ProductoDto[] | precioCompra OMITTED for non-dueña roles |
| `GetProductoUseCase` | id, salonId | ProductoDto | Same role-based filtering |
| `CreateProductoUseCase` | nombre, precioCompra?, precioVenta?, tipoInventario?, stock?, params | ProductoDto | |
| `UpdateProductoUseCase` | id, partial fields | ProductoDto | Salon-scoped |
| `DescontarStockUseCase` | id, cantidad | ProductoDto | Validate stock >= cantidad, prevent negative |
| `ReabastecerStockUseCase` | id, cantidad, precioCompra? | ProductoDto | Add stock, optionally update precioCompra |

**Total: 15 use cases**

### Frontend Pages Inventory

| Page | Routes | Features |
|------|--------|----------|
| **Categorías List** | `/salon/categorias` | Table, orden drag, create/edit modal, toggle active |
| **Categoría Form** | inline modal | nombre, descripcion, emoji picker, orden |
| **Servicios List** | `/salon/servicios` | Filter by categoria, show precioBase+precioFinal badge, photo count |
| **Servicio Form** | inline modal | nombre, categoria (dropdown), precioBase, duracionMinutos, descripcion |
| **Inventario List** | `/salon/inventario` | Toggle RETAIL/INTERNAL, low-stock highlight, search |
| **Producto Form** | inline modal | nombre, marca, color, tamano, precioCompra (dueña only), precioVenta, stock, urlFoto |
| **Stock Actions** | inline buttons | Descontar (modal with amount), Reabastecer (modal with amount + optional precioCompra) |

### Risks

1. **Seasonal pricing has no schema** — `reglasTemporada` is `object` (JSON) on SalonEntity with zero validation. The `calcularPrecioTemporada` logic expects `{ fechaInicio, fechaFin, multiplicador }`. Need to define and validate this shape or risk runtime crashes.
2. **Stock race conditions** — concurrent `descontarStock` calls can cause negative stock. For MVP: documented as known limitation. Future: use `QueryRunner` with pessimistic lock.
3. **precioCompra visibility** — `precioCompra` MUST be stripped from product responses when user is not DUEÑA or SUPERADMIN. This affects `ListProductosUseCase` and `GetProductoUseCase`.
4. **Soft-delete cascade semantics** — deactivating a category doesn't auto-deactivate its servicios. The UI should show a warning: "Esta categoría tiene N servicios activos. ¿Desactivar de todas formas?"
5. **No "eliminar" endpoint in pos-ok for categorías/servicios** — the reference code only has soft-delete for productos. We're adding delete for all three, which is correct but has no reference to mirror.

### Dependencies

None beyond the existing foundation:
- `tsyringe` (already in project)
- `express` (already in project)
- `typeorm` (already in project)
- `@pos-final/types` (Rol enum — already in project)
- `@pos-final/validation` (Zod schemas — already in project, will add schemas)

### Ready for Proposal
Yes. All entities are complete, the use cases are well-defined, and there's one clear architectural choice (single `catalogo` module). The orchestrator should present this analysis and confirm the module name and route prefix before proceeding to the proposal phase.
