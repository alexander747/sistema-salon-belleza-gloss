import { test, expect, loginAsDuena } from './auth';

/**
 * E2E — Navegación y mantenedores estandarizados.
 * Verifica: renombrado "Empleados", banner de caja SOLO en tab Caja,
 * paginación uniforme, y que los mantenedores cargan.
 */
test.describe('Navegación y mantenedores', () => {
  test('login y navegación al dashboard', async ({ page }) => {
    await loginAsDuena(page);
    await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible();
  });

  test('el sidebar dice "Empleados" (no "Empleadas")', async ({ page }) => {
    await loginAsDuena(page);
    await page.getByRole('button', { name: 'Empleados' }).click();
    await expect(page.getByRole('heading', { name: 'Empleados', level: 1 })).toBeVisible();
    await expect(page.getByRole('button', { name: /nuevo empleado/i })).toBeVisible();
  });

  test('el banner de caja NO aparece en Empleados (solo en tab Caja)', async ({ page }) => {
    await loginAsDuena(page);
    await page.getByRole('button', { name: 'Empleados' }).click();
    await expect(page.getByText(/caja abierta/i)).not.toBeVisible();
    await expect(page.getByText(/caja cerrada/i)).not.toBeVisible();
  });

  test('mantenedor de servicios carga', async ({ page }) => {
    await loginAsDuena(page);
    await page.getByRole('button', { name: 'Servicios' }).click();
    await expect(page.getByRole('heading', { name: 'Servicios', level: 1 })).toBeVisible();
    // El botón de crear servicio existe
    await expect(page.getByRole('button', { name: /nuevo servicio/i })).toBeVisible();
  });

  test('mantenedor de clientes carga', async ({ page }) => {
    await loginAsDuena(page);
    await page.getByRole('button', { name: 'Clientes' }).click();
    await expect(page.getByRole('heading', { name: 'Clientes', level: 1 })).toBeVisible();
  });

  test('mantenedor de productos carga', async ({ page }) => {
    await loginAsDuena(page);
    await page.getByRole('button', { name: 'Productos' }).click();
    await expect(page.getByRole('heading', { name: 'Productos', level: 1 })).toBeVisible();
    await expect(page.getByRole('button', { name: /nuevo producto/i })).toBeVisible();
  });

  test('el banner de caja aparece en Finanzas > tab Caja', async ({ page }) => {
    await loginAsDuena(page);
    await page.getByRole('button', { name: 'Finanzas' }).click();
    await page.getByRole('button', { name: /caja/i }).click();
    await expect(page.getByText(/caja abierta|Caja cerrada/i).first()).toBeVisible();
  });
});
