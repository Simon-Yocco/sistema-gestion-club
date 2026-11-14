// 8.4 Reintegro con pago mixto: por defecto se propone devolver "lo mismo que se cobró",
// empezando por el cobro más reciente; también se puede repartir a mano entre medios.
import { describe, it, expect } from 'vitest';
import * as ventasService from '../../src/modules/ventas/ventas.service.js';
import * as devoluciones from '../../src/modules/devoluciones/devoluciones.service.js';
import { loginComoSecretaria } from '../helpers/auth.js';
import { crearProductoConVariantes, crearComprador } from '../helpers/factories.js';
import { saldos } from '../helpers/fondos.js';

/** Fiado de $40.000 (4 × $10.000) cobrado en varias veces y medios. */
async function ventaCobradaEnPartes(agent) {
  const { variantes } = await crearProductoConVariantes({ precio_venta: '10000.00', stock: 10 });
  const comprador = await crearComprador();
  const venta = (
    await agent.post('/api/ventas').send({
      comprador_id: comprador.id,
      items: [{ variante_id: variantes[0].id, cantidad: 4 }],
      pagos: [{ medio: 'efectivo', monto: '10000' }],
    })
  ).body.venta;
  const cobrar = (pagos) => agent.post(`/api/ventas/${venta.id}/pagos`).send({ pagos }).expect(201);
  await cobrar([{ medio: 'transferencia', monto: '15000' }]);
  await cobrar([{ medio: 'efectivo', monto: '5000' }]);
  // cobrado: efectivo 15.000, transferencia 15.000 → pagado 30.000, deuda 10.000
  return venta;
}

describe('8.4 reintegro con pago mixto', () => {
  it('propuesta por defecto: del último cobro hacia atrás, sin pasarse de lo cobrado por medio', async () => {
    const { agent } = await loginComoSecretaria();
    const venta = await ventaCobradaEnPartes(agent);

    // devuelve 3 de 4 → total 10.000, pagado 30.000 → reintegrar 20.000:
    // último cobro efectivo 5.000, después transferencia 15.000.
    const res = await agent
      .post(`/api/ventas/${venta.id}/devoluciones/previsualizar`)
      .send({ items: [{ venta_item_id: venta.items[0].id, cantidad: 3 }] });

    expect(res.body).toMatchObject({
      a_reintegrar: '20000.00',
      reintegro: [
        { medio: 'efectivo', monto: '5000.00' },
        { medio: 'transferencia', monto: '15000.00' },
      ],
    });
  });

  it('anulación: devuelve exactamente lo cobrado neto en cada medio', async () => {
    const { agent } = await loginComoSecretaria();
    const venta = await ventaCobradaEnPartes(agent);

    const res = await agent.post(`/api/ventas/${venta.id}/anular`).send({ motivo: 'Anulada' });

    expect(res.body.anulacion.reintegro).toEqual([
      { medio: 'efectivo', monto: '15000.00' },
      { medio: 'transferencia', monto: '15000.00' },
    ]);
    expect(await saldos()).toEqual({ efectivo: 0, transferencia: 0 });
  });

  it('reparto manual entre medios', async () => {
    const { agent } = await loginComoSecretaria();
    const venta = await ventaCobradaEnPartes(agent);

    await agent
      .post(`/api/ventas/${venta.id}/anular`)
      .send({
        motivo: 'Anulada',
        reintegro: [
          { medio: 'efectivo', monto: '25000' },
          { medio: 'transferencia', monto: '5000' },
        ],
      })
      .expect(201);

    expect(await saldos()).toEqual({ efectivo: -1000000, transferencia: 1000000 });
  });

  it('concurrencia: anulación y cobro simultáneos no dejan dinero sin devolver', async () => {
    const { agent, usuario } = await loginComoSecretaria();
    const venta = await ventaCobradaEnPartes(agent);

    const resultados = await Promise.allSettled([
      devoluciones.anular(venta.id, { motivo: 'Anulada' }, usuario),
      ventasService.cobrar(venta.id, [{ medio: 'efectivo', monto: 1000000 }], usuario),
    ]);

    // Pase lo que pase primero, al final la venta anulada no retiene dinero.
    expect(resultados[0].status).toBe('fulfilled');
    const final = await ventasService.obtener(venta.id);
    expect(final.estado).toBe('anulada');
    expect(final.pagado).toBe('0.00');
    expect(await saldos()).toEqual({ efectivo: 0, transferencia: 0 });
  });
});
