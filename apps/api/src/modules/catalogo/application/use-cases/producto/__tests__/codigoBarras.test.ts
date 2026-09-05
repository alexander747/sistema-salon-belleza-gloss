import { describe, it, expect } from 'vitest';
import { normalizeCodigoBarras } from '../codigoBarras';

describe('normalizeCodigoBarras', () => {
  it('returns null when the value is absent (undefined)', () => {
    expect(normalizeCodigoBarras(undefined)).toBeNull();
  });

  it('returns null when the value is null', () => {
    expect(normalizeCodigoBarras(null)).toBeNull();
  });

  it('returns null when the value is an empty string', () => {
    expect(normalizeCodigoBarras('')).toBeNull();
  });

  it('returns null when the value is only whitespace', () => {
    expect(normalizeCodigoBarras('   ')).toBeNull();
  });

  it('keeps a real barcode trimmed', () => {
    expect(normalizeCodigoBarras('7701234567890')).toBe('7701234567890');
    expect(normalizeCodigoBarras('  7701234567890  ')).toBe('7701234567890');
  });
});
