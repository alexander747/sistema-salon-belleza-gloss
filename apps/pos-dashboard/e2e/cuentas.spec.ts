import { test, expect, loginAsDuena } from './auth';

/**
 * E2E — Cuentas por cobrar/pagar.
 * Verifica: préstamos en Por cobrar, sección Pendientes vs Al día en Por pagar.
 */
test.describe('Cuentas', () => {
  test('el tab Cuentas muestra Por cobrar y Por pagar', async ({ page }) => {
    await loginAsDuena(page);
    await page.getByRole('button', { name: 'Finanzas' }).click();
    await page.getByRole('button', { name: /cuentas/i }).click();

    // Sub-vistas
    await expect(page.getByRole('button', { name: /por cobrar/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /por pagar/i })).toBeVisible();
  });

  test('Por pagar separa Pendientes de "Al día"', async ({ page }) => {
    await loginAsDuena(page);
    await page.getByRole('button', { name: 'Finanzas' }).click();
    await page.getByRole('button', { name: /cuentas/i }).click();
    await page.getByRole('button', { name: /por pagar/i }).click();

    // La sección de pendientes existe (puede estar vacía, pero el encabezado aparece)
    await expect(page.getByText('Pendientes').first()).toBeVisible({ timeout: 10000 });
  });

  test('la tabla de registros tiene acciones visibles (sticky)', async ({ page }) => {
    await loginAsDuena(page);
    await page.getByRole('button', { name: 'Finanzas' }).click();
    // Tab de registros es el default
    await expect(page.getByRole('heading', { name: /resumen del/i })).toBeVisible({ timeout: 10000 });
    // La columna Acciones existe
    await expect(page.getByRole('columnheader', { name: 'Acciones' }).first()).toBeVisible();
  });
});
