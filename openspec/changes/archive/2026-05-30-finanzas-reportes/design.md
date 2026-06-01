# Design: Módulo de Finanzas y Reportes

## Technical Approach

Hexagonal DDD mirroring `modules/agenda/`. Domain ports → use cases with single `execute()` → TypeORM repository impls → thin controllers → Express routes with `mergeParams: true` under `/api/salones/:salonId`. tsyringe DI with string tokens for interfaces, class tokens for everything else.

Report use cases are read-only, liquidación is write-on-read, registros are full transactional.

## Architecture Decisions

| Decision | Options | Choice | Rationale |
|----------|---------|--------|-----------|
| DI token strategy | String tokens for repos, class tokens for UC/controllers | String for repos, class for UC/controllers | Matches existing agenda/personas/catalogo pattern exactly |
| CreateRegistro atomicity | TypeORM cascade vs QueryRunner | **QueryRunner** | pos-ok lacks transactions. 4 tables (registro + pagos + divisiones + cliente) MUST commit or rollback as one unit |
| Report use cases: hexagonal or flat | Hexagonal with ports vs flat service | **Hexagonal** | Read-only reports benefit from injectable ports for test mocking just as much as writes |
| ComisionService: use-case vs domain service | Inline in use case vs shared service | **Shared `ComisionService`** | Commission logic reused across CreateRegistro, LiquidarEmpleada, ResumenDia, CierreTurno |
| Liquidacion period boundaries | include `creadoEn` vs only `estaPagadaEmpleada` flag | **Flag-based** | `estaPagadaEmpleada=false` is the sole gate; avoids date-boundary off-by-one bugs |

## Data Flow: CreateRegistro (Critical Transaction)

```
Controller              Use Case (QueryRunner)                Repos
    │                        │                                   │
    ├─ dto ─────────────────►│                                   │
    │                        ├─ startTransaction()               │
    │                        ├─ validate clienteId ─────────────►IClienteRepository
    │                        ├─ validate usuarioId ─────────────►IPersonasUsuarioRepository
    │                        ├─ validate serviciosIds ──────────►IServicioRepository
    │                        ├─ ComisionService.calcular*()       │
    │                        ├─ manager.save(RegistroServicio)    │
    │                        ├─ foreach pago → manager.save()     │
    │                        ├─ foreach division → manager.save() │
    │                        ├─ cliente.deudaTotal += pendiente ─►manager.save(cliente)
    │                        ├─ descontar stock productos ──────►IProductoRepository
    │                        ├─ commitTransaction()               │
    │                        └─ return RegistroServicioDTO        │
    │◄─── 201 ───────────────┘                                   │
```

On failure: rollback, throw `AppError`.

## Module File Tree

```
apps/api/src/modules/finanzas/
├── domain/ports/
│   ├── IRegistroServicioRepository.ts
│   ├── IPagoTransaccionRepository.ts
│   ├── IDivisionRegistroRepository.ts
│   ├── ILiquidacionRepository.ts
│   ├── IGastoRepository.ts
│   └── IDevolucionRepository.ts
├── application/
│   ├── dtos/
│   │   ├── RegistroServicioDTO.ts
│   │   ├── GastoDTO.ts, DevolucionDTO.ts, LiquidacionDTO.ts
│   │   ├── ResumenDiaDTO.ts, ROIDTO.ts, CierreTurnoDTO.ts
│   │   └── NominaPendienteDTO.ts
│   ├── services/
│   │   └── ComisionService.ts
│   └── use-cases/
│       ├── registro/{Create,List,Get,Anular}RegistroUseCase.ts
│       ├── gasto/{List,Create,Delete}GastoUseCase.ts
│       ├── devolucion/{List,Create}DevolucionUseCase.ts
│       ├── liquidacion/{NominaPendiente,LiquidarEmpleada,HistorialLiquidaciones}UseCase.ts
│       └── reporte/{ResumenDia,ROIMensual,CierreTurno}UseCase.ts
├── infrastructure/persistence/
│   ├── TypeORMRegistroServicioRepository.ts
│   ├── TypeORMPagoTransaccionRepository.ts
│   ├── TypeORMDivisionRegistroRepository.ts
│   ├── TypeORMLiquidacionRepository.ts
│   ├── TypeORMGastoRepository.ts
│   └── TypeORMDevolucionRepository.ts
└── presentation/
    ├── controllers/{Registro,Gasto,Devolucion,Liquidacion,Reporte}Controller.ts
    └── routes/finanzas.routes.ts
```

## ComisionService Contract

```typescript
@injectable()
export class ComisionService {
  calcularComision(totalServicios: number, porcentajeComision: number): number
  calcularMontoTotal(totalServicios: number, totalProductos: number, propina: number): number
  calcularMontoPendiente(totalServicios: number, totalProductos: number, totalPagado: number): number
  calcularIngresoSalon(totalServicios: number, totalProductos: number): number
}
```

