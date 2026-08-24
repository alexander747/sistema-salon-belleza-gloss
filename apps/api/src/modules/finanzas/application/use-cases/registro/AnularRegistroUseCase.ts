import { injectable, inject } from 'tsyringe';
import { AppDataSource } from '../../../../../shared/database';
import { RegistroProductoEntity } from '../../../../../infrastructure/persistence/entities/RegistroProductoEntity';
import type { IRegistroServicioRepository } from '../../../domain/ports/IRegistroServicioRepository';
import type { IClienteRepository } from '../../../../personas/domain/ports/IClienteRepository';
import type { IProductoRepository } from '../../../../catalogo/domain/ports/IProductoRepository';
import type { ICajaRepository } from '../../../domain/ports/ICajaRepository';
import { NotFoundError, UnprocessableEntityError } from '../../../../../shared/errors';

export interface AnularRegistroInput {
  id: number;
  salonId: number;
}

@injectable()
export class AnularRegistroUseCase {
  constructor(
    @inject('IRegistroServicioRepository')
    private readonly registroRepo: IRegistroServicioRepository,
    @inject('IClienteRepository')
    private readonly clienteRepo: IClienteRepository,
    @inject('IProductoRepository')
    private readonly productoRepo: IProductoRepository,
    @inject('ICajaRepository')
    private readonly cajaRepo: ICajaRepository,
  ) {}

  async execute(input: AnularRegistroInput): Promise<void> {
    const registro = await this.registroRepo.findById(input.id);
    if (!registro) {
      throw new NotFoundError('Registro no encontrado');
    }

    // Guard: no se anula un registro ya liquidado (estaPagadaEmpleada=true).
    // Anularlo después de liquidado rompería la consistencia del dinero ya
    // pagado a la empleada — el frontend lo bloquea, el backend ahora también.
    if (registro.estaPagadaEmpleada) {
      throw new UnprocessableEntityError('No se puede anular un registro ya liquidado');
    }

    // Guard (regla del dueño): solo se puede anular un registro si la caja de
    // su día comercial sigue ABIERTA. Si la caja ya se cerró, el arqueo quedó
    // contabilizado y anular después rompería la conciliación del día.
    // Registros legacy sin caja (cajaId NULL) no se bloquean: no hay caja que
    // verificar (preexistentes al modelo de caja).
    if (registro.cajaId != null) {
      const caja = await this.cajaRepo.findById(registro.cajaId);
      if (caja && caja.estado !== 'ABIERTA') {
        throw new UnprocessableEntityError(
          `No se puede anular el registro: la caja del ${caja.fechaCaja} ya está cerrada. Reabrí la caja de ese día para anular la venta.`,
        );
      }
    }

    // --- Stock restoration from product lines ---
    if (registro.productosVendidos && registro.productosVendidos.length > 0) {
      const queryRunner = AppDataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        for (const rp of registro.productosVendidos) {
          await this.productoRepo.incrementStock(
            rp.productoId,
            rp.cantidad,
            undefined,
            queryRunner,
          );
          // Delete the product line
          await queryRunner.manager
            .getRepository(RegistroProductoEntity)
            .delete(rp.id);
        }
        await queryRunner.commitTransaction();
      } catch (error) {
        await queryRunner.rollbackTransaction();
        throw error;
      } finally {
        await queryRunner.release();
      }
    }

    // Soft-void: zero out financial impact, preserve audit trail
    const montoPendienteAnterior = Number(registro.montoPendiente);

    // LIMITACIÓN CONOCIDA (decisión owner, ventas-fiado-deudas): la anulación
    // conserva los pagos previos en pagos_transaccion, pero `calcularReporteCierre`
    // excluye los registros ANULADOS → el efectivo ya recibido puede no reflejarse
    // en el arqueo de la caja original si el registro se anula después del cierre.
    // NO se corrige en este cambio (spec finanzas-registros).
    await this.registroRepo.update(input.id, {
      estado: 'ANULADO' as any,
      montoPendiente: 0,
      montoTotal: 0,
      comisionCalculada: 0,
      estaPagadaEmpleada: true,
      notas: registro.notas
        ? `[ANULADO] ${registro.notas}`
        : '[ANULADO]',
    });

    // Decrement cliente's debt by the previous pending amount
    if (montoPendienteAnterior > 0) {
      const cliente = await this.clienteRepo.findBySalonAndId(input.salonId, registro.clienteId);
      if (cliente) {
        const nuevaDeuda = Math.max(0, Number(cliente.deudaTotal ?? 0) - montoPendienteAnterior);
        await this.clienteRepo.update(cliente.id, {
          deudaTotal: nuevaDeuda,
        });
      }
    }
  }
}
