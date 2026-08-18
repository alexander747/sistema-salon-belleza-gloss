import { test, expect, loginAsDuena } from './auth';

/**
 * E2E — Flujo de citas (el core del negocio).
 * Los tests CREAN su propia cita (determinista, no depende de datos existentes).
 * Verifica: gating de botones por estado, errores visibles, flujo atómico completar.
 */
test.describe('Flujo de citas', () => {
  // Los 3 tests crean una cita en el MISMO primer slot disponible de hoy;
  // en paralelo competirían por el mismo horario. Serial los hace deterministas.
  test.describe.configure({ mode: 'serial' });

  /** Crea una cita PENDIENTE para hoy (cliente Carolina, servicio Corte, Ana). */
  async function crearCitaPendiente(page: import('@playwright/test').Page) {
    await page.getByRole('button', { name: 'Citas' }).click();
    await page.getByRole('button', { name: '+ Nueva Cita' }).click();

    // El modal de nueva cita NO expone role="dialog": es un overlay de framer-motion
    // con CSS modules (_modalOverlay_*). Scopeamos TODOS los selectores al overlay
    // para no chocar con la agenda (los textos exactos también existen en las
    // tarjetas de citas detrás) ni con el filtro "Todas las empleadas" del toolbar.
    const modal = page.locator('[class*="modalOverlay"]').filter({ hasText: 'Nueva Cita' });

    // Cliente — el dropdown del modal expone role="option"
    await modal.getByPlaceholder(/buscar cliente/i).fill('Carolina');
    await modal.getByRole('option', { name: /Carolina de los Ángeles Peña/ }).click();

    // Servicio — el label muestra el precio con NBSP ("$ 35.000") y su span de nombre
    // queda DEBAJO del MUI Drawer (z-index 1200 > overlay 200) en la izquierda.
    // Click en el label completo (full-width, centro libre) togglea el checkbox nativamente.
    await modal.locator('label').filter({ hasText: 'Corte de cabello' }).click();

    // Empleada — select nativo DENTRO del modal (el toolbar tiene OTRO combobox:
    // "Todas las empleadas"). selectOption evita abrir el dropdown.
    await modal.locator('select').selectOption({ label: 'Ana Martínez' });

    // Fecha: hoy (el date input del modal)
    const today = new Date();
    const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    await modal.locator('input[type="date"]').fill(iso);

    // Hora: elegir el primer slot disponible (botones de la grilla del modal)
    await modal.getByRole('button', { name: /^\d{2}:\d{2}$/ }).first().click();

    // Crear
    await modal.getByRole('button', { name: 'Crear cita' }).click();
    await expect(page.getByText('Pendiente', { exact: true }).first()).toBeVisible({ timeout: 10000 });
  }

  test('una cita PENDIENTE muestra Confirmar y Cancelar, NO Completar', async ({ page }) => {
    await loginAsDuena(page);
    await crearCitaPendiente(page);

    // Abrir la cita pendiente
    await page.getByText('Pendiente', { exact: true }).first().click();

    // Gating: PENDIENTE → Confirmar + Cancelar, sin Completar
    await expect(page.getByRole('button', { name: 'Confirmar' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cancelar Cita' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Completar' })).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'No llegó' })).not.toBeVisible();
  });

  test('al confirmar, la cita pasa a CONFIRMADA y muestra Completar + No llegó', async ({ page }) => {
    await loginAsDuena(page);
    await crearCitaPendiente(page);

    // Confirmar
    await page.getByText('Pendiente', { exact: true }).first().click();
    await page.getByRole('button', { name: 'Confirmar' }).click();
    await expect(page.getByText('Confirmada', { exact: true }).first()).toBeVisible({ timeout: 10000 });

    // Abrir → gating CONFIRMADA
    await page.getByText('Confirmada', { exact: true }).first().click();
    await expect(page.getByRole('button', { name: 'Completar' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'No llegó' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cancelar Cita' })).toBeVisible();
  });

  test('el modal de completar muestra Monto recibido con formato de miles', async ({ page }) => {
    await loginAsDuena(page);
    await crearCitaPendiente(page);

    // Confirmar y completar
    await page.getByText('Pendiente', { exact: true }).first().click();
    await page.getByRole('button', { name: 'Confirmar' }).click();
    await page.getByText('Confirmada', { exact: true }).first().click();
    await page.getByRole('button', { name: 'Completar' }).click();

    // Modal de completar: Monto recibido visible y formateado
    await expect(page.getByText('Monto recibido')).toBeVisible();
    const montoRecibido = page.getByText('Monto recibido').locator('..').locator('input');
    // MoneyInput muestra el total como placeholder (value 0 = campo vacío)
    await expect(montoRecibido).toHaveAttribute('placeholder', /\$\s?\d{1,3}(\.\d{3})*/);
  });
});
