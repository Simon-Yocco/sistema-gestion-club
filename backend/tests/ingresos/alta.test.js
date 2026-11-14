import { describe, it, expect } from 'vitest';
import {
  Variante,
  Producto,
  IngresoMercaderia,
  IngresoItem,
  MovimientoFondos,
} from '../../src/models/index.js';
import { hoyArgentina } from '../../src/utils/fechas.js';
import { loginComoAdmin, loginComoSecretaria } from '../helpers/auth.js';
import { crearProductoConVariantes } from '../helpers/factories.js';

const stockDe = async (id) => (await Variante.findByPk(id)).stock;

async function remera() {
  return crearProductoConVariantes({
    nombre: 'Remera',
    costo: '8000.00',
    colores: ['Azul'],
    talles: ['S', 'M'],
    stock: 2,
  });
}

describe('POST /api/ingresos', () => {
  it('suma el stock, guarda el costo del producto en cada ítem y no mueve dinero', async () => {
    const { agent, usuario } = await loginComoAdmin();
    const { variantes } = await remera();
    const [s, m] = variantes;

    const res = await agent.post('/api/ingresos').send({
      fecha: '2026-11-10',
      proveedor: 'Textil Sur',
      items: [
        { variante_id: s.id, cantidad: 10 },
        { variante_id: m.id, cantidad: 5 },
      ],
    });

    expect(res.status).toBe(201);
    expect(res.body.ingreso).toMatchObject({
      fecha: '2026-11-10',
      proveedor: 'Textil Sur',
      observaciones: null,
      usuario: { id: usuario.id },
      unidades: 15,
      total: '120000.00',
      pagado: '0.00',
      estado_pago: 'no_pagado',
      egresos: [],
    });
    expect(res.body.ingreso.items).toEqual([
      expect.objectContaining({
        variante_id: s.id,
        producto: 'Remera',
        color: 'Azul',
        talle: 'S',
        cantidad: 10,
        costo_unitario: '8000.00',
        subtotal: '80000.00',
      }),
      expect.objectContaining({ variante_id: m.id, cantidad: 5, subtotal: '40000.00' }),
    ]);

    expect(await stockDe(s.id)).toBe(12);
    expect(await stockDe(m.id)).toBe(7);
    expect(await MovimientoFondos.count()).toBe(0);
  });

  it('el costo queda congelado: si después cambia el del producto, el ingreso no cambia', async () => {
    const { agent } = await loginComoAdmin();
    const { producto, variantes } = await remera();

    const res = await agent
      .post('/api/ingresos')
      .send({ items: [{ variante_id: variantes[0].id, cantidad: 1 }] });
    await Producto.update({ costo: '9999.00' }, { where: { id: producto.id } });

    const item = await IngresoItem.findOne({ where: { ingreso_id: res.body.ingreso.id } });
    expect(item.costo_unitario).toBe('8000.00');
  });

  it('sin fecha usa la de hoy en Argentina', async () => {
    const { agent } = await loginComoAdmin();
    const { variantes } = await remera();
    const res = await agent
      .post('/api/ingresos')
      .send({ items: [{ variante_id: variantes[0].id, cantidad: 1 }] });
    expect(res.body.ingreso.fecha).toBe(hoyArgentina());
  });

  it('variante inexistente → 400 y no se guarda nada (ni stock ni ingreso)', async () => {
    const { agent } = await loginComoAdmin();
    const { variantes } = await remera();

    const res = await agent.post('/api/ingresos').send({
      items: [
        { variante_id: variantes[0].id, cantidad: 3 },
        { variante_id: 99999, cantidad: 1 },
      ],
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({
      code: 'VARIANTE_NO_ENCONTRADA',
      details: { variantes: [99999] },
    });
    expect(await stockDe(variantes[0].id)).toBe(2);
    expect(await IngresoMercaderia.count()).toBe(0);
  });

  it('variante repetida → 400 ITEM_DUPLICADO', async () => {
    const { agent } = await loginComoAdmin();
    const { variantes } = await remera();
    const res = await agent.post('/api/ingresos').send({
      items: [
        { variante_id: variantes[0].id, cantidad: 1 },
        { variante_id: variantes[0].id, cantidad: 2 },
      ],
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('ITEM_DUPLICADO');
  });

  it('validaciones: sin ítems, cantidad 0 o decimal, fecha futura o inválida', async () => {
    const { agent } = await loginComoAdmin();
    const { variantes } = await remera();
    const v = variantes[0].id;

    const casos = [
      { items: [] },
      { items: [{ variante_id: v, cantidad: 0 }] },
      { items: [{ variante_id: v, cantidad: 1.5 }] },
      { fecha: '2999-01-01', items: [{ variante_id: v, cantidad: 1 }] },
      { fecha: '10/11/2026', items: [{ variante_id: v, cantidad: 1 }] },
    ];
    for (const body of casos) {
      const res = await agent.post('/api/ingresos').send(body);
      expect(res.status, JSON.stringify(body)).toBe(400);
    }
  });

  it('secretaría no puede cargar mercadería → 403', async () => {
    const { agent } = await loginComoSecretaria();
    const { variantes } = await remera();
    const res = await agent
      .post('/api/ingresos')
      .send({ items: [{ variante_id: variantes[0].id, cantidad: 1 }] });
    expect(res.status).toBe(403);
  });
});
