export interface NominaPendienteDTO {
  usuarioId: number;
  nombre: string;
  totalServicios: number;
  totalComisiones: number;
  totalPropinas: number;
  sueldoFijo: number;
  bonoHorario: number;
  totalAPagar: number;
  /**
   * PR3 — costo base de insumos del período. INFORMATIVO: ya está descontado de
   * la comisión, no se resta de `totalAPagar`. Opcional para no romper consumidores.
   */
  totalCostoBaseInsumos?: number;
}
