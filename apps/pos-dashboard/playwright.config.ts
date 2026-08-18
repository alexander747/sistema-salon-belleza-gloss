import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E — capa de regresión sobre el dashboard (apps/pos-dashboard).
 *
 * Requiere que el stack corra: docker compose up (API :3001, dashboard :5174).
 * - URL base: http://localhost:5174 (Vite dev server en docker)
 * - Autenticación: login real con duena@test.com / duena123 (usuario de prueba)
 *
 * Ejecutar:
 *   cd apps/pos-dashboard && npx playwright test
 *   npx playwright test --ui        (modo visual)
 *   npx playwright test --headed    (ver el navegador)
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:5174',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // El contenedor de la API corre en UTC (sin TZ en docker-compose) y la app
    // asume que el navegador comparte la TZ del servidor: los slots de
    // disponibilidad se calculan en hora UTC y el create convierte la hora
    // local del navegador. Sin alinear TZ, crear en el slot "06:00" persiste
    // 11:00Z (Bogotá) y choca con citas existentes ("Conflicto con cita
    // existente"). Alinear el navegador a UTC hace el flujo determinista.
    timezoneId: 'UTC',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
