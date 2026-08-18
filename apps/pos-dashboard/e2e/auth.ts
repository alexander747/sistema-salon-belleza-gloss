import { test as base, expect, type Page } from '@playwright/test';

/**
 * Fixture E2E: autenticación como dueña (usuario de prueba del seed).
 * Guarda el estado de login (storageState) para reutilizarlo entre tests.
 */

export const TEST_USER = {
  email: 'duena@test.com',
  password: 'duena123',
};

/** Realiza login real en el dashboard y devuelve la página autenticada. */
export async function loginAsDuena(page: Page): Promise<void> {
  await page.goto('/login');
  // Las credenciales vienen precargadas por el formulario de test — asegurar valores
  const email = page.getByRole('textbox', { name: 'Email' });
  await email.fill(TEST_USER.email);
  await page.getByRole('textbox', { name: 'Contraseña' }).fill(TEST_USER.password);
  await page.getByRole('button', { name: 'Ingresar' }).click();
  // Esperar que la app navegue al dashboard
  await expect(page).toHaveURL(/\/$/);
  await page.getByRole('heading', { name: 'Dashboard', level: 1 }).waitFor();
}

/** Test base con login automático por test. */
export const test = base.extend<{ authedPage: Page }>({
  authedPage: async ({ page }, use) => {
    await loginAsDuena(page);
    await use(page);
  },
});

export { expect };
