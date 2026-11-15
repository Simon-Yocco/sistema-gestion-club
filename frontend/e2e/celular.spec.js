// 15.5 Prueba en celular: pantalla chica (Pixel 7). Las pantallas de secretaría no tienen
// que desbordar a lo ancho y una venta se tiene que poder hacer con el dedo.
import { test, expect } from '@playwright/test';
import { entrar, vender } from './ayudas.js';

const sinScrollHorizontal = (page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

test('las pantallas de secretaría entran en el ancho del celular', async ({ page }) => {
  await entrar(page);
  for (const ruta of [
    '/',
    '/ventas/nueva',
    '/ventas',
    '/deudores',
    '/prendas',
    '/egresos',
    '/prestamos',
    '/banco',
  ]) {
    await page.goto(ruta);
    await page.waitForLoadState('networkidle');
    expect(await sinScrollHorizontal(page), `${ruta} desborda a lo ancho`).toBe(true);
  }
});

test('venta en efectivo desde el celular', async ({ page }) => {
  await entrar(page);
  await vender(page, { prenda: 'Remera titular Azul XL' });
  await expect(page.locator('.etiqueta')).toHaveText('Pagada');
  expect(await sinScrollHorizontal(page)).toBe(true);
});
