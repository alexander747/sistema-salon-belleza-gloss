import { injectable, inject } from 'tsyringe';
import { AppDataSource } from '../../../../../shared/database';
import { MetodoPago } from '../../../../../infrastructure/persistence/entities/PagoTransaccionEntity';
import { EstadoRegistro } from '../../../../../infrastructure/persistence/entities/RegistroServicioEntity';
import { ClienteEntity } from '../../../../../infrastructure/persistence/entities/ClienteEntity';
import type { IRegistroServicioRepository } from '../../../domain/ports/IRegistroServicioRepository';
import type { IPagoTransaccionRepository } from '../../../domain/ports/IPagoTransaccionRepository';
import type { IClienteRepository } from '../../../../personas/domain/ports/IClienteRepository';
import type { ICajaRepository } from '../../../domain/ports/ICajaRepository';
import { verificarCajaAbierta } from '../../services/verificarCajaAbierta';
import {
  ValidationError,
  RegistroNoEncontradoError,
  RegistroAnuladoError,
  MontoExcedePendienteError,
} from '../../../../../shared/errors';
import type { RegistroServicioDTO } from '../../dtos/RegistroServicioDTO';
import { registroServicioToDTO } from '../../dtos/RegistroServicioDTO';

export interface AbonarDeudaInput {
  salonId: number;
  registroId: number;
  monto: number;
  metodoPago: string;
  referencia?: string;
}

/**
 * Abono a la deuda de un registro (fiado).
 *
 * Contabilidad de CAJA: el dinero se recibe HOY, por lo que el pago entra a la
 * caja del día de hoy (`verificarCajaAbierta` con fecha default = hoy), aunque
 * el registro pertenezca a una caja anterior. En UNA transacción:
 *   1. crea el `PagoTransaccion` con `cajaId` = caja de hoy;
 *   2. decrementa `registro.montoPendiente` (floor 0);
 *   3. decrementa `cliente.deudaTotal` (floor 0, columna desnormalizada).
 *
 * Guard de la regla de oro (caja ABIERTA hoy) corre ANTES de abrir la
 * transacción — mismo patrón que CreateRegistro/CreateDevolucion.
 */
@injectable()
export class AbonarDeudaUseCase {
  constructor(
    @inject('IRegistroServicioRepository')
    private readonly registroRepo: IRegistroServicioRepository,
    @inject('IPagoTransaccionRepository')
    private readonly pagoRepo: IPagoTransaccionRepository,
    @inject('IClienteRepository')
    private readonly clienteRepo: IClienteRepository,
    @inject('ICajaRepository')
    private readonly cajaRepo: ICajaRepository,
  ) {}

  async execute(input: AbonarDeudaInput): Promise<RegistroServicioDTO> {
    // Defensa en profundidad (el schema HTTP ya valida monto > 0): 400 antes de todo
    if (!Number.isFinite(input.monto) || input.monto <= 0) {
      throw new ValidationError('El monto del abono debe ser positivo');
    }

    // ── 0. Regla de oro: el dinero se recibe HOY → caja de hoy (422 CAJA_CERRADA) ──
    const cajaHoy = await verificarCajaAbierta(this.cajaRepo, input.salonId);

    const qr = AppDataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      // ── 1. Registro existe y pertenece al salón (404 REGISTRO_NO_ENCONTRADO) ──
      const registro = await this.registroRepo.findById(input.registroId);
      if (!registro || registro.salonId !== input.salonId) {
        throw new RegistroNoEncontradoError();
      }

      // ── 2. Registro NO anulado (422 REGISTRO_ANULADO) ──
      if (registro.estado === EstadoRegistro.ANULADO) {
        throw new RegistroAnuladoError();
      }

      // ── 3. Abono no supera el pendiente (409 MONTO_EXCEDE_PENDIENTE) ──
      const montoPendiente = Number(registro.montoPendiente ?? 0);
      if (input.monto > montoPendiente) {
        throw new MontoExcedePendienteError('El abono supera la deuda pendiente del registro');
      }

      // ── 4. Pago en la caja de HOY + decrementos en la misma transacción ──
      await this.pagoRepo.create(
        {
          registroServicioId: registro.id,
          monto: input.monto,
          metodoPago: input.metodoPago as MetodoPago,
          referencia: input.referencia,
          cajaId: cajaHoy.id,
        },
        qr,
      );

      const nuevoPendiente = Math.max(0, montoPendiente - input.monto);
      await this.registroRepo.update(registro.id, { montoPendiente: nuevoPendiente }, qr);

      const cliente = await this.clienteRepo.findBySalonAndId(input.salonId, registro.clienteId);
      if (cliente) {
        const nuevaDeuda = Math.max(0, Number(cliente.deudaTotal ?? 0) - input.monto);
        await qr.manager.getRepository(ClienteEntity).update(cliente.id, { deudaTotal: nuevaDeuda });
      }

      await qr.commitTransaction();

      // Re-fetch post-commit con relaciones (pagos) para el DTO
      const saved = await this.registroRepo.findById(registro.id);
      return registroServicioToDTO(saved!);
    } catch (error) {
      await qr.rollbackTransaction();
      throw error;
    } finally {
      await qr.release();
    }
  }
}
