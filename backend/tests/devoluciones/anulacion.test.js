import { describe, it, expect } from 'vitest';
import { Variante, Devolucion } from '../../src/models/index.js';
import { loginComoSecretaria } from '../helpers/auth.js';
import { crearProductoConVariantes, crearComprador } from '../helpers/factories.js';
import { saldos } from '../helpers/fondos.js';

const stockDe = async (id) => (await Variante.findByPk(id)).stock;

/** Venta de 2 prendas de $15.000 + 1 de $9.000 = $39.000. */
async function vender(agent, pagos) {
  const a = await crearProductoConVariantes({ precio_venta: '15000.00', stock: 5 });
  const b = await crearProductoConVariantes({ precio_venta: '9000.00', stock: 5 });
  const comprador = await crearComprador();
  const venta = (
    await agent.post('/api/ventas').send({
      comprador_id: comprador.id,
      items: [
        { variante_id: a.variantes[0].id, cantidad: 2 },
        { variante_id: b.variantes[0].id, cantidad: 1 },
      ],
      pagos,
    })
  ).body.venta;
  return { venta, varA: a.variantes[0], varB: b.variantes[0] };
}

const anular = (agent, venta, body) => agent.post(`/api/ventas/${venta.id}/anular`).send(body);

describe('POST /api/ventas/:id/anular', () => {
  it('venta pagada mixta: repone todo el stock, devuelve lo cobrado en cada medio y la marca anulada', async () => {
    const { agent, usuario } = await loginComoSecretaria();
    const { venta, varA, varB } = await vender(agent, [
      { medio: 'efectivo', monto: '30000' },
      { medio: 'transferencia', monto: '9000' },
    ]);

    const res = await anular(agent, venta, { motivo: 'Error al cargar la venta' });

    expect(res.status).toBe(201);
    expect(res.body.anulacion).toMatchObject({
      total_nuevo: '0.00',
      a_reintegrar: '39000.00',
      reintegro: [
        { medio: 'efectivo', monto: '30000.00' },
        { medio: 'transferencia', monto: '9000.00' },
      ],
    });
    expect(res.body.venta).toMatchObject({
      estado: 'anulada',
      motivo_anulacion: 'Error al cargar la venta',
      anulada_por: { id: usuario.id },
      total: '0.00',
      pagado: '0.00',
      deuda: '0.00',
    });
    expect(res.body.venta.anulada_at).toMatch(/^\d{4}-/);
    expect(res.body.venta.devoluciones).toEqual([
      expect.objectContaining({ tipo: 'anulacion', motivo: 'Error al cargar la venta' }),
    ]);
    expect(await stockDe(varA.id)).toBe(5);
    expect(await stockDe(varB.id)).toBe(5);
    expect(await saldos()).toEqual({ efectivo: 0, transferencia: 0 });
  });

  it('venta fiada sin pagos: se anula la deuda, no sale dinero', async () => {
    const { agent } = await loginComoSecretaria();
    const { venta } = await vender(agent, []);

    const res = await anular(agent, venta, { motivo: 'Se arrepintió' });

    expect(res.body.anulacion).toMatchObject({ a_reintegrar: '0.00', reintegro: [] });
    expect(res.body.venta).toMatchObject({ estado: 'anulada', deuda: '0.00' });
    expect(await saldos()).toEqual({ efectivo: 0, transferencia: 0 });
  });

  it('después de una devolución parcial, anula solo lo que quedaba', async () => {
    const { agent } = await loginComoSecretaria();
    const { venta, varA } = await vender(agent, [{ medio: 'efectivo', monto: '39000' }]);
    await agent
      .post(`/api/ventas/${venta.id}/devoluciones`)
      .send({ items: [{ venta_item_id: venta.items[0].id, cantidad: 1 }], motivo: 'Talle' })
      .expect(201);

    const res = await anular(agent, venta, { motivo: 'Devuelve todo' });

    expect(res.body.anulacion).toMatchObject({
      total_actual: '24000.00',
      a_reintegrar: '24000.00',
    });
    expect(await stockDe(varA.id)).toBe(5);
    expect(await saldos()).toEqual({ efectivo: 0, transferencia: 0 });
  });

  it('una venta anulada no admite pagos, devoluciones ni otra anulación', async () => {
    const { agent } = await loginComoSecretaria();
    const { venta } = await vender(agent, []);
    await anular(agent, venta, { motivo: 'Error' }).expect(201);

    const pago = await agent
      .post(`/api/ventas/${venta.id}/pagos`)
      .send({ pagos: [{ medio: 'efectivo', monto: '1' }] });
    const devolucion = await agent
      .post(`/api/ventas/${venta.id}/devoluciones`)
      .send({ items: [{ venta_item_id: venta.items[0].id, cantidad: 1 }], motivo: 'X motivo' });
    const otra = await anular(agent, venta, { motivo: 'Otra vez' });

    for (const res of [pago, devolucion, otra]) {
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('VENTA_ANULADA');
    }
    expect(await Devolucion.count()).toBe(1);
  });

  it('motivo obligatorio y reintegro que no coincide → 400', async () => {
    const { agent } = await loginComoSecretaria();
    const { venta } = await vender(agent, [{ medio: 'efectivo', monto: '39000' }]);

    expect((await anular(agent, venta, {})).status).toBe(400);
    const res = await anular(agent, venta, {
      motivo: 'Error',
      reintegro: [{ medio: 'efectivo', monto: '1000' }],
    });
    expect(res.body.error.code).toBe('REINTEGRO_NO_COINCIDE');
  });

  it('previsualizar muestra lo que se va a devolver sin anular', async () => {
    const { agent } = await loginComoSecretaria();
    const { venta } = await vender(agent, [{ medio: 'efectivo', monto: '20000' }]);

    const res = await agent.post(`/api/ventas/${venta.id}/anular/previsualizar`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      total_actual: '39000.00',
      total_nuevo: '0.00',
      a_reintegrar: '20000.00',
      reintegro: [{ medio: 'efectivo', monto: '20000.00' }],
    });
    const sigue = (await agent.get(`/api/ventas/${venta.id}`)).body.venta;
    expect(sigue.estado).toBe('activa');
  });
});
