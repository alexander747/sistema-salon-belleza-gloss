import { describe, it, expect, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate } from '../validate';
import { ValidationError } from '../../../shared/errors';

const testSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

describe('validate middleware', () => {
  it('should call next() when body is valid', () => {
    const middleware = validate(testSchema);
    const req = {
      body: { email: 'test@test.com', password: 'password123' },
    } as Request;
    const res = {} as Response;
    const next = vi.fn() as unknown as NextFunction;

    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.body.email).toBe('test@test.com');
  });

  it('should throw ValidationError when body is invalid', () => {
    const middleware = validate(testSchema);
    const req = {
      body: { email: 'not-an-email', password: 'ab' },
    } as Request;
    const res = {} as Response;
    const next = vi.fn() as unknown as NextFunction;

    expect(() => middleware(req, res, next)).toThrow(ValidationError);
    expect(next).not.toHaveBeenCalled();
  });

  it('should throw ValidationError when required field is missing', () => {
    const middleware = validate(testSchema);
    const req = {
      body: { email: 'test@test.com' },
    } as Request;
    const res = {} as Response;
    const next = vi.fn() as unknown as NextFunction;

    expect(() => middleware(req, res, next)).toThrow(ValidationError);
  });

  it('should throw ValidationError when body is empty', () => {
    const middleware = validate(testSchema);
    const req = { body: {} } as Request;
    const res = {} as Response;
    const next = vi.fn() as unknown as NextFunction;

    expect(() => middleware(req, res, next)).toThrow(ValidationError);
  });
});
