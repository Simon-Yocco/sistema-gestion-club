import { describe, it, expect } from 'vitest';
import { Variante, Venta, Cambio, VentaItem } from '../../src/models/index.js';
import { resolverDiferencia } from '../../src/modules/cambios/cambios.service.js';
import { loginComoSecretaria } from '../helpers/auth.js';
import { crearProductoConVariantes, crearComprador } from '../helpers/factories.js';
import { saldos } from '../helpers/fondos.js';

const stockDe = async (id) => (await Variante.findByPk(id)).stock;

/** Remera $15.000 (M y L), Buzo $35.000, Short $9.000; stock 5 de cada una. */
async function catalogo() {
  const remera = await crearProductoConVariantes({
    precio_venta: '15000.00',
    colores: ['Azul'],
    talles: ['M', 'L'],
    stock: 5,
  });
  const buzo = await crearProductoConVariantes({ precio_venta: '35000.00', stock: 5 });
  const short = await crearProductoConVariantes({ precio_venta: '9000.00', stock: 5 });
  return {
    remeraM: remera.variantes[0],
    remeraL: remera.variantes[1],
    buzo: buzo.variantes[0],
    short: short.variantes[0],
  };
}

/** Vende 1 remera M con los pagos indicados (sin pagos = fiado). */
async function venderRemera(agent, cat, pagos = []) {
  const comprador = await crearComprador();
  const venta = (
    await agent.post('/api/ventas').send({
      comprador_id: comprador.id,
      items: [{ variante_id: cat.remeraM.id, cantidad: 1 }],
      pagos,
    })
  ).body.venta;
  return { venta, item: venta.items[0] };
}

const cambiar = (agent, venta, body) => agent.post(`/api/ventas/${venta.id}/cambios`).send(body);

