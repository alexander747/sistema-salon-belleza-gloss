import { injectable, inject } from 'tsyringe';
import type { IRegistroServicioRepository } from '../../../domain/ports/IRegistroServicioRepository';
import type { IPrestamoRepository } from '../../../../prestamos/domain/ports/IPrestamoRepository';
import { EstadoRegistro } from '../../../../../infrastructure/persistence/entities/RegistroServicioEntity';
import type { PaginationParams, PaginatedResult } from '../../../../../shared/pagination';
import { paginate } from '../../../../../shared/pagination';
import type { CuentaCobrarDTO, RegistroDeudaDTO } from '../../dtos/CuentasDTO';
import { antiguedadDiasColombia, bucketAntiguedad } from './antiguedad';

export interface CuentasCobrarInput extends PaginationParams {
  salonId: number;
}

interface GrupoCliente {
  nombre: string;
  deudaTotal: number;
  cantidadRegistros: number;
  masAntiguo: Date;
  registros: RegistroDeudaDTO[];
}

/**
 * Cuentas por cobrar: deuda pendiente agregada por cliente desde los registros
 * no anulados con `montoPendiente > 0` MÁS los préstamos activos
 * (estado ACTIVO con `saldoPendiente > 0`) del salón. Lista unificada: cada
 * fila lleva `tipo: 'CLIENTE' | 'PRESTAMO'`; las filas CLIENTE exponen el
 * desglose `registros[]` (por registro, orden ASC) para el modal Cobrar/Abonar.
 *
 * CONSISTENCIA DE DEUDA — semántica vigente (decisión owner, ventas-fiado-deudas):
 *   (a) los ABONOS (AbonarDeudaUseCase) y las DEVOLUCIONES (CreateDevolucionUseCase)
 *       SÍ reducen `montoPendiente` y `cliente.deudaTotal` en la misma transacción;
 *   (b) la ANULACIÓN reduce `montoPendiente` a 0 y decrementa `deudaTotal`;
 *   (c) `cliente.deudaTotal` es una columna DESNORMALIZADA que puede divergir del
 *       recomputado — la fuente de verdad para la UI es el agregado de este use case.
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

      const fechaRegistro = registro.fechaHora ?? registro.creadoEn;
      const grupo = grupos.get(registro.clienteId) ?? {
        nombre: registro.cliente?.nombre ?? '',
        deudaTotal: 0,
        cantidadRegistros: 0,
        // Antigüedad por fecha de negocio (backfill); legacy -> creadoEn
        masAntiguo: fechaRegistro,
        registros: [] as RegistroDeudaDTO[],
      };
      grupo.deudaTotal += pendiente;
      grupo.cantidadRegistros += 1;
      grupo.registros.push({
        registroId: registro.id,
        fechaHora: fechaRegistro,
        montoPendiente: pendiente,
      });
      if (fechaRegistro < grupo.masAntiguo) {
        grupo.masAntiguo = fechaRegistro;
      }
      grupos.set(registro.clienteId, grupo);
    }

    for (const [clienteId, grupo] of grupos.entries()) {
      const antiguedadDias = antiguedadDiasColombia(grupo.masAntiguo);
      // Spec: desglose ordenado por fecha ASC (la deuda más antigua primero).
      // El repo ya ordena, pero el orden se garantiza localmente.
      const registrosOrdenados = [...grupo.registros].sort(
        (a, b) => a.fechaHora.getTime() - b.fechaHora.getTime(),
      );
      filas.push({
        id: clienteId,
        tipo: 'CLIENTE',
        nombre: grupo.nombre,
        deudaTotal: grupo.deudaTotal,
        cantidadRegistros: grupo.cantidadRegistros,
        antiguedadDias,
        antiguedadBucket: bucketAntiguedad(antiguedadDias),
        registros: registrosOrdenados,
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
        // Los préstamos no tienen desglose por registro (su flujo vive en Préstamos)
        registros: null,
      });
    }

    filas.sort((a, b) => b.deudaTotal - a.deudaTotal);

    const total = filas.length;
    const data = input.limit > 0 ? filas.slice((input.page - 1) * input.limit, input.page * input.limit) : filas;
    return paginate(data, total, { page: input.page, limit: input.limit });
  }
}
