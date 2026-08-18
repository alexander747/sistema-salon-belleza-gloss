import { injectable, inject } from 'tsyringe';
import type { QueryRunner } from 'typeorm';
import type { IDevolucionRepository } from '../../../domain/ports/IDevolucionRepository';
import type { IProductoRepository } from '../../../../catalogo/domain/ports/IProductoRepository';
import type { IRegistroServicioRepository } from '../../../domain/ports/IRegistroServicioRepository';
import type { IClienteRepository } from '../../../../personas/domain/ports/IClienteRepository';
import type { ICajaRepository } from '../../../domain/ports/ICajaRepository';
import type { DevolucionEntity } from '../../../../../infrastructure/persistence/entities/DevolucionEntity';
import { ClienteEntity } from '../../../../../infrastructure/persistence/entities/ClienteEntity';
import { AppDataSource } from '../../../../../shared/database';
import { verificarCajaAbierta } from '../../services/verificarCajaAbierta';
import { NotFoundError } from '../../../../../shared/errors';

export interface CreateDevolucionInput {
  salonId: number;
  registroServicioId: number;
  motivo: string;
  cantidad: number;
  montoDevolucion: number;
  regresaAlStock: boolean;
  productoId?: number;
  procesada?: boolean;
}

/**
 * Crea una devolución (producto o servicio) dentro de una transacción:
 * 1. Regla de oro: no se devuelve dinero sin caja abierta (CajaCerradaError 422).
 * 2. Ajusta la deuda en la MISMA transacción: resta `min(montoDevolucion,
 *    montoPendiente)` del montoPendiente del registro y deudaTotal del cliente
 *    (conservador: nunca deja la deuda en negativo).
 * 3. Si regresaAlStock, incrementa el inventario dentro de la transacción.
 */
@injectable()
export class CreateDevolucionUseCase {
  constructor(
    @inject('IDevolucionRepository')
    private readonly devolucionRepo: IDevolucionRepository,
    @inject('IProductoRepository')
    private readonly productoRepo: IProductoRepository,
    @inject('IRegistroServicioRepository')
    private readonly registroRepo: IRegistroServicioRepository,
    @inject('IClienteRepository')
    private readonly clienteRepo: IClienteRepository,
    @inject('ICajaRepository')
    private readonly cajaRepo: ICajaRepository,
  ) {}

  async execute(input: CreateDevolucionInput): Promise<DevolucionEntity> {
    // ── 0. Regla de oro: no se devuelve dinero sin caja abierta ──
    await verificarCajaAbierta(this.cajaRepo, input.salonId);

    const qr = AppDataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      // ── 1. Registro de referencia (montoPendiente + clienteId) ──
      const registro = await this.registroRepo.findById(input.registroServicioId);
      if (!registro) {
        throw new NotFoundError('Registro no encontrado');
      }

      const montoPendiente = Number(registro.montoPendiente ?? 0);
      // Conservador: nunca restar más de lo que queda pendiente del registro
      const montoARestar = Math.min(input.montoDevolucion, montoPendiente);

      // ── 2. Persistir la devolución en la misma transacción ──
      const devolucion = await this.devolucionRepo.create(
        {
          salonId: input.salonId,
          registroServicioId: input.registroServicioId,
          motivo: input.motivo,
          cantidad: input.cantidad,
          montoDevolucion: input.montoDevolucion,
          regresaAlStock: input.regresaAlStock,
          productoId: input.productoId,
          procesada: input.procesada ?? false,
        },
        qr,
      );

      // ── 3. Reponer stock dentro de la transacción (si aplica) ──
      if (input.regresaAlStock && input.productoId) {
        await this.productoRepo.incrementStock(input.productoId, input.cantidad, undefined, qr);
      }

      // ── 4. Ajustar deuda en la misma transacción ──
      if (montoARestar > 0) {
        await this.registroRepo.update(
          registro.id,
          { montoPendiente: montoPendiente - montoARestar },
          qr,
        );

        const cliente = await this.clienteRepo.findBySalonAndId(input.salonId, registro.clienteId);
        if (cliente) {
          const nuevaDeuda = Math.max(0, Number(cliente.deudaTotal ?? 0) - montoARestar);
          await qr.manager.getRepository(ClienteEntity).update(cliente.id, { deudaTotal: nuevaDeuda });
        }
      }

      await qr.commitTransaction();
      return devolucion;
    } catch (error) {
      await qr.rollbackTransaction();
      throw error;
    } finally {
      await qr.release();
    }
  }
}
