import { injectable, inject } from 'tsyringe';
import type { IRegistroServicioRepository } from '../../../domain/ports/IRegistroServicioRepository';
import { EstadoRegistro } from '../../../../../infrastructure/persistence/entities/RegistroServicioEntity';
import type { PaginationParams, PaginatedResult } from '../../../../../shared/pagination';
import { paginate } from '../../../../../shared/pagination';
import type { CuentaCobrarDTO } from '../../dtos/CuentasDTO';
import { antiguedadDiasColombia, bucketAntiguedad } from './antiguedad';

export interface CuentasCobrarInput extends PaginationParams {
  salonId: number;
}

interface GrupoCliente {
  nombre: string;
  deudaTotal: number;
  cantidadRegistros: number;
  masAntiguo: Date;
}

/**
 * Cuentas por cobrar: deuda pendiente agregada por cliente desde los registros
 * no anulados con `montoPendiente > 0`.
 *
 * CONSISTENCIA DE DEUDA — follow-ups conocidos, fuera de scope v1 (ver proposal
 * `cuentas-pagar-cobrar` → FOLLOW-UP):
 *   (a) las devoluciones NO reducen `montoPendiente`/`deudaTotal` (gap en finanzas-registros);
 *   (b) `montoPendiente` ignora `valorFinal` cuando `precioAjustado=true`
 *       (deuda espuria por descuento);
 *   (c) no existe flujo de cobro: cobrar deuda es un cambio separado posterior.
 * v1 es SOLO LECTURA y computa `deudaTotal` desde los registros (la columna
 * `cliente.deudaTotal` deriva y no se usa).
 */
@injectable()
export class CuentasCobrarUseCase {
  constructor(
    @inject('IRegistroServicioRepository')
    private readonly registroRepo: IRegistroServicioRepository,
  ) {}

  async execute(input: CuentasCobrarInput): Promise<PaginatedResult<CuentaCobrarDTO>> {
    const registros = await this.registroRepo.findConDeudaBySalon(input.salonId);

    const grupos = new Map<number, GrupoCliente>();

    for (const registro of registros) {
      // Defensa en profundidad: el repo ya filtra, pero el use case garantiza
      // la semántica de spec (solo registros no ANULADOS con deuda > 0).
      if (registro.estado === EstadoRegistro.ANULADO) continue;
      const pendiente = Number(registro.montoPendiente);
      if (pendiente <= 0) continue;

      const grupo = grupos.get(registro.clienteId) ?? {
        nombre: registro.cliente?.nombre ?? '',
        deudaTotal: 0,
        cantidadRegistros: 0,
        masAntiguo: registro.creadoEn,
      };
      grupo.deudaTotal += pendiente;
      grupo.cantidadRegistros += 1;
      if (registro.creadoEn < grupo.masAntiguo) {
        grupo.masAntiguo = registro.creadoEn;
      }
      grupos.set(registro.clienteId, grupo);
    }

    const filas: CuentaCobrarDTO[] = [...grupos.entries()].map(([clienteId, grupo]) => {
      const antiguedadDias = antiguedadDiasColombia(grupo.masAntiguo);
      return {
        clienteId,
        nombre: grupo.nombre,
        deudaTotal: grupo.deudaTotal,
        cantidadRegistros: grupo.cantidadRegistros,
        antiguedadDias,
        antiguedadBucket: bucketAntiguedad(antiguedadDias),
      };
    });

    filas.sort((a, b) => b.deudaTotal - a.deudaTotal);

    const total = filas.length;
    const data = input.limit > 0 ? filas.slice((input.page - 1) * input.limit, input.page * input.limit) : filas;
    return paginate(data, total, { page: input.page, limit: input.limit });
  }
}
