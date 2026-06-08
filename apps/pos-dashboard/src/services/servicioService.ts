import api from './api';

export interface Servicio {
  id: number;
  nombre: string;
  descripcion?: string;
  precioBase: number;
  precioFinal: number;
  duracionMinutos: number;
  categoriaId?: number;
  categoria?: { id: number; nombre: string } | null;
  activo: boolean;
  creadoEn?: string;
  actualizadoEn?: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: PaginationMeta;
}

export async function fetchServicios(
  salonId: number,
  params?: { page?: number; limit?: number; q?: string; categoriaId?: number },
): Promise<Servicio[] | PaginatedResult<Servicio>> {
  const queryParams: Record<string, string> = {};
  if (params?.page) queryParams.page = String(params.page);
  if (params?.limit) queryParams.limit = String(params.limit);
  if (params?.q) queryParams.q = params.q;
  if (params?.categoriaId) queryParams.categoriaId = String(params.categoriaId);

  const query = new URLSearchParams(queryParams).toString();
  const url = `/salones/${salonId}/servicios${query ? `?${query}` : ''}`;

  const { data } = await api.get(url);
  return data;
}
