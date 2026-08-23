/**
 * Métodos de pago compartidos (PagoTransaccionEntity y GastoEntity).
 *
 * Módulo propio SIN imports de entidades: evita el ciclo de evaluación
 * `PagoTransaccion → Caja → Salon → Gasto → PagoTransaccion` — GastoEntity
 * lee `MetodoPago` en su decorador durante la evaluación del módulo y, si vive
 * en PagoTransaccionEntity, el binding puede estar aún sin inicializar.
 */
export enum MetodoPago {
  EFECTIVO = 'EFECTIVO',
  TRANSFERENCIA = 'TRANSFERENCIA',
  TARJETA = 'TARJETA',
}
