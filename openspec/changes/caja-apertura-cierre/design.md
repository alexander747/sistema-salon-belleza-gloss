# Design: Caja — Apertura y Cierre

## Technical Approach

Backend-first: 3 migraciones → `CajaEntity` → `ICajaRepository`/`TypeORMCajaRepository` → 4 use cases + `calcularReporteCierre` (pure function) + `verificarCajaAbierta` (shared guard) → `CajaController` + rutas + schemas Zod (rebuild validation dist) → container → regla de oro en 3 chokepoints → mirrors n8n. Cierre reporta al-vuelo desde `registros_servicio`/`gastos` por `cajaId` — sin snapshot. Envelope `{ ok, data, error }` en endpoints nuevos de caja; errores con códigos machine-readable. Luego frontend (tab Caja + banners + manejo de `CAJA_CERRADA`).

## Architecture Decisions

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Envelope en TODOS los endpoints vs solo caja | Dashboard lee `response.data` crudo (registros, gastos) → envolver todo rompe el frontend | **Solo endpoints nuevos de caja** devuelven `{ ok: true, data }`; `errorHandler` agrega `ok:false, data:null` (aditivo, seguro: frontend nunca parsea error bodies) |
| Códigos de error: `details.code` vs subclases | `errorHandler` emite `code: err.code` — **no** promueve `details.code` (verificado en errorHandler.ts) | **4 subclases nuevas** en `shared/errors.ts`: `CajaCerradaError` (422), `CajaYaAbiertaError` (409), `CajaYaCerradaError` (409), `CajaNoAbiertaError` (404) |
| Snapshot `caja_cierre_detalle` vs al-vuelo | Snapshot: consistente pero duplica datos (owner: fuera de v1) | **Al-vuelo**: reporte calculado en cierre por `cajaId`; sin tabla extra |
| Arqueo: efectivo vs todos los pagos | Spec "Reporte completo" sugiere montoEsperado=Σtodos los pagos−Σgastos (260000) | **Decisión owner gana: SOLO EFECTIVO** — `montoEsperado = Σ pagos EFECTIVO − Σ gastos EFECTIVO`. Reporte muestra breakdown completo como info. (Ver Gotchas #3) |
| Reapertura mismo día | Reabrir permite corregir cierres | **No en v1**: `UNIQUE(salon_id, fecha_caja)` + 409 `CAJA_YA_CERRADA` |
| Race cierre | Doble cierre | **`UPDATE cajas SET estado='CERRADA'... WHERE id=? AND estado='ABIERTA'`** — 0 filas → 409 |
| Race apertura | Doble insert | Pre-check (ABIERTA→409 CAJA_YA_ABIERTA, CERRADA→409 CAJA_YA_CERRADA) + backstop `ER_DUP_ENTRY` (re-query para elegir código) |
| `aperturaPorId/cierrePorId` NOT NULL vs NULL | n8n no tiene `req.user` (apiKeyGuard no setea user) | **NULLABLE**; use cases reciben `aperturaPorId?: number` = `req.user?.id` |
| Preview esperado en modal de cierre | Sin endpoint, el frontend duplicaría lógica de agregación | **Endpoint read-only adicional** `GET /caja/actual/esperado` (misma función pura, sin persistir) |
| CajaTab inline en FinanzasPage vs componente | FinanzasPage ya tiene ~3.200 líneas | **Componente separado** `components/caja/CajaTab.tsx` + `CajaBanner.tsx` |
| `fechaCaja` | Día comercial Colombia | `getColombiaDateString()` (05:00 UTC) — colombia-date.ts |

## Data Model — CajaEntity

`apps/api/src/infrastructure/persistence/entities/CajaEntity.ts` (extends BaseEntity: id, creadoEn, actualizadoEn):

```ts
@Entity('cajas')
@Unique(['salonId', 'fechaCaja'])
export class CajaEntity extends BaseEntity {
  @Column({ type: 'int' }) salonId: number;                       // FK → salones
  @Column({ type: 'date' }) fechaCaja: string;                    // YYYY-MM-DD Colombia
  @Column({ type: 'decimal', precision: 12, scale: 2 }) montoInicial: number;
  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true }) montoEsperado: number | null;
  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true }) montoRealEfectivo: number | null;
  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true }) diferencia: number | null;
  @Column({ type: 'enum', enum: ['ABIERTA', 'CERRADA'], default: 'ABIERTA' }) estado: 'ABIERTA' | 'CERRADA';
  @Column({ type: 'int', nullable: true }) aperturaPorId: number | null;   // FK → usuarios
  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' }) aperturaEn: Date;
  @Column({ type: 'int', nullable: true }) cierrePorId: number | null;
  @Column({ type: 'datetime', nullable: true }) cierreEn: Date | null;
  // Relations: ManyToOne salon, ManyToOne aperturaPor (UsuarioEntity, nullable), ManyToOne cierrePor (nullable)
  @Index() @Column({ type: 'int', nullable: true }) ... 
}
```

### Migraciones (estilo 0008 — SQL crudo)

| Migración | SQL up | SQL down |
|---|---|---|
| `1700000000009-CreateCajas.ts` | `CREATE TABLE cajas (id INT AUTO_INCREMENT PRIMARY KEY, salonId INT NOT NULL, fechaCaja DATE NOT NULL, montoInicial DECIMAL(12,2) NOT NULL DEFAULT 0, montoEsperado DECIMAL(12,2) NULL, montoRealEfectivo DECIMAL(12,2) NULL, diferencia DECIMAL(12,2) NULL, estado ENUM('ABIERTA','CERRADA') NOT NULL DEFAULT 'ABIERTA', aperturaPorId INT NULL, aperturaEn DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, cierrePorId INT NULL, cierreEn DATETIME NULL, creadoEn DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), actualizadoEn DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), CONSTRAINT UNIQUE caja_salon_fecha (salonId, fechaCaja), CONSTRAINT FK caja_salon FOREIGN KEY (salonId) REFERENCES salones(id), CONSTRAINT FK caja_apertura FOREIGN KEY (aperturaPorId) REFERENCES usuarios(id), CONSTRAINT FK caja_cierre FOREIGN KEY (cierrePorId) REFERENCES usuarios(id)); CREATE INDEX idx_caja_salon_estado ON cajas (salonId, estado);` | `DROP TABLE cajas` |
| `1700000000010-AddCajaIdRegistros.ts` | `ALTER TABLE registros_servicio ADD cajaId INT NULL; ALTER TABLE registros_servicio ADD CONSTRAINT FK_reg_caja FOREIGN KEY (cajaId) REFERENCES cajas(id); CREATE INDEX idx_reg_caja ON registros_servicio (cajaId);` | drop FK + index + column |
| `1700000000011-AddCajaIdGastos.ts` | `ALTER TABLE gastos ADD cajaId INT NULL; ALTER TABLE gastos ADD CONSTRAINT FK_gasto_caja FOREIGN KEY (cajaId) REFERENCES cajas(id); CREATE INDEX idx_gasto_caja ON gastos (cajaId);` | drop FK + index + column |

Sin backfill: filas legacy con `cajaId NULL` válidas (specs finanzas-registros/gastos).

## Repository Interface — `domain/ports/ICajaRepository.ts`

```ts
export interface ICajaRepository {
  findBySalonYFecha(salonId: number, fechaCaja: string): Promise<CajaEntity | null>;   // cualquier estado
  findAbiertaBySalonYFecha(salonId: number, fechaCaja: string): Promise<CajaEntity | null>;
  create(data: Partial<CajaEntity>): Promise<CajaEntity>;
  /** UPDATE condicional — devuelve true si 1 fila afectada (estado era ABIERTA) */
  cerrar(id: number, data: { montoEsperado: number; montoRealEfectivo: number; diferencia: number; cierrePorId?: number | null }): Promise<boolean>;
  listBySalonPaginated(salonId: number, page: number, limit: number, estado?: 'ABIERTA' | 'CERRADA'): Promise<{ data: CajaEntity[]; total: number }>;
}
```

`TypeORMCajaRepository` usa el patrón `getRepo()` de TypeORMGastoRepository; `cerrar()` con `queryBuilder.update().set(...).where('id = :id AND estado = :estado', { estado: 'ABIERTA' }).execute()` → `result.affected === 1`. `listBySalonPaginated` ordena `fechaCaja DESC` con skip/take + `getCount()` (patrón search/count existente).

## Use Cases — `application/use-cases/caja/`

### AbrirCajaUseCase
- Input: `{ salonId, montoInicial, aperturaPorId? }`. Output: `CajaDTO`.
- Pasos: `findBySalonYFecha(salonId, getColombiaDateString())` → existente ABIERTA → `CajaYaAbiertaError`; CERRADA → `CajaYaCerradaError`. `create({ salonId, fechaCaja, montoInicial, estado: 'ABIERTA', aperturaPorId, aperturaEn: new Date() })`. Catch `ER_DUP_ENTRY` → re-query → lanzar el 409 correspondiente.
- Sin transacción (1 insert).

### CerrarCajaUseCase
- Input: `{ salonId, montoRealEfectivo, cierrePorId? }`. Output: `ReporteCierreDTO` + caja CERRADA.
- Pasos: `findBySalonYFecha(salonId, hoy)` → null → `CajaNoAbiertaError` (404); `estado !== 'ABIERTA'` → `CajaYaCerradaError` (409). Cargar movimientos: `registroRepo.search({ salonId, cajaId })` + `gastoRepo.findByCajaId(cajaId)` — **nuevo método `findByCajaId(cajaId)` en `IGastoRepository`/`TypeORMGastoRepository`**; registrar movimientos: `registroRepo.search` filtrado por cajaId (nuevo param opcional `cajaId` en `search()`/`count()` de IRegistroServicioRepository). `reporte = calcularReporteCierre(registros, gastos, montoRealEfectivo)`. `cerrar(id, {...})` → false → `CajaYaCerradaError` (race). Persistir `montoEsperado/montoRealEfectivo/diferencia/cierrePorId/cierreEn` solo si el update condicional ganó.
- Sin transacción larga: el update condicional es el guard atómico.

### calcularReporteCierre (pure function — `calcularReporteCierre.ts`)
Input: `registros: RegistroServicioEntity[]` (con `pagos`), `gastos: GastoEntity[]`, `montoRealEfectivo`. Filtra `estado !== ANULADO`. Acumula:

```
totalServicios   = Σ r.totalServicios            totalProductos = Σ r.totalProductos
descuentos       = Σ (valorOriginal − valorFinal) donde precioAjustado
comisiones       = Σ r.comisionCalculada
porMetodoPago    = { EFECTIVO: Σ p.monto, TARJETA: ..., TRANSFERENCIA: ... } (todas las pagos)
ingresosBrutos   = totalServicios + totalProductos
ingresosNetos    = ingresosBrutos − descuentos
gastosTotal      = Σ g.monto
montoEsperado    = porMetodoPago.EFECTIVO − Σ g.monto donde g.metodoPago === EFECTIVO   ← arqueo cash-only
diferencia       = montoRealEfectivo − montoEsperado
cantidadMovimientos = registros.length + gastos.length
```

### ObtenerCajaActualUseCase
`findAbiertaBySalonYFecha` → null → `CajaNoAbiertaError`; retorna `CajaDTO`.

### ListarCierresCajaUseCase
`listBySalonPaginated(salonId, page, limit, estado ?? 'CERRADA')` → `paginate()` → `{ data, meta }` (patrón pagination.ts, spec: primer item = fechaCaja más reciente).

### verificarCajaAbierta — `application/services/verificarCajaAbierta.ts`

```ts
export async function verificarCajaAbierta(cajaRepo: ICajaRepository, salonId: number): Promise<CajaEntity> {
  const caja = await cajaRepo.findAbiertaBySalonYFecha(salonId, getColombiaDateString());
  if (!caja) throw new CajaCerradaError('No hay caja abierta...');
  return caja;
}
```

## Golden Rule — chokepoints

| Chokepoint | Inyección | Ubicación | Acción |
|---|---|---|---|
| `CreateRegistroUseCase` | `@inject('ICajaRepository')` | Paso 0, **antes** de validar cliente | `const caja = await verificarCajaAbierta(...)`; `cajaId: caja.id` en `registroRepo.create({...}, queryRunner)` — dentro de la transacción existente |
| `CompletarCitaUseCase` | `@inject('ICajaRepository')` | Tras `findById`, **antes** de `cambiarEstado(cita, COMPLETADA)` | `verificarCajaAbierta(repo, cita.salonId)` → 422 CAJA_CERRADA, cita queda en estado previo |
| `CambiarEstadoCitaUseCase` | `@inject('ICajaRepository')` | Solo si `input.estado === COMPLETADA` (tras `validarTransicion`) | `verificarCajaAbierta(repo, cita.salonId)`; otros estados no bloqueados |

`CreateGastoUseCase`: `findAbiertaBySalonYFecha(salonId, hoy)` → `cajaId: caja?.id ?? null`. **No** lanza 422 (spec gastos).

## Controller / Rutas — `presentation/controllers/CajaController.ts` + `finanzas.routes.ts`

| Endpoint | Roles (requireRole) | Validate | Resp |
|---|---|---|---|
| `POST /salones/:salonId/caja/abrir` | S, D, A, R | `abrirCajaSchema` `{ montoInicial: z.number().min(0) }` | 201 `{ ok: true, data: CajaDTO }` |
| `POST /salones/:salonId/caja/cerrar` | S, D, A, R | `cerrarCajaSchema` `{ montoRealEfectivo: z.number().min(0) }` | 200 `{ ok: true, data: ReporteCierreDTO }` |
| `GET /salones/:salonId/caja/actual` | S, D, A, R | — | 200 `{ ok: true, data: CajaDTO }` / 404 |
| `GET /salones/:salonId/caja/actual/esperado` | S, D, A, R | — | 200 `{ ok: true, data: { montoEsperado, porMetodoPago, ... } }` (preview arqueo, al-vuelo) |
| `GET /salones/:salonId/caja/cierres` | S, D, A, R | `paginationSchema` + `estado?` | 200 `{ ok: true, data: { data, meta } }` |

Controller pasa `salonId: req.salonId!`, `aperturaPorId/cierrePorId: req.user?.id`. Schemas en `packages/validation/src/caja.schema.ts` + exports en index.ts → **reconstruir dist** (`cd packages/validation && npx tsc`). Errores salen del `errorHandler` (modificado: `{ ok:false, data:null, error:{code,message,details} }`).

## n8n Mirrors — `presentation/routes/n8n.routes.ts`

```
GET  /:salonId/caja/actual          → apiKeyGuard, tenantGuard, cajaController.actual
GET  /:salonId/caja/actual/esperado → apiKeyGuard, tenantGuard, cajaController.actualEsperado
POST /:salonId/caja/abrir           → apiKeyGuard, tenantGuard, cajaController.abrir
POST /:salonId/caja/cerrar          → apiKeyGuard, tenantGuard, cajaController.cerrar
GET  /:salonId/caja/cierres         → apiKeyGuard, tenantGuard, cajaController.cierres
```

Mismos handlers del controller → mismo shape (spec API-First). `req.user` undefined en n8n → auditores null (columnas nullable).

## Frontend

- **`components/caja/CajaBanner.tsx`** (nuevo): fetch `GET /salones/:id/caja/actual` en mount + expone `onRefresh`/custom event `caja-refresh` para refrescar tras abrir/cerrar. Banner: `"Caja abierta 💰 $montoInicial"` (verde) o `"Caja cerrada — Abrir para vender"` (ámbar, link a tab Caja). Se monta en **FinanzasPage, AgendaPage, VentasPage** (bajo el header/toolbar).
- **`components/caja/CajaTab.tsx`** (nuevo, ~450 líneas, auto-contenido como WalkInModal):
  - Estado actual: badge ABIERTA con montoInicial + total esperado, o "Caja cerrada" + botón **Abrir** (modal `AbrirCajaModal` inline: input `montoInicial`, POST `/caja/abrir`).
  - Botón **Cerrar** → modal arqueo: `GET /caja/actual/esperado` muestra efectivo esperado + breakdown por método; input `montoRealEfectivo`; preview `diferencia` en vivo; POST `/caja/cerrar` → render del `ReporteCierreDTO` (servicios/productos/descuentos/netos/porMetodoPago/comisiones/gastos/esperado/real/diferencia/cantidad).
  - **Historial**: tabla paginada `GET /caja/cierres?page=&limit=12` (fecha, apertura, cierre, esperado, real, diferencia, estado).
  - Dispara `caja-refresh` tras abrir/cerrar.
- **FinanzasPage.tsx**: `TabKey` + TABS += `{ key: 'caja', label: '💰 Caja' }`, render `<CajaTab/>`, banner montado.
- **Manejo CAJA_CERRADA** (WalkInModal, AgendaPage `handleConfirmarCompletar`, VentasPage POST registros): en `catch`, si `err.response?.data?.error?.code === 'CAJA_CERRADA'` → mensaje visible "Abrí la caja primero para vender" + **modal/flujo permanece abierto** + `dispatchEvent('caja-refresh')`. AgendaPage: `setCompletarError(...)` (nuevo estado) en lugar de solo console.error.

## Testing Strategy

Nuevos: `use-cases/caja/__tests__/{AbrirCajaUseCase,CerrarCajaUseCase,ObtenerCajaActualUseCase,ListarCierresCajaUseCase,calcularReporteCierre}.test.ts`, `services/__tests__/verificarCajaAbierta.test.ts`, `controllers/__tests__/CajaController.test.ts`, `gasto/CreateGastoUseCase.test.ts` (no existe hoy), `cita/CompletarCitaUseCase.test.ts` (no existe hoy). Schemas: `caja.schema.test.ts` (patrón finanzas.schema.test.ts).
Modificados: `CreateRegistroUseCase.test.ts` (mock ICajaRepository + casos golden rule), `CambiarEstadoCitaUseCase.test.ts` (deps + solo COMPLETADA). Patrón de mocks: vi.mock de entities/database como en CreateRegistroUseCase.test.ts. Dashboard: `CajaBanner.test.tsx` + `CajaTab.test.tsx` (light). Cobertura ≥80% (verify corre `vitest run --coverage`).

## Migration / Rollout

Migraciones 0009→0011 secuenciales (`migrationsRun: production`). Rollback: `down()` en orden inverso; quitar checks de chokepoints; datos de cajas se conservan; `cajaId NULL` mantiene operación. Sin feature flags. Rebuild validation dist antes de levantar API (gotcha ESM/dotenv aplica a entrypoints, no a este cambio).

## Size Estimates (changed lines) — alimenta sdd-tasks

| Archivo | ± | | Archivo | ± |
|---|---|---|---|---|
| 3 migraciones (0009-0011) | 100 | | `errors.ts` (+4 subclases) | 40 |
| `CajaEntity.ts` | 75 | | `CreateRegistroUseCase.ts` (mod) | 15 |
| `RegistroServicioEntity.ts` (mod) | 10 | | `CreateGastoUseCase.ts` (mod) | 12 |
| `GastoEntity.ts` (mod) | 10 | | `CompletarCitaUseCase.ts` (mod) | 10 |
| `ICajaRepository.ts` | 15 | | `CambiarEstadoCitaUseCase.ts` (mod) | 12 |
| `TypeORMCajaRepository.ts` | 130 | | `IGastoRepository` + `TypeORMGastoRepository` (mod, findByCajaId) | 20 |
| `IRegistroServicioRepository` + `TypeORM...` (mod, cajaId filter) | 25 | | `verificarCajaAbierta.ts` | 20 |
| `calcularReporteCierre.ts` | 90 | | `CajaDTO.ts` + `ReporteCierreDTO.ts` | 75 |
| 4 use cases caja | 195 | | `CajaController.ts` | 120 |
| `finanzas.routes.ts` (mod) | 25 | | `n8n.routes.ts` (mod) | 15 |
| `caja.schema.ts` + index validation (mod) | 35 | | `container.ts` (mod) | 25 |
| Tests backend nuevos | 540 | | Tests backend modificados | 170 |
| **Backend total** | **~1.900** | | | |
| `CajaBanner.tsx` | 90 | | `CajaTab.tsx` (+modals) | 450 |
| `FinanzasPage.tsx` (mod) | 30 | | `AgendaPage.tsx` (mod) | 25 |
| `VentasPage.tsx` (mod) | 20 | | `WalkInModal.tsx` (mod) | 15 |
| Tests frontend | 140 | | **Frontend total** | **~770** |
| Specs openspec (docs) | 400 | | **TOTAL** | **~3.070** |

## Chained PR Split (delivery: auto-forecast; budget 800 líneas → 4 PRs)

| PR | Alcance | Inicio | Fin | Verificación |
|---|---|---|---|---|
| **PR1 — Backend caja** | Migraciones 0009-0011 + CajaEntity + repo + use cases + `calcularReporteCierre` + guard + errores + controller + rutas + schemas + container + n8n + specs openspec (~1.600) | `git checkout -b feat/caja-backend` | API sirve los 5 endpoints + 4 códigos de error | `cd apps/api && npx vitest run` + tsc + curls manuales |
| **PR2 — Regla de oro** | Chokepoints en CreateRegistro/CreateGasto/CompletarCita/CambiarEstadoCita + tests actualizados (~350) | branch desde PR1 | POST /registros y completar → 422 CAJA_CERRADA sin caja | vitest + curl 422/201 |
| **PR3 — Frontend Caja** | CajaTab + modals + CajaBanner + tab FinanzasPage (~600) | branch desde PR2 | Abrir/cerrar desde UI, historial paginado | `cd apps/pos-dashboard && npx vitest run` + manual |
| **PR4 — Errores CAJA_CERRADA** | Manejo en WalkInModal/AgendaPage/VentasPage + tests (~230) | branch desde PR3 | Flujo de venta con caja cerrada muestra banner y mantiene modal | Manual E2E + vitest |

Cada PR con rama propia encadenada (child apunta al branch del previo), scope autónomo y rollback independiente (PR2: quitar guards; PR3/4: revert UI).

## Open Questions

Ninguna — conflictos resueltos (ver gotchas 3 y 5).

## Gotchas encontrados al estudiar el código

1. **`errorHandler` no promueve `details.code`** → códigos custom (`CAJA_*`) requieren subclases de `AppError`, no `details`.
2. **No envolver respuestas exitosas globalmente**: FinanzasPage lee `response.data` crudo (`results[0].value.data` como array) — el envelope `{ok,data}` solo en endpoints nuevos de caja.
3. **Conflicto spec vs owner en arqueo**: escenario "Reporte completo" (finanzas-caja spec) espera `montoEsperado=260000` (= todos los pagos − gastos), pero la decisión owner es cash-only (`Σ EFECTIVO − Σ gastos EFECTIVO`). **Gana la decisión owner**; escenario del spec debe ajustarse en sdd-verify (gastos sin metodoPago asumidos EFECTIVO: 200000−30000=170000).
4. **`MetodoPago` enum es `EFECTIVO|TARJETA|TRANSFERENCIA`** (sin TARJETA_CREDITO/DEBITO) — las claves de `porMetodoPago` usan el enum, no los labels del frontend.
5. **No existen tests** para `CompletarCitaUseCase` ni `CreateGastoUseCase` → son tests nuevos, no modificaciones.
6. **Validation package requiere rebuild** (`npx tsc` en packages/validation) tras agregar schemas — el API importa de `dist/`.
7. **n8n sin `req.user`** → auditores de apertura/cierre nullable; el guard de roles no aplica en mirrors (la API key es el control).
8. Siguiente numeración de migración: `1700000000009`+ (existen hasta 0008).
9. `RegistroServicioEntity` ya tiene `liquidacionId` nullable como precedente de FK nullable — `cajaId` sigue el mismo patrón.
10. La **búsqueda de movimientos por cajaId** necesita params nuevos en `IRegistroServicioRepository.search` y `IGastoRepository.findByCajaId` — el repo de registros ya tiene el patrón search/count a replicar.
