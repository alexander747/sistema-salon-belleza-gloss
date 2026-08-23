# Proposal: Ventas fiado y deudas por cobrar

## Intent

Vender servicios/productos con pago parcial o diferido (fiado). El salón asume la deuda: la empleada cobra comisión completa igual. **Decisión del dueño (contabilidad de CAJA): el ingreso se cuenta cuando se cobra** — el informe debe mostrar también lo fiado (deudas por cobrar a clientes).

## Scope

**In:**
- UI venta (WalkInModal/VentasPage/AgendaPage completar): toggle "Fiado" + monto a cobrar editable para todos los métodos + "queda $X pend."
- Abono posterior: `AbonarDeudaUseCase` + `POST /registros/:id/pagos` + migración `pagos_transaccion.cajaId`
- Arqueo: abonos entran en la caja del día recibido; fix `CierreTurno.totalAEntregar` → cobrado
- Reportes cash-basis: P&L/Resumen/ROI cuentan el ingreso cobrado + líneas "Fiado del período" y "Deudas por cobrar (acumulado)"
- Cuentas: acción "Cobrar/Abonar" por fila CLIENTE + modal + refresh; DTO de cobrar con desglose por registro
- Excel export: columna pendiente + filas cobrado/fiado

**Out:** comisión empleada sin cambios (invariante, decisión #4); anulación con pago parcial solo documentada (#9); `cliente.deudaTotal` desnormalizada se mantiene (#8); préstamos read-only en la lista; mobile/n8n con contrato API igual.

## Capabilities

- **Modified** `finanzas-registros`: pago parcial/fiado en alta (contrato ya acepta `pagos[]`; se documenta `montoPendiente = max(0, valorFinal − propina − Σpagos)`); NUEVO `POST /registros/:id/pagos`
- **Modified** `finanzas-caja`: arqueo cuenta pagos por su `pago.cajaId` (abonos del día, sin doble conteo)
- **Modified** `finanzas-reportes`: cash-basis + líneas fiado/deudas
- **Modified** `finanzas-cuentas`: acción cobrar/abonar + desglose por registro

## Approach

Backend-first (migración + abono + arqueo, luego reportes), después UI venta, por último UI deudas. Rebuild obligatorio de `packages/validation`. TDD estricto.

## API Surface

- `POST /registros/:id/pagos` `{monto, metodoPago, referencia?}` → 201; 404 `REGISTRO_NO_ENCONTRADO`; 422 `REGISTRO_ANULADO`/`CAJA_CERRADA`; 409 `MONTO_EXCEDE_PENDIENTE`
- `POST /registros`: `pagos: [] | [{monto: 0..valorFinal}]` — contrato sin cambios
- P&L/Resumen/ROI: +`cobrado`, `fiadoPeriodo`, `deudasPorCobrar`

## Data Model

`pagos_transaccion.cajaId` (FK nullable, ON DELETE SET NULL; DB_SYNCHRONIZE la crea). Backfill opcional `pagos.cajaId = registro.cajaId`. `CreateRegistro` setea `pago.cajaId` desde ahora.

## PR Plan (stacked-to-main)

| PR | Alcance | Est. líneas |
|----|---------|-------------|
| PR1 | Backend abonos: migración + `AbonarDeudaUseCase` + ruta + arqueo por caja + DTO cuentas | ~500-600 |
| PR2 | Backend reportes: cash-basis P&L/Resumen/ROI + CierreTurno + Excel | ~400-500 |
| PR3 | Frontend venta: fiado/parcial en 3 flujos | ~350-450 |
| PR4 | Frontend deudas: modal Cobrar/Abonar + refresh | ~300-400 |

## Risks

| Riesgo | Prob | Mitigación |
|--------|------|------------|
| Tests de reportes se rompen (cash) | Alta | Fixtures actualizados; devengado queda informativo |
| Abono cae en caja vieja (backfill incompleto) | Media | COALESCE fecha recepción + fallback registro |
| Rebuild de validation olvidado | Media | Task explícita en PR1 |
| Doble conteo en arqueo | Media | Query única: `p.cajaId = C OR (p.cajaId IS NULL AND r.cajaId = C)` |

## Rollback

Revertir por PR. La columna `cajaId` nullable queda inerte si se revierte el código. Rebuild + restart API.

## Dependencies

Rebuild `packages/validation` + restart API. PR2 y PR4 dependen de PR1; PR3 independiente.

## Success Criteria

- [ ] Venta fiada crea `montoPendiente = valorFinal − propina`; comisión completa
- [ ] Abono decrementa montoPendiente + deudaTotal y entra en el arqueo de HOY
- [ ] P&L muestra cobrado/fiadoPeriodo/deudasPorCobrar y utilidadNeta en base caja
- [ ] Cuentas "Por cobrar" permite abonar y refresca sin recargar
- [ ] vitest api + dashboard verdes; tsc sin errores nuevos
