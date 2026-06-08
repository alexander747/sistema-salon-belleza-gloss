import { injectable, inject } from 'tsyringe';
import type { IPrestamoRepository } from '../../domain/ports/IPrestamoRepository';
import type { IGastoRepository } from '../../../finanzas/domain/ports/IGastoRepository';
import type { IUsuarioRepository } from '../../../personas/domain/ports/IUsuarioRepository';
import type { PrestamoDTO } from '../dtos/PrestamoDTO';
import type { CrearPrestamoInput } from '../dtos/CrearPrestamoDTO';
import { ValidationError } from '../../../../shared/errors';
import { MetodoPago } from '../../../../infrastructure/persistence/entities/PagoTransaccionEntity';

@injectable()
export class CrearPrestamoUseCase {
  constructor(
    @inject('IPrestamoRepository')
    private readonly prestamoRepo: IPrestamoRepository,
    @inject('IGastoRepository')
    private readonly gastoRepo: IGastoRepository,
    @inject('IPersonasUsuarioRepository')
    private readonly usuarioRepo: IUsuarioRepository,
  ) {}

  async execute(input: CrearPrestamoInput): Promise<PrestamoDTO> {
    // Validar que exactamente uno de usuarioId o nombreTercero esté presente
    if (!input.usuarioId && !input.nombreTercero) {
      throw new ValidationError('Debe especificar un empleado o un nombre de tercero');
    }
    if (input.usuarioId && input.nombreTercero) {
      throw new ValidationError('No puede especificar empleado y tercero simultáneamente');
    }

    // Si es a empleado, verificar que exista
    let nombreEmpleado: string | null = null;
    if (input.usuarioId) {
      const empleado = await this.usuarioRepo.findBySalonAndId(input.salonId, input.usuarioId);
      if (!empleado) {
        throw new ValidationError('Empleado no encontrado en este salón');
      }
      nombreEmpleado = empleado.nombre;
    }

    const prestamo = await this.prestamoRepo.create({
      salonId: input.salonId,
      usuarioId: input.usuarioId ?? null,
      nombreTercero: input.nombreTercero ?? null,
      monto: input.monto,
      saldoPendiente: input.monto,
      motivo: input.motivo ?? undefined,
      estado: 'ACTIVO',
      fechaCreacion: new Date(),
    });

    // Opción A: Crear gasto automático
    const nombreParaGasto = nombreEmpleado ?? input.nombreTercero ?? 'desconocido';
    await this.gastoRepo.create({
      salonId: input.salonId,
      descripcion: `Préstamo a ${nombreParaGasto}`,
      monto: input.monto,
      metodoPago: MetodoPago.EFECTIVO,
      esGastoFijo: false,
      categoria: 'Prestamo',
      fecha: new Date(),
      reportadoPorId: input.registradoPorId,
    });

    return this.mapToDTO(prestamo, nombreEmpleado);
  }

  private mapToDTO(prestamo: Record<string, unknown> | any, nombreEmpleado: string | null): PrestamoDTO {
    return {
      id: prestamo.id,
      salonId: prestamo.salonId,
      usuarioId: prestamo.usuarioId,
      nombreEmpleado,
      nombreTercero: prestamo.nombreTercero,
      monto: Number(prestamo.monto),
      saldoPendiente: Number(prestamo.saldoPendiente),
      motivo: prestamo.motivo,
      estado: prestamo.estado,
      fechaCreacion: prestamo.fechaCreacion?.toISOString?.() ?? prestamo.fechaCreacion,
      creadoEn: prestamo.creadoEn?.toISOString?.() ?? prestamo.creadoEn,
      actualizadoEn: prestamo.actualizadoEn?.toISOString?.() ?? prestamo.actualizadoEn,
    };
  }
}
