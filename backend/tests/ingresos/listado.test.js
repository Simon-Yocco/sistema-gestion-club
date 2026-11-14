import { describe, it, expect } from 'vitest';
import { Egreso } from '../../src/models/index.js';
import { loginComoAdmin, loginComoSecretaria } from '../helpers/auth.js';
import { crearProductoConVariantes } from '../helpers/factories.js';

/** Carga 3 ingresos de $10.000 cada uno: sin pagar, pagado a medias y pagado del todo. */
async function escenario(agent, usuarioId) {
  const { variantes } = await crearProductoConVariantes({
    costo: '1000.00',
    colores: ['Azul'],
    talles: ['M'],
  });
  const crear = (fecha, proveedor) =>
    agent
      .post('/api/ingresos')
      .send({ fecha, proveedor, items: [{ variante_id: variantes[0].id, cantidad: 10 }] })
      .then((r) => r.body.ingreso);

  const sinPagar = await crear('2026-11-01', 'A');
  const parcial = await crear('2026-11-05', 'B');
  const pagado = await crear('2026-11-10', 'C');

  const egreso = (ingreso, monto) =>
    Egreso.create({
      fecha: '2026-11-12',
      monto,
      medio: 'transferencia',
      concepto: 'mercaderia',
      ingreso_mercaderia_id: ingreso.id,
      usuario_id: usuarioId,
    });
  await egreso(parcial, '4000.00');
  await egreso(pagado, '6000.00');
  await egreso(pagado, '4000.00');

  return { sinPagar, parcial, pagado };
}

describe('GET /api/ingresos', () => {
  it('lista del más reciente al más viejo, con total, pagado y estado de pago', async () => {
    const { agent, usuario } = await loginComoAdmin();
    await escenario(agent, usuario.id);

    const res = await agent.get('/api/ingresos');

    expect(res.status).toBe(200);
    expect(res.body.ingresos.map((i) => [i.fecha, i.total, i.pagado, i.estado_pago])).toEqual([
      ['2026-11-10', '10000.00', '10000.00', 'pagado'],
      ['2026-11-05', '10000.00', '4000.00', 'parcial'],
      ['2026-11-01', '10000.00', '0.00', 'no_pagado'],
    ]);
    expect(res.body.ingresos[0]).toMatchObject({
      proveedor: 'C',
      unidades: 10,
      usuario: { id: usuario.id },
    });
    expect(res.body.paginacion).toEqual({ pagina: 1, por_pagina: 50, total: 3 });
  });

  it('filtra por estado de pago', async () => {
    const { agent, usuario } = await loginComoAdmin();
    const { sinPagar, parcial, pagado } = await escenario(agent, usuario.id);
    const ids = async (estado) =>
      (await agent.get(`/api/ingresos?estado_pago=${estado}`)).body.ingresos.map((i) => i.id);

    expect(await ids('no_pagado')).toEqual([sinPagar.id]);
    expect(await ids('parcial')).toEqual([parcial.id]);
    expect(await ids('pagado')).toEqual([pagado.id]);
  });

  it('filtra por rango de fechas (inclusive)', async () => {
    const { agent, usuario } = await loginComoAdmin();
    await escenario(agent, usuario.id);

    const res = await agent.get('/api/ingresos?desde=2026-11-05&hasta=2026-11-10');
    expect(res.body.ingresos.map((i) => i.fecha)).toEqual(['2026-11-10', '2026-11-05']);
    expect(res.body.paginacion.total).toBe(2);
  });

  it('pagina', async () => {
    const { agent, usuario } = await loginComoAdmin();
    await escenario(agent, usuario.id);

    const res = await agent.get('/api/ingresos?pagina=2&por_pagina=2');
    expect(res.body.ingresos.map((i) => i.fecha)).toEqual(['2026-11-01']);
    expect(res.body.paginacion).toEqual({ pagina: 2, por_pagina: 2, total: 3 });
  });

  it('rango invertido o estado inválido → 400; secretaría → 403', async () => {
    const { agent } = await loginComoAdmin();
    expect((await agent.get('/api/ingresos?desde=2026-11-10&hasta=2026-11-01')).status).toBe(400);
    expect((await agent.get('/api/ingresos?estado_pago=debe')).status).toBe(400);

    const { agent: secre } = await loginComoSecretaria();
    expect((await secre.get('/api/ingresos')).status).toBe(403);
  });
});
