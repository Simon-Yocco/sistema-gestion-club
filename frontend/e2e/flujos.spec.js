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
  await expect(
    page.getByRole('heading', { name: /^(Buen día|Buenas tardes|Buenas noches), Secretaría$/ }),
  ).toBeVisible();
  await expect(page.getByLabel('Saldos de la tienda')).toContainText('Efectivo');
});

test('venta simple en efectivo', async ({ page }) => {
  await entrar(page);
  await vender(page, { prenda: 'Remera titular Azul M' });
  await expect(page.locator('.etiqueta')).toHaveText('Pagada');
  const comprobante = page.getByRole('article', { name: 'Comprobante de venta' });
  await expect(comprobante.getByRole('row', { name: /Remera titular Azul M/ })).toBeVisible();
});

test('venta con pago mixto (efectivo + transferencia)', async ({ page }) => {
  await entrar(page);
  await page.goto('/ventas/nueva');
  await elegirPrenda(page, 'remera', 'Remera titular Azul L');
  await page.getByRole('button', { name: 'Mixto' }).click();
  await page.getByLabel('Monto en efectivo').fill('10.000');
  // la transferencia se completa sola con lo que falta
  await expect(page.getByLabel('Monto en transferencia')).toHaveValue('5.000,00');
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
  await page.getByRole('button', { name: 'Fiado' }).click();
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
  const comprobante = page.getByRole('article', { name: 'Comprobante de venta' });
  await expect(comprobante).toContainText('Juan Pérez');
  await expect(comprobante).toContainText('el Turco');

  await page.getByRole('button', { name: 'Cobrar' }).click();
  const cobro = page.getByRole('dialog');
  await cobro.getByRole('button', { name: 'Efectivo', exact: true }).click();
  await cobro.getByRole('button', { name: 'Registrar cobro' }).click();
  await expect(toast(page, 'Cobro de $ 15.000,00 registrado.')).toBeVisible();
  await expect(page.locator('.etiqueta')).toHaveText('Pagada');

  // en Clientes figura, pero ya no entre los que deben
  await page.goto('/clientes');
  await expect(page.getByRole('table')).toContainText('Juan Pérez');
  await page.getByLabel('Mostrar').selectOption('deudores');
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
  await modal.getByRole('button', { name: 'Efectivo', exact: true }).click();
  await modal.getByRole('button', { name: 'Confirmar cambio' }).click();

  await expect(toast(page, 'Cambio registrado.')).toBeVisible();
  await expect(page.getByRole('main')).toContainText('Se cobró la diferencia');
  await expect(
    page.getByRole('row', { name: /Buzo con capucha \(por cambio\) Azul M/ }),
  ).toBeVisible();
});

test('devolución parcial con reintegro', async ({ page }) => {
  await entrar(page);
  await vender(page, { prenda: 'Remera titular Azul S', cantidad: 2 });

  await page.getByRole('button', { name: 'Devolver' }).click();
  const modal = page.getByRole('dialog');
  await modal.getByLabel('Cantidad a devolver de Remera titular Azul S').selectOption('1');
  await modal.getByLabel('Motivo (obligatorio)').fill('No le quedaba bien');
  await expect(modal).toContainText('Devolver al cliente: $ 15.000,00');
  // por defecto en efectivo, pero se puede elegir transferencia
  await expect(modal.getByLabel('Monto en efectivo')).toHaveValue('15.000,00');
  await modal.getByRole('button', { name: 'Transferencia', exact: true }).click();
  await expect(modal.getByLabel('Monto en transferencia')).toHaveValue('15.000,00');
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
  await expect(page.locator('.saldo--negativo', { hasText: 'Efectivo' })).toBeVisible();
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
  // Dinero: saldo de hoy y deuda con la comisión
  await expect(page.getByText('Efectivo hoy')).toBeVisible();
  await expect(page.getByText('Se le debe a la comisión')).toBeVisible();
  await page.getByRole('button', { name: 'Ganancia por producto' }).click();
  await expect(page.locator('.barras').first()).toBeVisible();
  await expect(page.getByRole('table')).toContainText('Remera titular');
});

test('secretaría ve las prendas con precio y talles', async ({ page }) => {
  await entrar(page);
  await page.getByRole('navigation').getByRole('link', { name: 'Prendas' }).click();
  const remera = page.getByRole('article', { name: 'Remera titular' });
  await expect(remera).toContainText('$ 15.000,00');
  await expect(remera.getByRole('rowheader', { name: 'Azul' })).toBeVisible();
  await page.getByLabel('Buscar prenda').fill('buzo');
  await expect(page.getByRole('article', { name: 'Remera titular' })).toHaveCount(0);
  await expect(page.getByRole('article', { name: 'Buzo con capucha' })).toContainText(
    '$ 35.000,00',
  );
});

test('el admin crea un producto y le carga mercadería por talle en la misma pantalla', async ({
  page,
}) => {
  await entrar(page, ADMIN);
  await page.goto('/productos');
  await page.getByRole('button', { name: '+ Nuevo producto' }).click();
  const alta = page.getByRole('dialog');
  await alta.getByLabel('Nombre').fill('Musculosa');
  await alta.getByLabel('Marca (opcional)').fill('Kappa');
  await alta.getByLabel('Precio de venta').fill('20000');
  await alta.getByLabel('Costo').fill('9000');
  await alta.getByRole('button', { name: 'Crear y cargar mercadería' }).click();

  // queda abierta la ficha del producto nuevo, sin talles todavía
  await expect(page.getByRole('heading', { name: /Musculosa/ })).toBeVisible();
  await expect(page.getByText('Todavía no ingresó mercadería.')).toBeVisible();
  await page.getByLabel('Color').fill('Roja');
  await page.getByLabel('Talle').fill('M');
  await page.getByLabel('Cantidad').fill('3');
  await page.getByRole('button', { name: '+ Agregar' }).click();
  await page.getByLabel('Talle').fill('l');
  await page.getByLabel('Cantidad').fill('2');
  await page.getByRole('button', { name: '+ Agregar' }).click();
  await expect(page.getByText('5 prendas')).toBeVisible();
  await page.getByRole('button', { name: 'Revisar y confirmar' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirmar ingreso' }).click();
  await expect(toast(page, '5 prendas')).toBeVisible();

  // el stock aparece en la ficha y la prenda ya se puede vender
  await expect(page.getByRole('rowheader', { name: 'Roja' })).toBeVisible();
  await page.goto('/prendas');
  await expect(page.getByRole('article', { name: 'Musculosa' })).toContainText('5 unidades');
});