Rules: commission ONLY on `totalServicios`; propina excluded from `montoPendiente` and salon revenue; retoque sets `totalServicios=0`.

## CreateRegistroUseCase Pseudocode (QueryRunner Transaction)

```
execute(dto: CreateRegistroDTO): RegistroServicioDTO {
  qr = dataSource.createQueryRunner()
  await qr.connect(); await qr.startTransaction()
  try {
    manager = qr.manager
    // 1. Validate FK existence
    // 2. Sum duracionMinutos from serviciosIds
    // 3. For divisiones: validate division usuarioIds exist
    // 4. ComisionService → comision, montoTotal, montoPendiente
    // 5. manager.save(RegistroServicioEntity) — sets cascade for pagos[] + divisiones[]
    // 6. manager.save(ClienteEntity) — ultimaVisita, totalServicios++, deudaTotal += montoPendiente
    // 7. manager.decrement(ProductoEntity, { stock }, { id: In(productoIds) }) — si venta de productos
    // 8. await qr.commitTransaction()
    return this.toDTO(saved)
  } catch(e) {
    await qr.rollbackTransaction()
    throw e
  } finally { await qr.release() }
}
```

UUID idempotency key in payload to detect duplicate submissions (409 Conflict).

## Route Table (~18 endpoints)

| Method | Path | Use Case | Auth |
|--------|------|----------|------|
| GET | `/:salonId/registros` | ListRegistros | auth |
| POST | `/:salonId/registros` | CreateRegistro | DUEÑA,ADMIN,RECEPCIONISTA |
| GET | `/:salonId/registros/:id` | GetRegistro | auth |
| DELETE | `/:salonId/registros/:id` | AnularRegistro | DUEÑA,ADMIN |
| GET | `/:salonId/registros/:id/devoluciones` | ListDevoluciones | auth |
| POST | `/:salonId/devoluciones` | CreateDevolucion | DUEÑA,ADMIN,RECEPCIONISTA |
| GET | `/:salonId/gastos` | ListGastos | auth |
| POST | `/:salonId/gastos` | CreateGasto | DUEÑA,ADMIN |
| DELETE | `/:salonId/gastos/:id` | DeleteGasto | DUEÑA,ADMIN |
| GET | `/:salonId/finanzas/resumen` | ResumenDia | auth |
| GET | `/:salonId/finanzas/roi` | ROIMensual | auth |
| GET | `/:salonId/finanzas/nomina` | NominaPendiente | auth |
| POST | `/:salonId/finanzas/nomina/liquidar` | LiquidarEmpleada | DUEÑA,ADMIN |
| GET | `/:salonId/finanzas/nomina/historial` | HistorialLiquidaciones | auth |
| GET | `/:salonId/finanzas/turno/:usuarioId` | CierreTurno | auth |
| GET | `/:salonId/finanzas/nomina/:id` | GetLiquidacion | auth |

All under `router.use('/api/salones/:salonId', finanzasRouter)` in `app.ts`.

## DI Container Additions

**Repos (string tokens):** `IRegistroServicioRepository`, `IPagoTransaccionRepository`, `IDivisionRegistroRepository`, `ILiquidacionRepository`, `IGastoRepository`, `IDevolucionRepository` → 6 lines.

**Service:** `ComisionService` → 1 line.

**Use cases (class tokens):** 16 use cases (4 registro + 3 gasto + 2 devolucion + 3 liquidacion + 3 reporte + 1 getLiquidacion) → 16 lines.

**Controllers:** 5 controllers → 5 lines.

Total: ~28 new `container.register()` calls in `shared/container.ts`.

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit | ComisionService arithmetic | Pure function tests — verify commission exclusion, propina exclusion, zero montoPendiente edge cases |
| Unit | Use cases with mocked repos | Mock all port methods; assert correct DTO transformation and error propagation |
| Integration | CreateRegistroUseCase | Full QueryRunner path: create with payments + divisions, verify DB state, verify rollback on failure |
| Integration | LiquidarEmpleadaUseCase | Verify only `estaPagadaEmpleada=false` registros marked; LiquidacionEntity totals match |
| Integration | ROIMensual | Seed data across registros/gastos/liquidaciones; assert ROI formula matches manual calc |

## Open Questions

- [ ] UUID idempotency key: add `idempotencyKey` column to `RegistroServicioEntity` or use separate lookup table? (required for duplicate detection)
- [ ] `DivisionRegistroEntity` uses `porcentajeParticipacion` — confirm if percentages must sum to 100% and validate server-side
- [ ] Rate-limiting on report endpoints (ROIMensual aggregates across months — could be heavy with large data)
