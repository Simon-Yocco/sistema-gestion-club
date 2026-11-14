import { describe, it, expect } from 'vitest';
import {
  Variante,
  Producto,
  Venta,
  Cambio,
  Pago,
  MovimientoFondos,
} from '../../src/models/index.js';
import { loginComoSecretaria, loginComoAdmin } from '../helpers/auth.js';
import { crearProductoConVariantes, crearComprador } from '../helpers/factories.js';
import { saldos } from '../helpers/fondos.js';

const stockDe = async (id) => (await Variante.findByPk(id)).stock;

/** Remera $15.000 (vendida antes del sistema), Buzo $35.000, Short $9.000, otra remera $15.000. */
async function catalogo() {
  const remera = await crearProductoConVariantes({
    precio_venta: '15000.00',
    costo: '8000.00',
    colores: ['Azul'],
    talles: ['M', 'L'],
    stock: 2,
  });
  const buzo = await crearProductoConVariantes({ precio_venta: '35000.00', stock: 3 });
  const short = await crearProductoConVariantes({ precio_venta: '9000.00', stock: 3 });
  return {
    remera: remera.producto,
    remeraM: remera.variantes[0],
    remeraL: remera.variantes[1],
    buzo: buzo.variantes[0],
    short: short.variantes[0],
  };
}

const cambiar = (agent, body) => agent.post('/api/cambios/sin-venta').send(body);

