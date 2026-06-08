import { injectable, inject } from 'tsyringe';
import { AppDataSource } from '../../../../../shared/database';
import { UnprocessableEntityError, ValidationError } from '../../../../../shared/errors';
import type { ILiquidacionRepository } from '../../../domain/ports/ILiquidacionRepository';
import type { IRegistroServicioRepository } from '../../../domain/ports/IRegistroServicioRepository';
import type { IUsuarioRepository } from '../../../../personas/domain/ports/IUsuarioRepository';
import type { IPrestamoRepository } from '../../../../prestamos/domain/ports/IPrestamoRepository';
import type { IPagoPrestamoRepository } from '../../../../prestamos/domain/ports/IPagoPrestamoRepository';
import type { LiquidacionEntity } from '../../../../../infrastructure/persistence/entities/LiquidacionEntity';
import { PagoPrestamoEntity } from '../../../../../infrastructure/persistence/entities/PagoPrestamoEntity';
import { PrestamoEntity } from '../../../../../infrastructure/persistence/entities/PrestamoEntity';

export interface DescuentoPrestamoInput {
  prestamoId: number;
  monto: number;
}

export interface LiquidarEmpleadaInput {
  salonId: number;
  usuarioId: number;
  periodoInicio: Date;
  periodoFin: Date;
  totalPagado?: number;
  /** Préstamos activos a descontar de esta liquidación */
  descuentosPrestamos?: DescuentoPrestamoInput[];
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
    @inject('IPrestamoRepository')
    private readonly prestamoRepo: IPrestamoRepository,
    @inject('IPagoPrestamoRepository')
    private readonly pagoPrestamoRepo: IPagoPrestamoRepository,
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

    // 2. Get all registros for this employee in the period
    const allRegistros = await this.registroRepo.search({
      salonId: input.salonId,
      usuarioId: input.usuarioId,
      desde: input.periodoInicio,
      hasta: input.periodoFin,
    });

    // 3. Filter only unpaid registros
    const pendingRegistros = allRegistros.filter(
      (r) => !r.estaPagadaEmpleada,
    );

    if (pendingRegistros.length === 0) {
      throw new UnprocessableEntityError('No hay registros pendientes para liquidar');
    }

    // 4. Check if there's a prior liquidation this period
    const liquidacionesExistentes = await this.liquidacionRepo.findBySalonEmpleadaAndPeriodo(
      input.salonId,
      input.usuarioId,
      input.periodoInicio,
      input.periodoFin,
    );
    if (liquidacionesExistentes.length > 0) {
      const ultimaLiq = liquidacionesExistentes.sort(
        (a, b) => new Date(b.creadoEn).getTime() - new Date(a.creadoEn).getTime(),
      )[0];
      const soloRegistrosViejos = pendingRegistros.every(
        (r) => new Date(r.creadoEn) <= new Date(ultimaLiq.creadoEn),
      );
      if (soloRegistrosViejos) {
        throw new UnprocessableEntityError(
          `La empleada ya fue liquidada en el período ${input.periodoInicio.toISOString().slice(0, 10)} - ${input.periodoFin.toISOString().slice(0, 10)} y no hay registros nuevos desde entonces`,
        );
      }
      const nuevosRegistros = pendingRegistros.filter(
        (r) => new Date(r.creadoEn) > new Date(ultimaLiq.creadoEn),
      );
      pendingRegistros.splice(0, pendingRegistros.length, ...nuevosRegistros);
    }

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

    // 4. Validate descuentos por préstamos
    const descuentos = input.descuentosPrestamos ?? [];
    let totalDescuentos = 0;

    for (const d of descuentos) {
      const prestamo = await this.prestamoRepo.findById(d.prestamoId);
      if (!prestamo) {
        throw new ValidationError(`Préstamo ID ${d.prestamoId} no encontrado`);
      }
      if (prestamo.estado !== 'ACTIVO') {
        throw new ValidationError(`Préstamo ID ${d.prestamoId} no está activo`);
      }
      if (prestamo.usuarioId !== input.usuarioId) {
        throw new ValidationError(`Préstamo ID ${d.prestamoId} no pertenece a esta empleada`);
      }
      if (d.monto > Number(prestamo.saldoPendiente)) {
        throw new ValidationError(
          `El descuento del préstamo ID ${d.prestamoId} excede el saldo pendiente (${prestamo.saldoPendiente})`,
        );
      }
      totalDescuentos += d.monto;
    }

    if (totalDescuentos > calculatedTotal) {
      throw new UnprocessableEntityError(
        'Los descuentos por préstamos no pueden exceder el total a liquidar',
      );
    }

    const netoAPagar = calculatedTotal - totalDescuentos;
    const totalPagado = input.totalPagado ?? netoAPagar;

    if (totalPagado <= 0) {
      throw new UnprocessableEntityError('No hay montos pendientes para liquidar');
    }

    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 5. Create the Liquidacion with calculated values (inside transaction)
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
      }, queryRunner);

      // 6. Mark each pending registro as paid and link to liquidacion
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

      // 7. Create PagoPrestamo entries and update loan balances within same transaction
      const pagoRepo = queryRunner.manager.getRepository(PagoPrestamoEntity);
      const prestamoRepo = queryRunner.manager.getRepository(PrestamoEntity);

      for (const d of descuentos) {
        const pago = pagoRepo.create({
          prestamoId: d.prestamoId,
          monto: d.monto,
          tipoPago: 'LIQUIDACION',
          liquidacionId: liquidacion.id,
          observacion: `Descontado en liquidación #${liquidacion.id}`,
          fechaPago: new Date(),
        });
        await pagoRepo.save(pago);

        const prestamo = await prestamoRepo.findOneBy({ id: d.prestamoId });
        if (prestamo) {
          const nuevoSaldo = Number(prestamo.saldoPendiente) - d.monto;
          await prestamoRepo.update(d.prestamoId, {
            saldoPendiente: Math.max(0, nuevoSaldo),
            estado: nuevoSaldo <= 0 ? 'PAGADO' : 'ACTIVO',
          });
        }
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
