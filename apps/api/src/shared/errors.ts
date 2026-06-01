/**
 * Base application error class with HTTP status code and error code.
 * All custom errors extend this class for consistent error handling
 * in the global error handler middleware.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(message: string, statusCode: number, code: string, details?: unknown) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * 404 — Resource not found.
 */
export class NotFoundError extends AppError {
  constructor(message = 'Recurso no encontrado', details?: unknown) {
    super(message, 404, 'NOT_FOUND', details);
  }
}

/**
 * 401 — Authentication failed or missing.
 */
export class UnauthorizedError extends AppError {
  constructor(message = 'No autorizado', details?: unknown) {
    super(message, 401, 'UNAUTHORIZED', details);
  }
}

/**
 * 403 — Authenticated but insufficient permissions.
 */
export class ForbiddenError extends AppError {
  constructor(message = 'Acceso denegado', details?: unknown) {
    super(message, 403, 'FORBIDDEN', details);
  }
}

/**
 * 400 — Request validation failed.
 */
export class ValidationError extends AppError {
  constructor(message = 'Datos inválidos', details?: unknown) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

/**
 * 409 — Resource conflict (e.g. duplicate email).
 */
export class ConflictError extends AppError {
  constructor(message = 'Conflicto de recursos', details?: unknown) {
    super(message, 409, 'CONFLICT', details);
  }
}

/**
 * 422 — Unprocessable entity (e.g. insufficient stock, business rule violation).
 */
export class UnprocessableEntityError extends AppError {
  constructor(message = 'Solicitud no procesable', details?: unknown) {
    super(message, 422, 'UNPROCESSABLE_ENTITY', details);
  }
}
