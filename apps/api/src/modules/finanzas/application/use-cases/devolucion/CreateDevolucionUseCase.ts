import { injectable, inject } from 'tsyringe';
import type { QueryRunner } from 'typeorm';
import type { IDevolucionRepository } from '../../../domain/ports/IDevolucionRepository';
import type { IProductoRepository } from '../../../../catalogo/domain/ports/IProductoRepository';
import type { IRegistroServicioRepository } from '../../../domain/ports/IRegistroServicioRepository';
import type { IClienteRepository } from '../../../../personas/domain/ports/IClienteRepository';
import type { ICajaRepository } from '../../../domain/ports/ICajaRepository';
import type { DevolucionEntity } from '../../../../../infrastructure/persistence/entities/DevolucionEntity';
import { ClienteEntity } from '../../../../../infrastructure/persistence/entities/ClienteEntity';
import { MetodoPago } from '../../../../../infrastructure/persistence/entities/MetodoPago';
import { AppDataSource } from '../../../../../shared/database';
import { verificarCajaAbierta } from '../../services/verificarCajaAbierta';
import { NotFoundError, UnprocessableEntityError, ValidationError } from '../../../../../shared/errors';

export interface CreateDevolucionInput {
  salonId: number;
  registroServicioId: number;
  motivo: string;
  cantidad: number;
  montoDevolucion: number;
  regresaAlStock: boolean;
  productoId?: number;
  /** Cómo se reintegró el dinero (default EFECTIVO). */
  metodoPago?: MetodoPago;
}

/**
 * Crea una devolución (producto o servicio) dentro de una transacción:
 * 1. Regla de oro: no se devuelve dinero sin caja abierta (CajaCerradaError 422).
 * 2. Topes de devolución: rechaza un `montoDevolucion` que exceda el total
 *    devolvible (total de la venta, o subtotal de la línea de producto menos lo
 *    ya devuelto) y una `cantidad` que exceda la cantidad vendida de la línea.
 * 3. Ajusta la deuda en la MISMA transacción: resta `min(montoDevolucion,
 *    montoPendiente)` del montoPendiente del registro y deudaTotal del cliente
 *    (conservador: nunca deja la deuda en negativo).
 * 4. Si regresaAlStock, incrementa el inventario dentro de la transacción.
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
    // La caja abierta se conserva: la devolución se liga a ESA caja para que el
    // arqueo reste su monto cuando el reintegro es EFECTIVO (Rule B).
    const caja = await verificarCajaAbierta(this.cajaRepo, input.salonId);

    const metodoPago = input.metodoPago ?? MetodoPago.EFECTIVO;
    if (!['EFECTIVO', 'TRANSFERENCIA', 'TARJETA'].includes(metodoPago)) {
      throw new ValidationError('Método de pago inválido');
    }

    const qr = AppDataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      // ── 1. Registro de referencia (montoPendiente + clienteId) ──
      const registro = await this.registroRepo.findById(input.registroServicioId);
      if (!registro) {
        throw new NotFoundError('Registro no encontrado');
      }

      // Un registro ANULADO ya fue revertido por AnularRegistroUseCase: deuda a 0,
      // stock repuesto y líneas de producto eliminadas. Una devolución encima
      // restauraría stock por segunda vez y no tendría deuda que ajustar.
      if (registro.estado === 'ANULADO') {
        throw new UnprocessableEntityError(
          'No se puede crear una devolución sobre un registro anulado',
        );
      }

      // ── 1b. Topes de devolución: no se puede devolver más de lo vendido ──
      // El MONTO tope es el total devolvible de la venta (o de la línea de
      // producto) menos lo ya devuelto; la CANTIDAD tope solo aplica cuando se
      // referencia una línea de producto. Se mantiene el comportamiento
      // conservador de la deuda (paso 4): el ajuste sigue acotado a montoPendiente.
      const devolucionesPrevias = registro.devoluciones ?? [];
      const EPS = 0.01;
      let topeMonto: number;
      let topeCantidad: number | null = null;

      if (input.productoId != null) {
        const linea = (registro.productosVendidos ?? []).find(
          (rp) => rp.productoId === input.productoId,
        );
        if (!linea) {
          throw new ValidationError('El producto no pertenece a la venta');
        }
        const previas = devolucionesPrevias.filter((d) => d.productoId === input.productoId);
        const yaDevueltoMonto = previas.reduce((sum, d) => sum + Number(d.montoDevolucion), 0);
        const yaDevueltaCantidad = previas.reduce((sum, d) => sum + Number(d.cantidad), 0);
        topeMonto = Number(linea.subtotal) - yaDevueltoMonto;
        topeCantidad = Number(linea.cantidad) - yaDevueltaCantidad;
      } else {
        const yaDevueltoMonto = devolucionesPrevias.reduce(
          (sum, d) => sum + Number(d.montoDevolucion),
          0,
        );
        topeMonto = Number(registro.montoTotal ?? 0) - yaDevueltoMonto;
      }

      if (input.montoDevolucion > topeMonto + EPS) {
        throw new ValidationError(
          'El monto de la devolución excede el total devolvible de la venta',
        );
      }
      if (topeCantidad !== null && input.cantidad > topeCantidad + EPS) {
        throw new ValidationError('La cantidad a devolver excede la cantidad vendida');
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
          metodoPago,
          cajaId: caja.id,
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
