import { injectable, inject } from 'tsyringe';
import { AppDataSource } from '../../../../../shared/database';
import type { ILiquidacionRepository } from '../../../domain/ports/ILiquidacionRepository';
import type { IRegistroServicioRepository } from '../../../domain/ports/IRegistroServicioRepository';
import type { LiquidacionEntity } from '../../../../../infrastructure/persistence/entities/LiquidacionEntity';

export interface LiquidarEmpleadaInput {
  salonId: number;
  usuarioId: number;
  periodoInicio: Date;
  periodoFin: Date;
  totalComisiones: number;
  totalPropinas: number;
  bonoHorario: number;
  sueldoFijo: number;
  totalPagado: number;
}

@injectable()
export class LiquidarEmpleadaUseCase {
  constructor(
    @inject('ILiquidacionRepository')
    private readonly liquidacionRepo: ILiquidacionRepository,
    @inject('IRegistroServicioRepository')
    private readonly registroRepo: IRegistroServicioRepository,
  ) {}

  async execute(input: LiquidarEmpleadaInput): Promise<LiquidacionEntity> {
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Create the Liquidacion record
      const liquidacion = await this.liquidacionRepo.create({
        salonId: input.salonId,
        usuarioId: input.usuarioId,
        fechaDesde: input.periodoInicio,
        fechaHasta: input.periodoFin,
        totalComisiones: input.totalComisiones,
        totalPropinas: input.totalPropinas,
        bonoHorario: input.bonoHorario,
        sueldoFijo: input.sueldoFijo,
        totalPagado: input.totalPagado,
        estado: 'PAGADA',
      });

      // 2. Find all pending registros for this employee
      const allRegistros = await this.registroRepo.findBySalon(input.salonId);
      const pendingRegistros = allRegistros.filter(
        (r) => r.usuarioId === input.usuarioId && !r.estaPagadaEmpleada,
      );

      // 3. Mark each as paid and link to liquidacion
      for (const registro of pendingRegistros) {
        await this.registroRepo.update(
          registro.id,
          {
            estaPagadaEmpleada: true,
            liquidacionId: liquidacion.id,
          },
          queryRunner,
        );
      }

      await queryRunner.commitTransaction();

      // Re-fetch with relations for the response
      const saved = await this.liquidacionRepo.findById(liquidacion.id);
      return saved!;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
