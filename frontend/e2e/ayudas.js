import { expect } from '@playwright/test';

/** Usuarios del seeder (solo desarrollo y test). */
export const SECRETARIA = { usuario: 'secretaria', clave: 'secretaria1234' };
export const ADMIN = { usuario: 'admin', clave: 'admin1234' };

export async function entrar(page, { usuario, clave } = SECRETARIA) {
  await page.goto('/login');
  await page.getByLabel('Usuario').fill(usuario);
  await page.getByLabel('Contraseña').fill(clave);
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page.getByRole('button', { name: 'Salir' })).toBeVisible();
}

/** Busca una prenda y toca su talle en la grilla. `prenda` = "Remera titular Azul M". */
export async function elegirPrenda(scope, busqueda, prenda) {
  await scope.getByLabel('Buscar prenda').fill(busqueda);
  await scope.getByRole('button', { name: new RegExp(`^${prenda},`) }).click();
}

/**
 * Hace una venta desde "Nueva venta". `pagar`: 'efectivo' | 'transferencia' | null (fiado).
 * Devuelve el número de venta (queda abierto su detalle).
 */
export async function vender(
  page,
  { busqueda = 'remera', prenda, cantidad = 1, pagar = 'efectivo' },
) {
  await page.goto('/ventas/nueva');
  for (let i = 0; i < cantidad; i++) await elegirPrenda(page, busqueda, prenda);
  if (pagar) {
    await page
      .getByRole('button', {
        name: pagar === 'efectivo' ? 'Efectivo' : 'Transferencia',
        exact: true,
      })
      .click();
  }
  await page.getByRole('button', { name: 'Revisar y confirmar' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirmar venta' }).click();
  const titulo = page.getByRole('heading', { name: /^Venta #\d+/ });
  await expect(titulo).toBeVisible();
  return Number((await titulo.textContent()).match(/#(\d+)/)[1]);
}

export const toast = (page, texto) => page.locator('.toast').filter({ hasText: texto });
