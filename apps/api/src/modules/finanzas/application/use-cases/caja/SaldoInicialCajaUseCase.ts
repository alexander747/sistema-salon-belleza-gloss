import { injectable, inject } from 'tsyringe';
import type { ISalonRepository } from '../../../../salon/domain/ports/ISalonRepository';
import type { ICajaRepository } from '../../../domain/ports/ICajaRepository';
import { NotFoundError, ValidationError } from '../../../../../shared/errors';
import { calcularPosicionCaja } from './calcularPosicionCaja';
import type { SaldoInicialCajaDTO } from '../../dtos/SaldoInicialCajaDTO';

const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * Lee/actualiza el "Saldo inicial de caja" (capital de apertura pre-sistema) y
 * devuelve la "Posición de caja" informativa.
 *
 * NO es ingreso: solo persiste una columna del salón y suma los arqueos de
 * cajas cerradas. No lee ni escribe registros/gastos/devoluciones/pagos, de modo
 * que no puede filtrarse al P&L (`PyLMensualUseCase`).
 */
@injectable()
export class SaldoInicialCajaUseCase {
  constructor(
    @inject('ISalonRepository')
    private readonly salonRepo: ISalonRepository,
    @inject('ICajaRepository')
    private readonly cajaRepo: ICajaRepository,
  ) {}

  async obtener(salonId: number): Promise<SaldoInicialCajaDTO> {
    const salon = await this.salonRepo.findById(salonId);
    if (!salon) {
      throw new NotFoundError(`Salón con id ${salonId} no encontrado`);
    }
    return this.construirDTO(salonId, salon.saldoInicialCaja);
  }

  async actualizar(salonId: number, saldoInicialCaja: number): Promise<SaldoInicialCajaDTO> {
    const salon = await this.salonRepo.findById(salonId);
    if (!salon) {
      throw new NotFoundError(`Salón con id ${salonId} no encontrado`);
    }

    const saldo = Number(saldoInicialCaja);
    if (!Number.isFinite(saldo) || saldo < 0) {
      throw new ValidationError('El saldo inicial de caja debe ser un número mayor o igual a 0');
    }

    const updated = await this.salonRepo.update(salonId, { saldoInicialCaja: saldo });
    if (!updated) {
      throw new NotFoundError(`Salón con id ${salonId} no encontrado`);
    }
    return this.construirDTO(salonId, updated.saldoInicialCaja);
  }

  private async construirDTO(
    salonId: number,
    saldoInicialCaja: number | string | null | undefined,
  ): Promise<SaldoInicialCajaDTO> {
    const saldo = Number(saldoInicialCaja ?? 0);
    // Solo cajas CERRADAS: su arqueo (montoEsperado/montoInicial) ya está persistido.
    const { data } = await this.cajaRepo.listBySalonPaginated(salonId, 1, 0, 'CERRADA');

    return {
      saldoInicialCaja: round2(Number.isFinite(saldo) ? saldo : 0),
      posicionCaja: calcularPosicionCaja(saldoInicialCaja, data),
    };
  }
}
