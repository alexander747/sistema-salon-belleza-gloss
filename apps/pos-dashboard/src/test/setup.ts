import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Limpieza explícita por test: sin `globals: true` RTL no auto-registra su afterEach
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// jsdom no implementa matchMedia — framer-motion lo necesita y useMediaQuery (MUI) también.
// Nota: debe ser una función plana (NO vi.fn()): vi.restoreAllMocks() resetea los mocks de
// vitest tras cada test y dejaría matchMedia devolviendo undefined (MUI crashea leyendo .matches).
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

// ResizeObserver también lo usa framer-motion en algunos casos
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
if (!('ResizeObserver' in globalThis)) {
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverMock;
}
