import { describe, it, expect } from 'vitest';
import { Venta } from '../../src/models/index.js';
import { loginComoSecretaria, loginComo } from '../helpers/auth.js';
import { crearProductoConVariantes, crearComprador } from '../helpers/factories.js';

/**
 * Tres ventas de una remera de $15.000:
 *  A pagada   — 10/11 23:30 hora Argentina (11/11 02:30 UTC)
 *  B parcial  — 11/11 10:00 hora Argentina, comprador Ana
 *  C pendiente— 12/11 00:30 hora Argentina, comprador Ana, anulada después
 */
async function escenario(agent) {
  const { variantes } = await crearProductoConVariantes({ precio_venta: '15000.00', stock: 10 });
  const ana = await crearComprador({ nombre: 'Ana', numero_socio: '10' });
  const item = [{ variante_id: variantes[0].id, cantidad: 1 }];
  const vender = (body) =>
    agent
      .post('/api/ventas')
      .send(body)
      .then((r) => r.body.venta);

  const a = await vender({ items: item, pagos: [{ medio: 'efectivo', monto: '15000' }] });
  const b = await vender({
    comprador_id: ana.id,
    items: item,
    pagos: [{ medio: 'efectivo', monto: '5000' }],
  });
  const c = await vender({ comprador_id: ana.id, items: item });

  await Venta.update({ fecha: new Date('2026-11-11T02:30:00Z') }, { where: { id: a.id } });
  await Venta.update({ fecha: new Date('2026-11-11T13:00:00Z') }, { where: { id: b.id } });
  await Venta.update(
    { fecha: new Date('2026-11-12T03:30:00Z'), estado: 'anulada' },
    { where: { id: c.id } },
  );
  return { a, b, c, ana };
}

const ids = (res) => res.body.ventas.map((v) => v.id);

describe('GET /api/ventas', () => {
  it('lista de la más reciente a la más vieja con totales y estado de pago calculados', async () => {
    const { agent, usuario } = await loginComoSecretaria();
    const { a, b, c, ana } = await escenario(agent);

    const res = await agent.get('/api/ventas');

    expect(res.status).toBe(200);
    expect(ids(res)).toEqual([c.id, b.id, a.id]);
    expect(res.body.ventas[1]).toMatchObject({
      fecha: '2026-11-11T13:00:00.000Z',
      estado: 'activa',
      comprador: { id: ana.id, nombre: 'Ana' },
      usuario: { id: usuario.id },
      unidades: 1,
      total: '15000.00',
      pagado: '5000.00',
      deuda: '10000.00',
      estado_pago: 'parcial',
    });
    expect(res.body.ventas[2]).toMatchObject({ comprador: null, estado_pago: 'pagada' });
    expect(res.body.paginacion).toEqual({ pagina: 1, por_pagina: 50, total: 3 });
  });

  it('el filtro de fechas usa el día en hora de Argentina', async () => {
    const { agent } = await loginComoSecretaria();
    const { a, b, c } = await escenario(agent);

    // A es del 10/11 en Argentina aunque en UTC ya sea 11/11
    expect(ids(await agent.get('/api/ventas?desde=2026-11-10&hasta=2026-11-10'))).toEqual([a.id]);
    expect(ids(await agent.get('/api/ventas?desde=2026-11-11&hasta=2026-11-11'))).toEqual([b.id]);
    expect(ids(await agent.get('/api/ventas?desde=2026-11-12'))).toEqual([c.id]);
  });

  it('filtra por estado, estado de pago, comprador y usuario', async () => {
    const { agent } = await loginComoSecretaria();
    const { a, b, c, ana } = await escenario(agent);

    expect(ids(await agent.get('/api/ventas?estado=anulada'))).toEqual([c.id]);
    expect(ids(await agent.get('/api/ventas?estado=activa'))).toEqual([b.id, a.id]);
    expect(ids(await agent.get('/api/ventas?estado_pago=pagada'))).toEqual([a.id]);
    expect(ids(await agent.get('/api/ventas?estado_pago=parcial'))).toEqual([b.id]);
    expect(ids(await agent.get('/api/ventas?estado_pago=pendiente'))).toEqual([c.id]);
    expect(ids(await agent.get(`/api/ventas?comprador_id=${ana.id}`))).toEqual([c.id, b.id]);

    const { agent: otra, usuario: otraUsuaria } = await loginComo({ rol: 'secretaria' });
    const { variantes } = await crearProductoConVariantes();
    const d = (
      await otra.post('/api/ventas').send({
        items: [{ variante_id: variantes[0].id, cantidad: 1 }],
        pagos: [{ medio: 'efectivo', monto: '15000' }],
      })
    ).body.venta;
    expect(ids(await agent.get(`/api/ventas?usuario_id=${otraUsuaria.id}`))).toEqual([d.id]);
  });

  it('pagina', async () => {
    const { agent } = await loginComoSecretaria();
    const { a } = await escenario(agent);
    const res = await agent.get('/api/ventas?pagina=2&por_pagina=2');
    expect(ids(res)).toEqual([a.id]);
    expect(res.body.paginacion.total).toBe(3);
  });

  it('filtros inválidos → 400', async () => {
    const { agent } = await loginComoSecretaria();
    expect((await agent.get('/api/ventas?estado_pago=debe')).status).toBe(400);
    expect((await agent.get('/api/ventas?desde=2026-11-12&hasta=2026-11-01')).status).toBe(400);
  });
});
