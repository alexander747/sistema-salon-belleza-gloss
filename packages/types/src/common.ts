/** Standard API response wrapper. */
export interface ApiResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: ErrorDetail;
}

/** Paginated response with metadata. */
export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/** Error-only response. */
export interface ErrorResponse {
  ok: false;
  error: ErrorDetail;
}

/** Structured error detail. */
export interface ErrorDetail {
  code: string;
  message: string;
  details?: unknown;
}

/** Audit log entry shape. */
export interface BitacoraEntry {
  id: number;
  usuarioId: number;
  salonId: number;
  accion: string;
  entidad: string;
  entidadId?: number;
  detalles?: unknown;
  ip?: string;
  creadoEn: Date;
}
