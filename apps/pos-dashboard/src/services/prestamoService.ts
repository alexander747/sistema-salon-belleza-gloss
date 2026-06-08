import api from './api.js';

export interface Prestamo {
  id: number;
  salonId: number;
  usuarioId: number | null;
  nombreEmpleado: string | null;
  nombreTercero: string | null;
  monto: number;
  saldoPendiente: number;
  motivo: string | null;
  estado: 'ACTIVO' | 'PAGADO' | 'CANCELADO';
  fechaCreacion: string;
  creadoEn: string;
  actualizadoEn: string;
}

export interface PagoPrestamo {
  id: number;
  prestamoId: number;
  monto: number;
  fechaPago: string;
  tipoPago: 'MANUAL' | 'LIQUIDACION';
  liquidacionId: number | null;
  observacion: string | null;
  creadoEn: string;
}

export interface PrestamoDetalle extends Prestamo {
  pagos: PagoPrestamo[];
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const prestamoService = {
  async getPrestamos(params?: { estado?: string; page?: number; limit?: number }): Promise<PaginatedResponse<Prestamo>> {
    const queryParams = new URLSearchParams();
    if (params?.estado) queryParams.set('estado', params.estado);
    if (params?.page) queryParams.set('page', String(params.page));
    if (params?.limit) queryParams.set('limit', String(params.limit));

    const { data } = await api.get(`/salones/0/prestamos?${queryParams.toString()}`);
    return data;
  },

  async createPrestamo(input: {
    usuarioId?: number | null;
    nombreTercero?: string | null;
    monto: number;
    motivo?: string;
  }): Promise<Prestamo> {
    const { data } = await api.post('/salones/0/prestamos', input);
    return data;
  },

  async getPrestamo(id: number): Promise<PrestamoDetalle> {
    const { data } = await api.get(`/salones/0/prestamos/${id}`);
    return data;
  },

  async updatePrestamo(id: number, input: { motivo?: string; monto?: number }): Promise<void> {
    await api.put(`/salones/0/prestamos/${id}`, input);
  },

  async registrarPago(prestamoId: number, input: { monto: number; observacion?: string }): Promise<void> {
    await api.post(`/salones/0/prestamos/${prestamoId}/pagos`, input);
  },

  async cancelarPrestamo(id: number): Promise<void> {
    await api.delete(`/salones/0/prestamos/${id}`);
  },

  async getPrestamosPorEmpleado(usuarioId: number): Promise<PaginatedResponse<Prestamo>> {
    const { data } = await api.get(`/salones/0/prestamos/empleado/${usuarioId}`);
    return data;
  },
};