describe('POST /api/cambios/sin-venta', () => {
  it('diferencia cero: la devuelta entra al stock, se crea venta nueva con crédito, sin dinero', async () => {
    const { agent } = await loginComoSecretaria();
    const cat = await catalogo();

    const res = await cambiar(agent, {
      comprador: { nombre: 'Rosa' },
      variante_devuelta_id: cat.remeraM.id,
      variante_nueva_id: cat.remeraL.id,
      motivo: 'Comprada el año pasado, le quedaba chica',
    });

    expect(res.status).toBe(201);
    expect(res.body.cambio).toMatchObject({
      valor_devuelto: '15000.00',
      valor_nuevo: '15000.00',
      diferencia: '0.00',
      resolucion: 'sin_diferencia',
    });
    const v = res.body.venta;
    expect(v).toMatchObject({
      total: '15000.00',
      pagado: '15000.00',
      deuda: '0.00',
      estado_pago: 'pagada',
      comprador: { nombre: 'Rosa' },
    });
    expect(v.items).toEqual([expect.objectContaining({ talle: 'L', origen: 'cambio' })]);
    expect(v.pagos).toEqual([
      expect.objectContaining({ tipo: 'credito_cambio', medio: null, monto: '15000.00' }),
    ]);
    expect(await stockDe(cat.remeraM.id)).toBe(3);
    expect(await stockDe(cat.remeraL.id)).toBe(1);
    expect(await MovimientoFondos.count()).toBe(0);

    const cambio = await Cambio.findOne();
    expect(cambio).toMatchObject({ venta_id: v.id, venta_item_devuelto_id: null });
  });

  it('la devuelta se valúa al precio ACTUAL', async () => {
    const { agent } = await loginComoSecretaria();
    const cat = await catalogo();
    await Producto.update({ precio_venta: '17000.00' }, { where: { id: cat.remera.id } });

    const res = await cambiar(agent, {
      variante_devuelta_id: cat.remeraM.id,
      variante_nueva_id: cat.buzo.id,
      pagos: [{ medio: 'efectivo', monto: '18000' }],
    });
    expect(res.body.cambio).toMatchObject({ valor_devuelto: '17000.00', diferencia: '18000.00' });
  });

  it('diferencia positiva: se cobra en el momento (puede ser mixto)', async () => {
    const { agent } = await loginComoSecretaria();
    const cat = await catalogo();

    const res = await cambiar(agent, {
      variante_devuelta_id: cat.remeraM.id,
      variante_nueva_id: cat.buzo.id,
      pagos: [
        { medio: 'efectivo', monto: '10000' },
        { medio: 'transferencia', monto: '10000' },
      ],
    });

    expect(res.status).toBe(201);
    expect(res.body.cambio).toMatchObject({ diferencia: '20000.00', resolucion: 'cobro' });
    expect(res.body.venta).toMatchObject({ total: '35000.00', pagado: '35000.00', deuda: '0.00' });
    expect(await saldos()).toEqual({ efectivo: 1000000, transferencia: 1000000 });
    const tipos = (await MovimientoFondos.findAll()).map((m) => m.tipo);
    expect(tipos).toEqual(['cobro_diferencia_cambio', 'cobro_diferencia_cambio']);
  });

  it('diferencia positiva sin cobrar → 400 y no se crea nada', async () => {
    const { agent } = await loginComoSecretaria();
    const cat = await catalogo();

    const res = await cambiar(agent, {
      variante_devuelta_id: cat.remeraM.id,
      variante_nueva_id: cat.buzo.id,
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('COBRO_DIFERENCIA_INCORRECTO');
    expect(await Venta.count()).toBe(0);
    expect(await stockDe(cat.remeraM.id)).toBe(2);
  });

  it('diferencia negativa: se devuelve en el momento (por defecto en efectivo)', async () => {
    const { agent } = await loginComoSecretaria();
    const cat = await catalogo();

    const res = await cambiar(agent, {
      variante_devuelta_id: cat.remeraM.id,
      variante_nueva_id: cat.short.id,
    });

    expect(res.body.cambio).toMatchObject({
      diferencia: '-6000.00',
      resolucion: 'devolucion',
      a_reintegrar: '6000.00',
      reintegro: [{ medio: 'efectivo', monto: '6000.00' }],
    });
    expect(res.body.venta).toMatchObject({ total: '9000.00', pagado: '9000.00', deuda: '0.00' });
    expect(await saldos()).toEqual({ efectivo: -600000, transferencia: 0 });
  });

  it('diferencia negativa devuelta por transferencia', async () => {
    const { agent } = await loginComoSecretaria();
    const cat = await catalogo();
    await cambiar(agent, {
      variante_devuelta_id: cat.remeraM.id,
      variante_nueva_id: cat.short.id,
      reintegro: [{ medio: 'transferencia', monto: '6000' }],
    }).expect(201);
    expect(await saldos()).toEqual({ efectivo: 0, transferencia: -600000 });
  });

  it('el crédito no se cuenta como cobro: la venta nueva sigue funcionando con devoluciones', async () => {
    const { agent } = await loginComoSecretaria();
    const cat = await catalogo();
    const { venta } = (
      await cambiar(agent, {
        comprador_id: (await crearComprador()).id,
        variante_devuelta_id: cat.remeraM.id,
        variante_nueva_id: cat.remeraL.id,
      })
    ).body;

    // Si después devuelve la prenda nueva, se le reintegra el valor (pagó la original).
    const res = await agent
      .post(`/api/ventas/${venta.id}/anular`)
      .send({ motivo: 'Devuelve todo' });
    expect(res.body.anulacion).toMatchObject({
      a_reintegrar: '15000.00',
      reintegro: [{ medio: 'efectivo', monto: '15000.00' }],
    });
    expect(await Pago.count({ where: { tipo: 'credito_cambio' } })).toBe(1);
  });

  it('validaciones: variante devuelta inexistente, nueva sin stock, admin también puede', async () => {
    const { agent } = await loginComoSecretaria();
    const cat = await catalogo();

    const inexistente = await cambiar(agent, {
      variante_devuelta_id: 99999,
      variante_nueva_id: cat.remeraL.id,
    });
    expect(inexistente.body.error.code).toBe('VARIANTE_NO_ENCONTRADA');

    const sinStock = await cambiar(agent, {
      variante_devuelta_id: cat.remeraM.id,
      variante_nueva_id: cat.remeraL.id,
      cantidad_devuelta: 3,
      cantidad_nueva: 3,
    });
    expect(sinStock.body.error.code).toBe('STOCK_INSUFICIENTE');
    expect(await stockDe(cat.remeraM.id)).toBe(2);

    const { agent: admin } = await loginComoAdmin();
    await cambiar(admin, {
      variante_devuelta_id: cat.remeraM.id,
      variante_nueva_id: cat.remeraL.id,
    }).expect(201);
  });
});
