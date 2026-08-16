# Proposal: Cuentas por Cobrar y Pagar (read-only v1)

## Intent

La dueña necesita visibilidad de la deuda pendiente de clientes (por cobrar) y de lo que el salón adeuda a empleadas (por pagar). Hoy la deuda solo existe como `cliente.deudaTotal` (deriva: devoluciones y descuentos no la ajustan) y la nómina pendiente vive en el tab Nómina. Este cambio agrega dos endpoints de agregación read-only y un tab "Cuentas" en el dashboard. v1 es SOLO LECTURA: cobrar deuda se difiere hasta corregir bugs de consistencia.

## Scope

### In Scope
- `GET /salones/:salonId/finanzas/cuentas/cobrar` — agregación por cliente de `SUM(montoPendiente)` sobre registros no ANULADOS: `deudaTotal` (computada), `cantidadRegistros`, `antiguedadDias` + bucket (0-30/31-60/61-90/90+), ordenado deuda DESC, paginado.
- `GET /salones/:salonId/finanzas/cuentas/pagar` — por empleada: `pendienteActual` (reusa Nómina) + `liquidadoAcumulado` (suma `totalPagado` del historial) + `sueldoFijo`/`porcentajeComisionServicio`.
- Tab "Cuentas" en FinanzasPage con sub-vistas Cobrar/Pagar (tablas, sin botones de acción).
- Guard de roles: SUPERADMIN, DUEÑA, ADMINISTRADOR, CONTADOR (resto → 403).
- Tests unitarios de use cases, controller y FinanzasPage.

### Out of Scope
- Cobrar deuda (flujo de collection) — follow-up.
- Proveedores (no existen en el dominio).
- Corregir drift de `deudaTotal`, gap de devolución, `montoPendiente` ignorando `valorFinal`.

## Capabilities

### New Capabilities
- `finanzas-cuentas`: agregación read-only de cuentas por cobrar/pagar (2 endpoints GET, roles privilegiados, tab de dashboard).

### Modified Capabilities
None.

## Approach

Agregación pura, sin cambios de schema. Nuevo método de repo `findConDeudaBySalon(salonId)` (queryBuilder con `leftJoinAndSelect('r.cliente')` + `where montoPendiente > 0` + `estado != 'ANULADO'`); agrupar en JS por `clienteId`; antigüedad desde el registro pendiente más antiguo (`min(creadoEn)`) usando `colombia-date.ts`; ordenar y paginar con `paginate()`. CuentasPagar compone los use cases existentes `NominaPendienteUseCase` + `HistorialLiquidacionesUseCase` (unión por `empleadaId`, sin corregir la semántica de frontera de mes — se documenta). Nuevo `CuentasController` + `requireRole(S,D,A,C)` en rutas. `CuentasTab` replica el patrón de sub-tabs de `NominaTab`.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `apps/api/src/modules/finanzas/domain/ports/IRegistroServicioRepository.ts` | Modified | +1 método `findConDeudaBySalon` |
| `apps/api/src/modules/finanzas/infrastructure/persistence/TypeORMRegistroServicioRepository.ts` | Modified | Implementación del query con join a cliente |
| `apps/api/src/modules/finanzas/application/dtos/CuentasDTO.ts` | New | CuentaCobrarDTO, CuentaPagarDTO, AntiguedadBucket |
| `apps/api/src/modules/finanzas/application/use-cases/cuentas/CuentasCobrarUseCase.ts` | New | Agregación por cliente + buckets + paginación |
| `apps/api/src/modules/finanzas/application/use-cases/cuentas/CuentasPagarUseCase.ts` | New | Compone nómina + historial |
| `apps/api/src/modules/finanzas/presentation/controllers/CuentasController.ts` | New | Handlers cobrar/pagar |
| `apps/api/src/modules/finanzas/presentation/routes/finanzas.routes.ts` | Modified | +2 rutas GET con requireRole |
| `apps/api/src/shared/container.ts` | Modified | Registro de use cases + controller |
| `apps/pos-dashboard/src/pages/FinanzasPage.tsx` | Modified | TabKey 'cuentas', TABS, CuentasTab |

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| `deudaTotal` (columna) deriva vs SUM computado | High | v1 computa desde registros; columna no se usa |
| Devolución no reduce `montoPendiente` | Med | Follow-up (a) documentado; v1 read-only |
| `montoPendiente` ignora `valorFinal` (descuento) | Med | Follow-up (b) documentado; deuda visible = pendiente real |
| Frontera de mes en Nómina (sin corrección cross-period) | Med | Reusar salida existente y documentar semántica |
| Skew de tz en antigüedad | Med | Helpers de `colombia-date.ts` |

## Rollback Plan

Remover las 2 rutas, `CuentasController`, los 2 use cases, el método de repo y la entrada del tab. Sin migración ni escrituras de datos — reversión limpia y segura.

## Dependencies

- Salidas de `NominaPendienteUseCase` / `HistorialLiquidacionesUseCase` (existentes).
- `paginationSchema` (@pos-final/validation) + `paginate()` (shared/pagination.ts).
- Sin cambios en `@pos-final/validation` → no requiere rebuild de `dist/`.

## Success Criteria

- [ ] `GET /cuentas/cobrar` devuelve por cliente la suma exacta de `montoPendiente` de registros no anulados, paginada y ordenada DESC.
- [ ] `GET /cuentas/pagar` muestra por empleada `pendienteActual` + `liquidadoAcumulado`.
- [ ] MANICURISTA/RECEPCIONISTA reciben 403 en ambos endpoints.
- [ ] Tab "Cuentas" renderiza ambas sub-vistas sin acciones de mutación.

## FOLLOW-UP (no incluido en este cambio)

- (a) Devolución debe reducir `montoPendiente`/`deudaTotal` (gap en finanzas-registros).
- (b) `montoPendiente` debe usar `valorFinal` cuando `precioAjustado=true` (deuda espuria por descuento).
- (c) Flujo de cobro (cobrar deuda) — cambio separado después de (a)+(b).
