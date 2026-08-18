/**
 * Re-mockea `window.matchMedia` para simular un viewport móvil o desktop
 * ANTES de renderizar el componente bajo test (useMediaQuery lee el mock
 * en el montaje). El mock de `src/test/setup.ts` deja `matches: false`
 * (desktop); los tests que necesiten el path móvil llaman
 * `setMobileMedia(true)` justo antes de render.
 *
 * Importante: es una función plana (NO vi.fn()) a propósito —
 * vi.restoreAllMocks() resetea los mocks de vitest tras cada test y
 * dejaría matchMedia devolviendo undefined (MUI crashea leyendo .matches).
 *
 * Uso en archivos de test con mezcla de casos móvil/desktop:
 *   beforeEach(() => setMobileMedia(false)); // arrancar siempre en desktop
 */
export function setMobileMedia(matches: boolean): void {
  window.matchMedia = ((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}