describe('POST /api/ventas/:id/cambios (cambio con venta registrada)', () => {
  it('mismo precio (otro talle): sin diferencia, stock se mueve, no hay dinero', async () => {
    const { agent } = await loginComoSecretaria();
    const cat = await catalogo();
    const { venta, item } = await venderRemera(agent, cat, [{ medio: 'efectivo', monto: '15000' }]);

    const res = await cambiar(agent, venta, {
      venta_item_id: item.id,
      variante_nueva_id: cat.remeraL.id,
      motivo: 'Le quedaba chica',
    });

    expect(res.status).toBe(201);
    expect(res.body.cambio).toMatchObject({
      valor_devuelto: '15000.00',
      valor_nuevo: '15000.00',
      diferencia: '0.00',
      resolucion: 'sin_diferencia',
      a_cobrar: '0.00',
      a_reintegrar: '0.00',
    });
    expect(res.body.venta).toMatchObject({ total: '15000.00', deuda: '0.00' });
    expect(res.body.venta.items.map((i) => [i.talle, i.cantidad_vigente, i.origen])).toEqual([
      ['M', 0, 'venta'],
      ['L', 1, 'cambio'],
    ]);
    expect(await stockDe(cat.remeraM.id)).toBe(5);
    expect(await stockDe(cat.remeraL.id)).toBe(4);
    expect(await saldos()).toEqual({ efectivo: 1500000, transferencia: 0 });
  });

  it('más cara en venta pagada: se cobra la diferencia (puede ser mixta)', async () => {
    const { agent } = await loginComoSecretaria();
    const cat = await catalogo();
    const { venta, item } = await venderRemera(agent, cat, [{ medio: 'efectivo', monto: '15000' }]);

    const res = await cambiar(agent, venta, {
      venta_item_id: item.id,
      variante_nueva_id: cat.buzo.id,
      pagos: [
        { medio: 'efectivo', monto: '5000' },
        { medio: 'transferencia', monto: '15000' },
      ],
    });

    expect(res.status).toBe(201);
    expect(res.body.cambio).toMatchObject({
      diferencia: '20000.00',
      resolucion: 'cobro',
      a_cobrar: '20000.00',
    });
    expect(res.body.venta).toMatchObject({ total: '35000.00', pagado: '35000.00', deuda: '0.00' });
    expect(await saldos()).toEqual({ efectivo: 2000000, transferencia: 1500000 });
  });

  it('más cara en venta pagada sin cobrar la diferencia → 400 y no se guarda nada', async () => {
    const { agent } = await loginComoSecretaria();
    const cat = await catalogo();
    const { venta, item } = await venderRemera(agent, cat, [{ medio: 'efectivo', monto: '15000' }]);

    const res = await cambiar(agent, venta, {
      venta_item_id: item.id,
      variante_nueva_id: cat.buzo.id,
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({
      code: 'COBRO_DIFERENCIA_INCORRECTO',
      details: { a_cobrar: '20000.00', pagado: '0.00' },
    });
    expect(await Cambio.count()).toBe(0);
    expect(await stockDe(cat.buzo.id)).toBe(5);
    expect(await stockDe(cat.remeraM.id)).toBe(4);
  });

  it('más barata en venta pagada: se devuelve la diferencia', async () => {
    const { agent } = await loginComoSecretaria();
    const cat = await catalogo();
    const { venta, item } = await venderRemera(agent, cat, [
      { medio: 'transferencia', monto: '15000' },
    ]);

    const res = await cambiar(agent, venta, {
      venta_item_id: item.id,
      variante_nueva_id: cat.short.id,
    });

    expect(res.body.cambio).toMatchObject({
      diferencia: '-6000.00',
      resolucion: 'devolucion',
      a_reintegrar: '6000.00',
      reintegro: [{ medio: 'transferencia', monto: '6000.00' }],
    });
    expect(res.body.venta).toMatchObject({ total: '9000.00', pagado: '9000.00', deuda: '0.00' });
    expect(await saldos()).toEqual({ efectivo: 0, transferencia: 900000 });
  });

  it('más cara en venta fiada: la diferencia sube la deuda, no hay dinero', async () => {
    const { agent } = await loginComoSecretaria();
    const cat = await catalogo();
    const { venta, item } = await venderRemera(agent, cat, []);

    const res = await cambiar(agent, venta, {
      venta_item_id: item.id,
      variante_nueva_id: cat.buzo.id,
    });

    expect(res.body.cambio).toMatchObject({
      diferencia: '20000.00',
      resolucion: 'ajuste_deuda',
      deuda_resultante: '35000.00',
    });
    expect(res.body.venta.deuda).toBe('35000.00');
    expect(await saldos()).toEqual({ efectivo: 0, transferencia: 0 });
  });

  it('más barata en venta fiada: la diferencia baja la deuda', async () => {
    const { agent } = await loginComoSecretaria();
    const cat = await catalogo();
    const { venta, item } = await venderRemera(agent, cat, [{ medio: 'efectivo', monto: '5000' }]);

    const res = await cambiar(agent, venta, {
      venta_item_id: item.id,
      variante_nueva_id: cat.short.id,
    });

    expect(res.body.cambio).toMatchObject({
      resolucion: 'ajuste_deuda',
      deuda_resultante: '4000.00',
    });
    expect(await saldos()).toEqual({ efectivo: 500000, transferencia: 0 });
  });

  it('más barata en venta fiada cuya deuda quedaría negativa: se devuelve el excedente', async () => {
    const { agent } = await loginComoSecretaria();
    const cat = await catalogo();
    // pagó 12.000 de 15.000 (debe 3.000); cambia por short de 9.000 → pagó 3.000 de más
    const { venta, item } = await venderRemera(agent, cat, [{ medio: 'efectivo', monto: '12000' }]);

    const res = await cambiar(agent, venta, {
      venta_item_id: item.id,
      variante_nueva_id: cat.short.id,
    });

    expect(res.body.cambio).toMatchObject({
      diferencia: '-6000.00',
      resolucion: 'devolucion',
      a_reintegrar: '3000.00',
      deuda_resultante: '0.00',
    });
    expect(res.body.venta).toMatchObject({ total: '9000.00', pagado: '9000.00', deuda: '0.00' });
    expect(await saldos()).toEqual({ efectivo: 900000, transferencia: 0 });
  });

  it('cobrar cuando no corresponde → 400 COBRO_NO_CORRESPONDE', async () => {
    const { agent } = await loginComoSecretaria();
    const cat = await catalogo();
    const { venta, item } = await venderRemera(agent, cat, []);
    const res = await cambiar(agent, venta, {
      venta_item_id: item.id,
      variante_nueva_id: cat.buzo.id,
      pagos: [{ medio: 'efectivo', monto: '20000' }],
    });
    expect(res.body.error.code).toBe('COBRO_NO_CORRESPONDE');
  });

  it('sin stock de la prenda nueva → 409 y se revierte todo', async () => {
    const { agent } = await loginComoSecretaria();
    const cat = await catalogo();
    const { venta, item } = await venderRemera(agent, cat, [{ medio: 'efectivo', monto: '15000' }]);
    await Variante.update({ stock: 0 }, { where: { id: cat.remeraL.id } });

    const res = await cambiar(agent, venta, {
      venta_item_id: item.id,
      variante_nueva_id: cat.remeraL.id,
    });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('STOCK_INSUFICIENTE');
    expect(await stockDe(cat.remeraM.id)).toBe(4);
    expect((await VentaItem.findByPk(item.id)).cantidad_devuelta).toBe(0);
    expect(await Cambio.count()).toBe(0);
  });

  it('validaciones: venta anulada, ítem ajeno, ya cambiado, variante inactiva', async () => {
    const { agent } = await loginComoSecretaria();
    const cat = await catalogo();
    const { venta, item } = await venderRemera(agent, cat, []);
    const otra = await venderRemera(agent, cat, []);

    const ajeno = await cambiar(agent, venta, {
      venta_item_id: otra.item.id,
      variante_nueva_id: cat.remeraL.id,
    });
    expect(ajeno.body.error.code).toBe('ITEM_NO_PERTENECE_A_VENTA');

    await cambiar(agent, venta, {
      venta_item_id: item.id,
      variante_nueva_id: cat.remeraL.id,
    }).expect(201);
    const yaCambiado = await cambiar(agent, venta, {
      venta_item_id: item.id,
      variante_nueva_id: cat.remeraL.id,
    });
    expect(yaCambiado.body.error.code).toBe('CANTIDAD_DEVUELTA_EXCEDE');

    await Variante.update({ activo: false }, { where: { id: cat.short.id } });
    const inactiva = await cambiar(agent, otra.venta, {
      venta_item_id: otra.item.id,
      variante_nueva_id: cat.short.id,
    });
    expect(inactiva.body.error.code).toBe('VARIANTE_INACTIVA');

    await Venta.update({ estado: 'anulada' }, { where: { id: otra.venta.id } });
    const anulada = await cambiar(agent, otra.venta, {
      venta_item_id: otra.item.id,
      variante_nueva_id: cat.remeraL.id,
    });
    expect(anulada.body.error.code).toBe('VENTA_ANULADA');
  });

  it('previsualizar muestra la diferencia y qué hacer, sin guardar', async () => {
    const { agent } = await loginComoSecretaria();
    const cat = await catalogo();
    const { venta, item } = await venderRemera(agent, cat, [{ medio: 'efectivo', monto: '15000' }]);

    const res = await agent
      .post(`/api/ventas/${venta.id}/cambios/previsualizar`)
      .send({ venta_item_id: item.id, variante_nueva_id: cat.short.id });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      diferencia: '-6000.00',
      resolucion: 'devolucion',
      a_reintegrar: '6000.00',
      reintegro: [{ medio: 'efectivo', monto: '6000.00' }],
    });
    expect(await Cambio.count()).toBe(0);
  });
});

describe('resolverDiferencia', () => {
  it.each([
    // deudaAntes, diferencia → resolucion, a_cobrar, a_reintegrar, deuda_resultante
    [0, 0, 'sin_diferencia', 0, 0, 0],
    [0, 500, 'cobro', 500, 0, 0],
    [0, -500, 'devolucion', 0, 500, 0],
    [1000, 500, 'ajuste_deuda', 0, 0, 1500],
    [1000, -400, 'ajuste_deuda', 0, 0, 600],
    [1000, -1000, 'ajuste_deuda', 0, 0, 0],
    [1000, -1500, 'devolucion', 0, 500, 0],
    [1000, 0, 'sin_diferencia', 0, 0, 1000],
  ])('deuda %i, diferencia %i → %s', (deuda, dif, resolucion, cobrar, reintegrar, resultante) => {
    expect(resolverDiferencia(deuda, dif)).toEqual({
      resolucion,
      a_cobrar: cobrar,
      a_reintegrar: reintegrar,
      deuda_resultante: resultante,
    });
  });
});
