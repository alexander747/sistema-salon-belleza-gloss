import { injectable, inject } from 'tsyringe';
import type { IRegistroServicioRepository } from '../../../domain/ports/IRegistroServicioRepository';
import type { IPrestamoRepository } from '../../../../prestamos/domain/ports/IPrestamoRepository';
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
 * no anulados con `montoPendiente > 0` MÁS los préstamos activos
 * (estado ACTIVO con `saldoPendiente > 0`) del salón. Lista unificada: cada
 * fila lleva `tipo: 'CLIENTE' | 'PRESTAMO'`.
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
    @inject('IPrestamoRepository')
    private readonly prestamoRepo: IPrestamoRepository,
  ) {}

  async execute(input: CuentasCobrarInput): Promise<PaginatedResult<CuentaCobrarDTO>> {
    const [registros, [prestamos]] = await Promise.all([
      this.registroRepo.findConDeudaBySalon(input.salonId),
      this.prestamoRepo.findBySalon({ salonId: input.salonId, estado: 'ACTIVO' }),
    ]);

    const filas: CuentaCobrarDTO[] = [];

    // ── Deuda de clientes (registros no ANULADOS con montoPendiente > 0) ──
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

    for (const [clienteId, grupo] of grupos.entries()) {
      const antiguedadDias = antiguedadDiasColombia(grupo.masAntiguo);
      filas.push({
        id: clienteId,
        tipo: 'CLIENTE',
        nombre: grupo.nombre,
        deudaTotal: grupo.deudaTotal,
        cantidadRegistros: grupo.cantidadRegistros,
        antiguedadDias,
        antiguedadBucket: bucketAntiguedad(antiguedadDias),
      });
    }

    // ── Préstamos activos con saldo pendiente (el repo filtra estado ACTIVO) ──
    for (const prestamo of prestamos) {
      // Defensa en profundidad: misma semántica que el repo (estado ACTIVO, saldo > 0)
      if (prestamo.estado !== 'ACTIVO') continue;
      const saldo = Number(prestamo.saldoPendiente);
      if (saldo <= 0) continue;

      const antiguedadDias = antiguedadDiasColombia(prestamo.fechaCreacion);
      filas.push({
        id: prestamo.id,
        tipo: 'PRESTAMO',
        nombre: prestamo.usuario?.nombre ?? prestamo.nombreTercero ?? '',
        deudaTotal: saldo,
        cantidadRegistros: null,
        antiguedadDias,
        antiguedadBucket: bucketAntiguedad(antiguedadDias),
      });
    }

    filas.sort((a, b) => b.deudaTotal - a.deudaTotal);

    const total = filas.length;
    const data = input.limit > 0 ? filas.slice((input.page - 1) * input.limit, input.page * input.limit) : filas;
    return paginate(data, total, { page: input.page, limit: input.limit });
  }
}
