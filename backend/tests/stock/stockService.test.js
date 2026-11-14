import { describe, it, expect } from 'vitest';
import { sequelize, Variante } from '../../src/models/index.js';
import * as stockService from '../../src/modules/stock/stock.service.js';
import { crearProductoConVariantes } from '../helpers/factories.js';

const enTransaccion = (fn) => sequelize.transaction(fn);
const stockDe = async (id) => (await Variante.findByPk(id)).stock;

async function unaVariante(stock) {
  const { variantes } = await crearProductoConVariantes({
    nombre: 'Remera',
    colores: ['Azul'],
    talles: ['M'],
    stock,
  });
  return variantes[0];
}

describe('stockService', () => {
  it('descontar y reponer modifican el stock', async () => {
    const v = await unaVariante(5);
    await enTransaccion((t) => stockService.descontar(v.id, 3, t));
    expect(await stockDe(v.id)).toBe(2);
    await enTransaccion((t) => stockService.reponer(v.id, 4, t));
    expect(await stockDe(v.id)).toBe(6);
  });

  it('puede dejar el stock exactamente en 0', async () => {
    const v = await unaVariante(2);
    await enTransaccion((t) => stockService.descontar(v.id, 2, t));
    expect(await stockDe(v.id)).toBe(0);
  });

  it('stock insuficiente → STOCK_INSUFICIENTE con detalle, sin modificar nada', async () => {
    const v = await unaVariante(2);
    const error = await enTransaccion((t) => stockService.descontar(v.id, 3, t)).catch((e) => e);

    expect(error).toMatchObject({
      status: 409,
      code: 'STOCK_INSUFICIENTE',
      details: {
        variante_id: v.id,
        producto: 'Remera',
        color: 'Azul',
        talle: 'M',
        solicitado: 3,
        disponible: 2,
      },
    });
    expect(error.message).toContain('Remera Azul M');
    expect(await stockDe(v.id)).toBe(2);
  });

  it('si la transacción falla después, el descuento se revierte', async () => {
    const v = await unaVariante(5);
    await expect(
      enTransaccion(async (t) => {
        await stockService.descontar(v.id, 2, t);
        throw new Error('falla posterior');
      }),
    ).rejects.toThrow('falla posterior');
    expect(await stockDe(v.id)).toBe(5);
  });

  it('variante inexistente → VARIANTE_NO_ENCONTRADA', async () => {
    await expect(enTransaccion((t) => stockService.descontar(99999, 1, t))).rejects.toMatchObject({
      code: 'VARIANTE_NO_ENCONTRADA',
    });
    await expect(enTransaccion((t) => stockService.reponer(99999, 1, t))).rejects.toMatchObject({
      code: 'VARIANTE_NO_ENCONTRADA',
    });
  });

  it('exige transacción y cantidades enteras positivas', async () => {
    const v = await unaVariante(5);
    await expect(stockService.descontar(v.id, 1)).rejects.toThrow(/transacción/);
    await expect(enTransaccion((t) => stockService.descontar(v.id, 0, t))).rejects.toThrow(
      /cantidad/,
    );
    await expect(enTransaccion((t) => stockService.reponer(v.id, 1.5, t))).rejects.toThrow(
      /cantidad/,
    );
    expect(await stockDe(v.id)).toBe(5);
  });

  it('concurrencia: dos ventas simultáneas de la última unidad → solo una tiene éxito', async () => {
    const v = await unaVariante(1);

    // Cada "venta" descuenta y sigue trabajando un rato antes de confirmar, para que
    // la otra intente descontar mientras la primera todavía tiene la fila bloqueada.
    const venta = () =>
      enTransaccion(async (t) => {
        await stockService.descontar(v.id, 1, t);
        await new Promise((r) => setTimeout(r, 200));
      });

    const resultados = await Promise.allSettled([venta(), venta()]);

    expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const fallida = resultados.find((r) => r.status === 'rejected');
    expect(fallida.reason.code).toBe('STOCK_INSUFICIENTE');
    expect(await stockDe(v.id)).toBe(0);
  });

  it('concurrencia: 10 ventas simultáneas sobre 3 unidades → exactamente 3 éxitos', async () => {
    const v = await unaVariante(3);
    const resultados = await Promise.allSettled(
      Array.from({ length: 10 }, () => enTransaccion((t) => stockService.descontar(v.id, 1, t))),
    );
    expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(3);
    expect(await stockDe(v.id)).toBe(0);
  });
});
