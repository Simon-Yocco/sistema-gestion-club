// 15.1 Flujos principales de punta a punta (navegador real + API + MySQL).
// Datos de partida: el seeder (Remera titular $15.000, Short $9.000, Buzo $35.000).
import { test, expect } from '@playwright/test';
import { entrar, elegirPrenda, vender, toast, ADMIN } from './ayudas.js';

test('login: contraseña incorrecta muestra error; correcta entra al inicio con saldos', async ({
  page,
}) => {
  await page.goto('/login');
  await page.getByLabel('Usuario').fill('secretaria');
  await page.getByLabel('Contraseña').fill('mala-clave');
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page.getByRole('alert')).toHaveText('Usuario o contraseña incorrectos.');

  await entrar(page);
  await expect(page.getByRole('heading', { name: 'Hola, Secretaría' })).toBeVisible();
  await expect(page.getByLabel('Saldos de la tienda')).toContainText('Efectivo');
});

test('venta simple en efectivo', async ({ page }) => {
  await entrar(page);
  await vender(page, { prenda: 'Remera titular Azul M' });
  await expect(page.locator('.etiqueta')).toHaveText('Pagada');
  await expect(page.getByRole('main')).toContainText('Remera titular Azul M');
});

test('venta con pago mixto (efectivo + transferencia)', async ({ page }) => {
  await entrar(page);
  await page.goto('/ventas/nueva');
  await elegirPrenda(page, 'remera', 'Remera titular Azul L');
  await page.getByRole('button', { name: '+ Agregar pago' }).click();
  await page.getByRole('button', { name: '+ Agregar pago' }).click();
  await page.getByLabel('Medio del pago 1').selectOption('efectivo');
  await page.getByLabel('Monto del pago 1').fill('10.000');
  await page.getByLabel('Medio del pago 2').selectOption('transferencia');
  await page.getByLabel('Monto del pago 2').fill('5000');
  await page.getByRole('button', { name: 'Revisar y confirmar' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirmar venta' }).click();

  await expect(page.locator('.etiqueta')).toHaveText('Pagada');
  const pagos = page.getByRole('table').nth(1);
  await expect(pagos).toContainText('$ 10.000,00');
  await expect(pagos).toContainText('$ 5.000,00');
});

test('fiado con comprador nuevo y después cobro', async ({ page }) => {
  await entrar(page);
  await page.goto('/ventas/nueva');
  await elegirPrenda(page, 'remera', 'Remera titular Blanca M');
  await expect(page.getByText(/elegí el comprador con su teléfono/)).toBeVisible();

  await page.getByLabel(/Comprador \(nombre/).fill('Juan Pérez');
  await page.getByRole('button', { name: /Cargar comprador nuevo/ }).click();
  await page.getByLabel('Apodo (opcional)').fill('el Turco');
  await page.getByLabel('Teléfono').fill('11 5555-1234');
  await page.getByRole('button', { name: 'Revisar y confirmar' }).click();
  const confirmar = page.getByRole('dialog');
  await expect(confirmar).toContainText('Queda fiado: $ 15.000,00');
  await confirmar.getByRole('button', { name: 'Confirmar venta' }).click();

  await expect(page.locator('.etiqueta')).toHaveText('Fiado');
  await expect(page.getByRole('main')).toContainText('Juan Pérez ("el Turco")');

  await page.getByRole('button', { name: 'Cobrar' }).click();
  const cobro = page.getByRole('dialog');
  await cobro.getByRole('button', { name: 'Todo en efectivo' }).click();
  await cobro.getByRole('button', { name: 'Registrar cobro' }).click();
  await expect(toast(page, 'Cobro de $ 15.000,00 registrado.')).toBeVisible();
  await expect(page.locator('.etiqueta')).toHaveText('Pagada');

  // ya no figura en deudores
  await page.goto('/deudores');
  await expect(page.getByText('Nadie debe nada.')).toBeVisible();
});

test('cambio de prenda por una más cara cobrando la diferencia', async ({ page }) => {
  await entrar(page);
  await vender(page, { prenda: 'Remera titular Blanca L' });

  await page.getByRole('button', { name: 'Cambiar prenda' }).click();
  const modal = page.getByRole('dialog');
  await elegirPrenda(modal, 'buzo', 'Buzo con capucha Azul M');
  await expect(modal).toContainText('La prenda nueva es más cara');
  await expect(modal).toContainText('Diferencia $ 20.000,00');
  await modal.getByRole('button', { name: 'Todo en efectivo' }).click();
  await modal.getByRole('button', { name: 'Confirmar cambio' }).click();

  await expect(toast(page, 'Cambio registrado.')).toBeVisible();
  await expect(page.getByRole('main')).toContainText('Se cobró la diferencia');
  await expect(page.getByRole('main')).toContainText('Buzo con capucha Azul M (por cambio)');
});

test('devolución parcial con reintegro', async ({ page }) => {
  await entrar(page);
  await vender(page, { prenda: 'Remera titular Azul S', cantidad: 2 });

  await page.getByRole('button', { name: 'Devolver' }).click();
  const modal = page.getByRole('dialog');
  await modal.getByLabel('Cantidad a devolver de Remera titular Azul S').selectOption('1');
  await modal.getByLabel('Motivo (obligatorio)').fill('No le quedaba bien');
  await expect(modal).toContainText('Devolver al cliente');
  await expect(modal).toContainText('$ 15.000,00 en efectivo');
  await modal.getByRole('button', { name: 'Registrar devolución' }).click();

  await expect(toast(page, 'Devolución registrada.')).toBeVisible();
  await expect(page.locator('.totales')).toContainText('$ 15.000,00');
  await expect(page.getByRole('main')).toContainText('No le quedaba bien');
});

test('anulación de una venta', async ({ page }) => {
  await entrar(page);
  await vender(page, { busqueda: 'short', prenda: 'Short de entrenamiento Negro M' });

  await page.getByRole('button', { name: 'Anular venta' }).click();
  const modal = page.getByRole('dialog');
  await expect(modal).toContainText('se devuelven $ 9.000,00');
  await expect(modal.getByRole('button', { name: 'Anular venta' })).toBeDisabled();
  await modal.getByLabel(/Motivo de la anulación/).fill('Se cargó por error');
  await modal.getByRole('button', { name: 'Anular venta' }).click();

  await expect(page.locator('.etiqueta')).toHaveText('Anulada');
  await expect(page.getByRole('main')).toContainText('Se cargó por error');
  await expect(page.getByRole('button', { name: 'Cobrar' })).toHaveCount(0);
});

test('egreso que deja el saldo negativo: avisa antes y permite registrarlo', async ({ page }) => {
  await entrar(page);
  await page.goto('/egresos');
  await page.getByLabel('Monto', { exact: true }).fill('9.999.999');
  await expect(page.getByText(/va a quedar negativo/)).toBeVisible();
  await page.getByLabel('Descripción').fill('Compra grande');
  await page.getByRole('button', { name: 'Registrar egreso' }).click();

  await expect(toast(page, 'Egreso registrado.')).toBeVisible();
  await expect(toast(page, 'quedó negativo')).toBeVisible();
  await expect(page.locator('.saldo--negativo')).toBeVisible();
  await expect(page.getByRole('table')).toContainText('Compra grande');
});

test('depósito bancario: pasa de efectivo a transferencia', async ({ page }) => {
  await entrar(page);
  await page.goto('/banco');
  await page.getByLabel('Monto', { exact: true }).fill('1000');
  await expect(page.getByText('(el total no cambia)')).toBeVisible();
  await page.getByLabel('N° de comprobante (opcional)').fill('BOL-1');
  await page.getByRole('button', { name: 'Registrar' }).click();

  await expect(toast(page, 'Depósito registrado.')).toBeVisible();
  await expect(page.getByRole('table')).toContainText('BOL-1');
});

test('el admin ve el dashboard y los reportes con lo vendido', async ({ page }) => {
  await entrar(page, ADMIN);
  await expect(page.getByText('Ventas de hoy')).toBeVisible();
  await page.goto('/reportes');
  await expect(page.locator('.barras').first()).toBeVisible();
  await expect(page.getByRole('table')).toContainText('Remera titular');
});
