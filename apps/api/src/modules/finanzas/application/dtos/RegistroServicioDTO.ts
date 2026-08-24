import type { RegistroServicioEntity } from '../../../../infrastructure/persistence/entities/RegistroServicioEntity';
import type { RegistroProductoDTO } from './RegistroProductoDTO';
import { registroProductoToDTO } from './RegistroProductoDTO';
import type { RegistroServicioItemDTO } from './RegistroServicioItemDTO';
import { registroServicioItemToDTO } from './RegistroServicioItemDTO';

export interface PagoDTO {
  id: number;
  monto: number;
  metodoPago: string;
  referencia: string | null;
  creadoEn: Date;
}

export interface DivisionDTO {
  id: number;
  usuarioId: number;
  porcentajeParticipacion: number;
  comisionCorrespondiente: number;
}

export interface RegistroServicioDTO {
  id: number;
  salonId: number;
  clienteId: number;
  usuarioId: number;
  estado: string;
  totalServicios: number;
  totalProductos: number;
  montoTotal: number;
  montoPendiente: number;
  propina: number;
  comisionCalculada: number;
  esRetoque: boolean;
  descripcionServicio: string | null;
  estaPagadaEmpleada: boolean;
  notas: string | null;
  precioAjustado: boolean;
  porcentajeDescuento: number;
  valorOriginal: number;
  valorFinal: number;
  pagos: PagoDTO[];
  divisiones: DivisionDTO[];
  productosVendidos: RegistroProductoDTO[];
  serviciosItems: RegistroServicioItemDTO[];
  // Fecha de negocio; fallback a creadoEn para filas legacy sin fechaHora.
  fechaHora: Date;
  creadoEn: Date;
  actualizadoEn: Date;
  // Caja del día del registro: id + si sigue abierta (regla de anulación).
  // NULL para registros legacy anteriores al modelo de cajas.
  cajaId: number | null;
  cajaAbierta: boolean | null;
}

export function registroServicioToDTO(entity: RegistroServicioEntity): RegistroServicioDTO {
  return {
    id: entity.id,
    salonId: entity.salonId,
    clienteId: entity.clienteId,
    usuarioId: entity.usuarioId,
    estado: entity.estado,
    totalServicios: Number(entity.totalServicios),
    totalProductos: Number(entity.totalProductos),
    montoTotal: Number(entity.montoTotal),
    montoPendiente: Number(entity.montoPendiente),
    propina: Number(entity.propina),
    comisionCalculada: Number(entity.comisionCalculada),
    esRetoque: entity.esRetoque,
    descripcionServicio: entity.descripcionServicio ?? null,
    estaPagadaEmpleada: entity.estaPagadaEmpleada,
    notas: entity.notas ?? null,
    precioAjustado: entity.precioAjustado,
    porcentajeDescuento: Number(entity.porcentajeDescuento),
    valorOriginal: Number(entity.valorOriginal),
    valorFinal: Number(entity.valorFinal),
    pagos: (entity.pagos ?? []).map((p) => ({
      id: p.id,
      monto: Number(p.monto),
      metodoPago: p.metodoPago,
      referencia: p.referencia ?? null,
      creadoEn: p.creadoEn,
    })),
    divisiones: (entity.divisiones ?? []).map((d) => ({
      id: d.id,
      usuarioId: d.usuarioId,
      porcentajeParticipacion: Number(d.porcentajeParticipacion),
      comisionCorrespondiente: Number(d.comisionCorrespondiente),
    })),
    productosVendidos: (entity.productosVendidos ?? []).map(registroProductoToDTO),
    serviciosItems: (entity.serviciosItems ?? []).map(registroServicioItemToDTO),
    fechaHora: entity.fechaHora ?? entity.creadoEn,
    creadoEn: entity.creadoEn,
    actualizadoEn: entity.actualizadoEn,
    cajaId: entity.cajaId ?? null,
    cajaAbierta: entity.caja ? entity.caja.estado === 'ABIERTA' : null,
  };
}
