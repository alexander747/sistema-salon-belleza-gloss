import api from './api';

export interface Producto {
  id: number;
  nombre: string;
  marca: string | null;
  color: string | null;
  tamano: string | null;
  descripcion: string | null;
  urlFoto: string | null;
  precioVenta: number;
  precioCompra?: number;
  margenGanancia: number;
  cantidadStock: number;
  stockMinimo: number;
  tipoInventario: 'RETAIL' | 'INTERNAL';
  activo: boolean;
  salonId: number;
  creadoEn: string;
  actualizadoEn: string;
}

export interface ProductoPrecioHistorico {
  id: number;
  productoId: number;
  precioCompra: number;
  precioVenta: number;
  cantidadAgregada: number;
  stockDespues: number;
  fecha: string;
  registradoPorId: number | null;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export async function fetchProductos(
  salonId: number,
  params?: { page?: number; limit?: number; q?: string; tipo?: string },
): Promise<Producto[] | PaginatedResult<Producto>> {
  const queryParams: Record<string, string> = {};
  if (params?.page) queryParams.page = String(params.page);
  if (params?.limit) queryParams.limit = String(params.limit);
  if (params?.q) queryParams.q = params.q;
  if (params?.tipo && params.tipo !== 'TODOS') queryParams.tipo = params.tipo;

  const query = new URLSearchParams(queryParams).toString();
  const url = `/salones/${salonId}/productos${query ? `?${query}` : ''}`;

  const { data } = await api.get(url);
  return data;
}

export async function fetchProducto(salonId: number, id: number): Promise<Producto> {
  const { data } = await api.get(`/salones/${salonId}/productos/${id}`);
  return data;
}

export async function createProducto(
  salonId: number,
  payload: {
    nombre: string;
    descripcion?: string;
    marca?: string;
    precioCompra?: number;
    margenGanancia?: number;
    precioVenta?: number;
    cantidadStock?: number;
    stockMinimo?: number;
    tipoInventario?: string;
  },
): Promise<Producto> {
  const { data } = await api.post(`/salones/${salonId}/productos`, payload);
  return data;
}

export async function updateProducto(
  salonId: number,
  id: number,
  payload: Record<string, unknown>,
): Promise<Producto> {
  const { data } = await api.put(`/salones/${salonId}/productos/${id}`, payload);
  return data;
}

export async function deleteProducto(salonId: number, id: number): Promise<void> {
  await api.delete(`/salones/${salonId}/productos/${id}`);
}

export async function restockProducto(
  salonId: number,
  id: number,
  payload: { cantidad: number; precioCompra: number },
): Promise<Producto> {
  const { data } = await api.post(`/salones/${salonId}/productos/${id}/restock`, payload);
  return data;
}

export async function descontarStock(
  salonId: number,
  id: number,
  cantidad: number,
): Promise<Producto> {
  const { data } = await api.post(`/salones/${salonId}/productos/${id}/descontar`, { cantidad });
  return data;
}

export async function fetchHistorialPrecios(
  salonId: number,
  productoId: number,
): Promise<ProductoPrecioHistorico[]> {
  const { data } = await api.get(`/salones/${salonId}/productos/${productoId}/historial-precios`);
  return data;
}
