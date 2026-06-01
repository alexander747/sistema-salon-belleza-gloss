import { injectable } from 'tsyringe';

@injectable()
export class ComisionService {
  /**
   * Calcula la comisión sobre el total de servicios.
   * La comisión se aplica SOLO sobre totalServicios, NO sobre productos ni propina.
   */
  calcularComision(totalServicios: number, porcentajeComision: number): number {
    return Number((totalServicios * (porcentajeComision / 100)).toFixed(2));
  }

  /**
   * Calcula el monto total del registro: servicios + productos + propina.
   */
  calcularMontoTotal(totalServicios: number, totalProductos: number, propina: number): number {
    return Number((totalServicios + totalProductos + propina).toFixed(2));
  }

  /**
   * Calcula el monto pendiente de pago.
   * Propina NO incluida — el cliente paga servicios + productos.
   */
  calcularMontoPendiente(totalServicios: number, totalProductos: number, totalPagado: number): number {
    const pendiente = totalServicios + totalProductos - totalPagado;
    return Number(Math.max(0, pendiente).toFixed(2));
  }

  /**
   * Calcula el ingreso del salón: servicios + productos (propina excluida).
   */
  calcularIngresoSalon(totalServicios: number, totalProductos: number): number {
    return Number((totalServicios + totalProductos).toFixed(2));
  }
}
