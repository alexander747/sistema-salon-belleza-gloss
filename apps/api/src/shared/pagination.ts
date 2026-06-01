export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export function paginate<T>(
  data: T[],
  total: number,
  params: PaginationParams,
): PaginatedResult<T> {
  const totalPages = params.limit > 0 ? Math.ceil(total / params.limit) : 1;
  return {
    data,
    meta: {
      page: params.page,
      limit: params.limit,
      total,
      totalPages,
    },
  };
}
