import { injectable, inject } from 'tsyringe';
import { AppDataSource } from '../../../../../shared/database';
import { UnprocessableEntityError } from '../../../../../shared/errors';
import type { ILiquidacionRepository } from '../../../domain/ports/ILiquidacionRepository';
import type { IRegistroServicioRepository } from '../../../domain/ports/IRegistroServicioRepository';
import type { IUsuarioRepository } from '../../../../personas/domain/ports/IUsuarioRepository';
import type { LiquidacionEntity } from '../../../../../infrastructure/persistence/entities/LiquidacionEntity';

export interface LiquidarEmpleadaInput {
  salonId: number;
  usuarioId: number;
  periodoInicio: Date;
  periodoFin: Date;
  totalPagado?: number;
}

@injectable()
export class LiquidarEmpleadaUseCase {
  constructor(
    @inject('ILiquidacionRepository')
    private readonly liquidacionRepo: ILiquidacionRepository,
    @inject('IRegistroServicioRepository')
    private readonly registroRepo: IRegistroServicioRepository,
    @inject('IPersonasUsuarioRepository')
    private readonly usuarioRepo: IUsuarioRepository,
  ) {}

  async execute(input: LiquidarEmpleadaInput): Promise<LiquidacionEntity> {
    // 1. Look up employee for fixed compensation (bonoHorario, sueldoFijo)
    const empleada = await this.usuarioRepo.findBySalonAndId(
      input.salonId,
      input.usuarioId,
    );
    if (!empleada) {
      throw new Error(`Empleada ${input.usuarioId} no encontrada en el salón`);
    }

    // 2. Query pending registros for this employee in the period
    const allRegistros = await this.registroRepo.search({
      salonId: input.salonId,
      usuarioId: input.usuarioId,
      desde: input.periodoInicio,
      hasta: input.periodoFin,
    });
    const pendingRegistros = allRegistros.filter(
      (r) => !r.estaPagadaEmpleada,
    );

    // 3. Calculate amounts from registros + employee fixed comp
    const totalComisiones = pendingRegistros.reduce(
      (sum, r) => sum + Number(r.comisionCalculada),
      0,
    );
    const totalPropinas = pendingRegistros.reduce(
      (sum, r) => sum + Number(r.propina),
      0,
    );
    const bonoHorario = Number(empleada.bonoHorario);
    const sueldoFijo = Number(empleada.sueldoFijo);
    const calculatedTotal = totalComisiones + totalPropinas + bonoHorario + sueldoFijo;
    const totalPagado = input.totalPagado ?? calculatedTotal;

    if (totalPagado <= 0) {
      throw new UnprocessableEntityError('No hay montos pendientes para liquidar');
    }

    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 4. Create the Liquidacion with calculated values
      const liquidacion = await this.liquidacionRepo.create({
        salonId: input.salonId,
        usuarioId: input.usuarioId,
        fechaDesde: input.periodoInicio,
        fechaHasta: input.periodoFin,
        totalComisiones,
        totalPropinas,
        bonoHorario,
        sueldoFijo,
        totalPagado,
        estado: 'PAGADA',
      });

      // 5. Mark each pending registro as paid and link to liquidacion
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
