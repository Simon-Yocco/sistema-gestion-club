import { describe, it, expect } from 'vitest';
import { Variante, Venta, Devolucion, Pago } from '../../src/models/index.js';
import { loginComoSecretaria } from '../helpers/auth.js';
import { crearProductoConVariantes, crearComprador } from '../helpers/factories.js';
import { saldos } from '../helpers/fondos.js';

const stockDe = async (id) => (await Variante.findByPk(id)).stock;

/** Venta de 2 remeras ($15.000) + 1 short ($9.000) = $39.000, con los pagos indicados. */
async function vender(agent, pagos) {
  const remera = await crearProductoConVariantes({
    precio_venta: '15000.00',
    stock: 5,
  });
  const short = await crearProductoConVariantes({
    precio_venta: '9000.00',
    stock: 5,
  });
  const comprador = await crearComprador();
  const venta = (
    await agent.post('/api/ventas').send({
      comprador_id: comprador.id,
      items: [
        { variante_id: remera.variantes[0].id, cantidad: 2 },
        { variante_id: short.variantes[0].id, cantidad: 1 },
      ],
      pagos,
    })
  ).body.venta;
  return {
    venta,
    remeraItem: venta.items[0],
    shortItem: venta.items[1],
    remera: remera.variantes[0],
  };
}

const devolver = (agent, venta, body) =>
  agent.post(`/api/ventas/${venta.id}/devoluciones`).send(body);

