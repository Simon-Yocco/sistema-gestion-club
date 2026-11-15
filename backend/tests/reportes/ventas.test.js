import { describe, it, expect } from 'vitest';
import { Venta, Pago } from '../../src/models/index.js';
import { loginComoAdmin, loginComoSecretaria } from '../helpers/auth.js';
import { crearProductoConVariantes, crearComprador } from '../helpers/factories.js';

/**
 * Remera $15.000 (costo 8.000) y Short $9.000 (costo 4.500).
 *  v1 05/11: 2 remeras, efectivo 30.000
 *  v2 06/11: remera + short por transferencia 24.000; después devuelve el short (reintegro 9.000)
 *  v3 07/11: short fiado, después anulada
 *  v4 01/12: 1 remera, efectivo 15.000
 */
async function escenario(agent) {
  const remera = await crearProductoConVariantes({
    nombre: 'Remera',
    precio_venta: '15000.00',
    costo: '8000.00',
    colores: ['Azul'],
    talles: ['M'],
    stock: 20,
  });
  const short = await crearProductoConVariantes({
    nombre: 'Short',
    precio_venta: '9000.00',
    costo: '4500.00',
    colores: ['Negro'],
    talles: ['L'],
    stock: 20,
  });
  const R = remera.variantes[0].id;
  const S = short.variantes[0].id;
  const comprador = await crearComprador();
  const vender = async (fecha, items, pagos) => {
    const venta = (
      await agent.post('/api/ventas').send({ comprador_id: comprador.id, items, pagos })
    ).body.venta;
    await Venta.update({ fecha: new Date(fecha) }, { where: { id: venta.id } });
    await Pago.update({ fecha: new Date(fecha) }, { where: { venta_id: venta.id } });
    return venta;
  };

  await vender(
    '2026-11-05T15:00:00Z',
    [{ variante_id: R, cantidad: 2 }],
    [{ medio: 'efectivo', monto: '30000' }],
  );
  const v2 = await vender(
    '2026-11-06T15:00:00Z',
    [
      { variante_id: R, cantidad: 1 },
      { variante_id: S, cantidad: 1 },
    ],
    [{ medio: 'transferencia', monto: '24000' }],
  );
  await agent
    .post(`/api/ventas/${v2.id}/devoluciones`)
    .send({ items: [{ venta_item_id: v2.items[1].id, cantidad: 1 }], motivo: 'Talle' })
    .expect(201);
  await Pago.update({ fecha: new Date('2026-11-06T16:00:00Z') }, { where: { tipo: 'devolucion' } });

  const v3 = await vender('2026-11-07T15:00:00Z', [{ variante_id: S, cantidad: 1 }], []);
  await agent.post(`/api/ventas/${v3.id}/anular`).send({ motivo: 'Error' }).expect(201);

  await vender(
    '2026-12-01T15:00:00Z',
    [{ variante_id: R, cantidad: 1 }],
    [{ medio: 'efectivo', monto: '15000' }],
  );
}

const NOV = '?desde=2026-11-01&hasta=2026-11-30';

describe('reportes de ventas', () => {
  it('11.1 ventas por período: sin unidades devueltas ni ventas anuladas', async () => {
    const { agent } = await loginComoAdmin();
    await escenario(agent);

    const res = await agent.get(`/api/reportes/ventas${NOV}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      periodo: { desde: '2026-11-01', hasta: '2026-11-30' },
      cantidad_ventas: 2,
      unidades: 3,
      total: '45000.00',
    });
    expect(res.body.detalle).toEqual([
      expect.objectContaining({
        producto: 'Remera',
        color: 'Azul',
        talle: 'M',
        unidades: 3,
        total: '45000.00',
      }),
    ]);
    expect(res.body).not.toHaveProperty('csv');

    // 14.6 serie por día (v2 quedó con la remera; v3 anulada no aparece)
    expect(res.body.por_dia).toEqual([
      { dia: '2026-11-05', unidades: 2, total: '30000.00' },
      { dia: '2026-11-06', unidades: 1, total: '15000.00' },
    ]);

    const todo = await agent.get('/api/reportes/ventas');
    expect(todo.body).toMatchObject({ cantidad_ventas: 3, unidades: 4, total: '60000.00' });
  });

  it('11.2 ventas por medio de pago: según los pagos, con reintegros', async () => {
    const { agent } = await loginComoAdmin();
    await escenario(agent);

    const res = await agent.get('/api/reportes/ventas-por-medio');
    expect(res.body).toMatchObject({
      efectivo: { cobrado: '45000.00', reintegrado: '0.00', neto: '45000.00' },
      transferencia: { cobrado: '24000.00', reintegrado: '9000.00', neto: '15000.00' },
      total: { cobrado: '69000.00', reintegrado: '9000.00', neto: '60000.00' },
    });

    // saldo de hoy y deuda con la comisión: no dependen del período
    expect(res.body.saldo_actual).toEqual({
      efectivo: '45000.00',
      transferencia: '15000.00',
      total: '60000.00',
      deuda_comision: '0.00',
    });

    const dic = await agent.get('/api/reportes/ventas-por-medio?desde=2026-12-01');
    expect(dic.body.total.neto).toBe('15000.00');
    expect(dic.body.saldo_actual).toEqual(res.body.saldo_actual);
  });

  it('11.3 ganancia por período, producto y variante, con margen', async () => {
    const { agent } = await loginComoAdmin();
    await escenario(agent);

    const res = await agent.get(`/api/reportes/ganancia${NOV}`);
    expect(res.body).toMatchObject({
      unidades: 3,
      ingresos: '45000.00',
      costo: '24000.00',
      ganancia: '21000.00',
      margen_pct: 46.7,
    });
    expect(res.body.por_producto).toEqual([
      expect.objectContaining({ producto: 'Remera', unidades: 3, ganancia: '21000.00' }),
    ]);
    expect(res.body.por_variante).toHaveLength(1);
    expect(res.body.por_dia.map((d) => [d.dia, d.ganancia])).toEqual([
      ['2026-11-05', '14000.00'],
      ['2026-11-06', '7000.00'],
    ]);
  });

  it('por_dia agrupa por día de Argentina (23:30 del 5 no es el 6)', async () => {
    const { agent } = await loginComoAdmin();
    const { variantes } = await crearProductoConVariantes({ precio_venta: '1000.00', stock: 5 });
    const venta = (
      await agent.post('/api/ventas').send({
        items: [{ variante_id: variantes[0].id, cantidad: 1 }],
        pagos: [{ medio: 'efectivo', monto: '1000' }],
      })
    ).body.venta;
    await Venta.update({ fecha: new Date('2026-11-06T02:30:00Z') }, { where: { id: venta.id } });

    const res = await agent.get('/api/reportes/ventas');
    expect(res.body.por_dia.map((d) => d.dia)).toEqual(['2026-11-05']);
  });

  it('sin ventas: ceros; secretaría → 403; período inválido → 400', async () => {
    const { agent } = await loginComoAdmin();
    expect((await agent.get('/api/reportes/ganancia')).body).toMatchObject({
      ingresos: '0.00',
      margen_pct: null,
      por_producto: [],
    });
    expect((await agent.get('/api/reportes/ventas?desde=2026-12-01&hasta=2026-11-01')).status).toBe(
      400,
    );

    const { agent: secre } = await loginComoSecretaria();
    expect((await secre.get('/api/reportes/ventas')).status).toBe(403);
  });
});