describe('POST /api/ventas/:id/devoluciones (devolución parcial)', () => {
  it('venta pagada: repone stock, baja el total y devuelve el dinero en el medio cobrado', async () => {
    const { agent } = await loginComoSecretaria();
    const { venta, remeraItem, remera } = await vender(agent, [
      { medio: 'efectivo', monto: '39000' },
    ]);

    const res = await devolver(agent, venta, {
      items: [{ venta_item_id: remeraItem.id, cantidad: 1 }],
      motivo: 'No le quedaba bien',
    });

    expect(res.status).toBe(201);
    expect(res.body.devolucion).toMatchObject({
      total_actual: '39000.00',
      total_nuevo: '24000.00',
      a_reintegrar: '15000.00',
      deuda_resultante: '0.00',
      reintegro: [{ medio: 'efectivo', monto: '15000.00' }],
    });
    expect(res.body.venta).toMatchObject({
      total: '24000.00',
      pagado: '24000.00',
      deuda: '0.00',
      estado: 'activa',
    });
    expect(res.body.venta.items[0]).toMatchObject({ cantidad_devuelta: 1, cantidad_vigente: 1 });
    expect(res.body.venta.devoluciones).toEqual([
      expect.objectContaining({
        tipo: 'devolucion',
        motivo: 'No le quedaba bien',
        items: [{ venta_item_id: remeraItem.id, cantidad: 1 }],
      }),
    ]);
    expect(await stockDe(remera.id)).toBe(4); // 5 − 2 vendidas + 1 devuelta
    expect(await saldos()).toEqual({ efectivo: 2400000, transferencia: 0 });
  });

  it('venta fiada (sin pagos): solo baja la deuda, no sale dinero', async () => {
    const { agent } = await loginComoSecretaria();
    const { venta, shortItem } = await vender(agent, []);

    const res = await devolver(agent, venta, {
      items: [{ venta_item_id: shortItem.id, cantidad: 1 }],
      motivo: 'Cambió de idea',
    });

    expect(res.body.devolucion).toMatchObject({ a_reintegrar: '0.00', reintegro: [] });
    expect(res.body.venta).toMatchObject({ total: '30000.00', deuda: '30000.00' });
    expect(await Pago.count({ where: { tipo: 'devolucion' } })).toBe(0);
    expect(await saldos()).toEqual({ efectivo: 0, transferencia: 0 });
  });

  it('parcialmente pagada: primero baja la deuda y solo se devuelve el excedente', async () => {
    const { agent } = await loginComoSecretaria();
    // pagó $30.000 de $39.000 (debe $9.000); devuelve 2 remeras ($30.000) → total $9.000
    const { venta, remeraItem } = await vender(agent, [
      { medio: 'efectivo', monto: '20000' },
      { medio: 'transferencia', monto: '10000' },
    ]);

    const res = await devolver(agent, venta, {
      items: [{ venta_item_id: remeraItem.id, cantidad: 2 }],
      motivo: 'Fallada',
    });

    expect(res.body.devolucion).toMatchObject({
      total_nuevo: '9000.00',
      a_reintegrar: '21000.00',
      // del último cobro (transferencia) primero, el resto en efectivo
      reintegro: [
        { medio: 'efectivo', monto: '11000.00' },
        { medio: 'transferencia', monto: '10000.00' },
      ],
    });
    expect(res.body.venta).toMatchObject({ total: '9000.00', pagado: '9000.00', deuda: '0.00' });
    expect(await saldos()).toEqual({ efectivo: 900000, transferencia: 0 });
  });

  it('parcialmente pagada: si lo pagado no supera el nuevo total, no sale dinero', async () => {
    const { agent } = await loginComoSecretaria();
    const { venta, shortItem } = await vender(agent, [{ medio: 'efectivo', monto: '10000' }]);

    const res = await devolver(agent, venta, {
      items: [{ venta_item_id: shortItem.id, cantidad: 1 }],
      motivo: 'No lo quiso',
    });
    expect(res.body.devolucion).toMatchObject({
      a_reintegrar: '0.00',
      deuda_resultante: '20000.00',
    });
  });

  it('el reintegro se puede indicar en otro medio o repartido (si suma exacto)', async () => {
    const { agent } = await loginComoSecretaria();
    const { venta, remeraItem } = await vender(agent, [{ medio: 'efectivo', monto: '39000' }]);

    const mal = await devolver(agent, venta, {
      items: [{ venta_item_id: remeraItem.id, cantidad: 1 }],
      motivo: 'Talle',
      reintegro: [{ medio: 'transferencia', monto: '10000' }],
    });
    expect(mal.status).toBe(400);
    expect(mal.body.error.code).toBe('REINTEGRO_NO_COINCIDE');

    const bien = await devolver(agent, venta, {
      items: [{ venta_item_id: remeraItem.id, cantidad: 1 }],
      motivo: 'Talle',
      reintegro: [
        { medio: 'transferencia', monto: '10000' },
        { medio: 'efectivo', monto: '5000' },
      ],
    });
    expect(bien.status).toBe(201);
    expect(await saldos()).toEqual({ efectivo: 3400000, transferencia: -1000000 });
  });

  it('no se puede devolver más de lo vendido no devuelto (acumulando devoluciones)', async () => {
    const { agent } = await loginComoSecretaria();
    const { venta, remeraItem } = await vender(agent, []);
    await devolver(agent, venta, {
      items: [{ venta_item_id: remeraItem.id, cantidad: 1 }],
      motivo: 'Primera',
    }).expect(201);

    const res = await devolver(agent, venta, {
      items: [{ venta_item_id: remeraItem.id, cantidad: 2 }],
      motivo: 'Segunda',
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({
      code: 'CANTIDAD_DEVUELTA_EXCEDE',
      details: { disponible: 1, solicitado: 2 },
    });
    expect(await Devolucion.count()).toBe(1);
  });

  it('validaciones: motivo obligatorio, ítem de otra venta, repetido, venta anulada', async () => {
    const { agent } = await loginComoSecretaria();
    const { venta, remeraItem } = await vender(agent, []);
    const otra = await vender(agent, []);
    const item = { venta_item_id: remeraItem.id, cantidad: 1 };

    expect((await devolver(agent, venta, { items: [item] })).status).toBe(400);
    expect((await devolver(agent, venta, { items: [item], motivo: '  ' })).status).toBe(400);

    const ajeno = await devolver(agent, venta, {
      items: [{ venta_item_id: otra.remeraItem.id, cantidad: 1 }],
      motivo: 'X motivo',
    });
    expect(ajeno.body.error.code).toBe('ITEM_NO_PERTENECE_A_VENTA');

    const repetido = await devolver(agent, venta, { items: [item, item], motivo: 'X motivo' });
    expect(repetido.body.error.code).toBe('ITEM_DUPLICADO');

    await Venta.update({ estado: 'anulada' }, { where: { id: venta.id } });
    const anulada = await devolver(agent, venta, { items: [item], motivo: 'X motivo' });
    expect(anulada.status).toBe(409);
    expect(anulada.body.error.code).toBe('VENTA_ANULADA');
  });
});

describe('POST /api/ventas/:id/devoluciones/previsualizar', () => {
  it('calcula sin guardar nada', async () => {
    const { agent } = await loginComoSecretaria();
    const { venta, remeraItem, remera } = await vender(agent, [
      { medio: 'transferencia', monto: '39000' },
    ]);

    const res = await agent
      .post(`/api/ventas/${venta.id}/devoluciones/previsualizar`)
      .send({ items: [{ venta_item_id: remeraItem.id, cantidad: 2 }] });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      total_actual: '39000.00',
      total_nuevo: '9000.00',
      pagado: '39000.00',
      a_reintegrar: '30000.00',
      deuda_resultante: '0.00',
      reintegro: [{ medio: 'transferencia', monto: '30000.00' }],
    });
    expect(await Devolucion.count()).toBe(0);
    expect(await stockDe(remera.id)).toBe(3);
  });
});
