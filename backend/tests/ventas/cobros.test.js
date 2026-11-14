import { describe, it, expect } from 'vitest';
import { Venta, Pago, MovimientoFondos } from '../../src/models/index.js';
import * as ventasService from '../../src/modules/ventas/ventas.service.js';
import { loginComoSecretaria, loginComoAdmin } from '../helpers/auth.js';
import { crearProductoConVariantes, crearComprador } from '../helpers/factories.js';

/** Venta fiada de $30.000 (2 remeras) con $10.000 de entrega: deuda $20.000. */
async function ventaFiada(agent) {
  const { variantes } = await crearProductoConVariantes({ precio_venta: '15000.00', stock: 10 });
  const comprador = await crearComprador();
  const res = await agent.post('/api/ventas').send({
    comprador_id: comprador.id,
    items: [{ variante_id: variantes[0].id, cantidad: 2 }],
    pagos: [{ medio: 'efectivo', monto: '10000' }],
  });
  return res.body.venta;
}

const cobrar = (agent, venta, pagos) => agent.post(`/api/ventas/${venta.id}/pagos`).send({ pagos });

async function movimientosFiado() {
  const movs = await MovimientoFondos.findAll({
    where: { tipo: 'cobro_fiado' },
    order: [['id', 'ASC']],
  });
  return movs.map((m) => [m.medio, m.monto]);
}

describe('POST /api/ventas/:id/pagos (cobro de fiado)', () => {
  it('pago parcial: baja la deuda y genera un movimiento cobro_fiado', async () => {
    const { agent } = await loginComoSecretaria();
    const venta = await ventaFiada(agent);

    const res = await cobrar(agent, venta, [{ medio: 'transferencia', monto: '5000' }]);

    expect(res.status).toBe(201);
    expect(res.body.venta).toMatchObject({
      pagado: '15000.00',
      deuda: '15000.00',
      estado_pago: 'parcial',
    });
    expect(res.body.venta.pagos).toHaveLength(2);
    expect(await movimientosFiado()).toEqual([['transferencia', '5000.00']]);
  });

  it('pago total mixto: la venta queda pagada', async () => {
    const { agent } = await loginComoSecretaria();
    const venta = await ventaFiada(agent);

    const res = await cobrar(agent, venta, [
      { medio: 'efectivo', monto: '12000' },
      { medio: 'transferencia', monto: '8000' },
    ]);

    expect(res.body.venta).toMatchObject({ deuda: '0.00', estado_pago: 'pagada' });
    expect(await movimientosFiado()).toEqual([
      ['efectivo', '12000.00'],
      ['transferencia', '8000.00'],
    ]);
  });

  it('varios cobros parciales hasta cancelar', async () => {
    const { agent } = await loginComoSecretaria();
    const venta = await ventaFiada(agent);
    await cobrar(agent, venta, [{ medio: 'efectivo', monto: '5000' }]).expect(201);
    await cobrar(agent, venta, [{ medio: 'efectivo', monto: '5000' }]).expect(201);
    const res = await cobrar(agent, venta, [{ medio: 'efectivo', monto: '10000' }]);
    expect(res.body.venta.estado_pago).toBe('pagada');
  });

  it('pago que supera la deuda → 400 PAGO_EXCEDE_DEUDA, no se guarda nada', async () => {
    const { agent } = await loginComoSecretaria();
    const venta = await ventaFiada(agent);

    const res = await cobrar(agent, venta, [
      { medio: 'efectivo', monto: '15000' },
      { medio: 'transferencia', monto: '5000.01' },
    ]);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({
      code: 'PAGO_EXCEDE_DEUDA',
      details: { deuda: '20000.00', pagado: '20000.01' },
    });
    expect(await Pago.count()).toBe(1);
    expect(await movimientosFiado()).toEqual([]);
  });

  it('venta sin deuda → 409 VENTA_SIN_DEUDA', async () => {
    const { agent } = await loginComoSecretaria();
    const venta = await ventaFiada(agent);
    await cobrar(agent, venta, [{ medio: 'efectivo', monto: '20000' }]).expect(201);

    const res = await cobrar(agent, venta, [{ medio: 'efectivo', monto: '1' }]);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('VENTA_SIN_DEUDA');
  });

  it('venta anulada → 409 VENTA_ANULADA', async () => {
    const { agent } = await loginComoSecretaria();
    const venta = await ventaFiada(agent);
    await Venta.update({ estado: 'anulada' }, { where: { id: venta.id } });

    const res = await cobrar(agent, venta, [{ medio: 'efectivo', monto: '1000' }]);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('VENTA_ANULADA');
  });

  it('validaciones: sin pagos, monto 0, venta inexistente', async () => {
    const { agent } = await loginComoSecretaria();
    const venta = await ventaFiada(agent);
    expect((await cobrar(agent, venta, [])).status).toBe(400);
    expect((await cobrar(agent, venta, [{ medio: 'efectivo', monto: 0 }])).status).toBe(400);
    expect((await cobrar(agent, { id: 99999 }, [{ medio: 'efectivo', monto: 1 }])).status).toBe(
      404,
    );
  });

  it('concurrencia: dos cobros simultáneos por toda la deuda → solo uno pasa', async () => {
    const { agent, usuario } = await loginComoSecretaria();
    const venta = await ventaFiada(agent);
    const pago = [{ medio: 'efectivo', monto: 2000000 }]; // centavos, como llega al service

    const resultados = await Promise.allSettled([
      ventasService.cobrar(venta.id, pago, usuario),
      ventasService.cobrar(venta.id, pago, usuario),
    ]);

    expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(resultados.find((r) => r.status === 'rejected').reason.code).toBe('VENTA_SIN_DEUDA');
    const final = await ventasService.obtener(venta.id);
    expect(final.deuda).toBe('0.00');
    expect(final.pagado).toBe('30000.00');
  });

  it('el admin también puede cobrar', async () => {
    const { agent } = await loginComoAdmin();
    const venta = await ventaFiada(agent);
    expect((await cobrar(agent, venta, [{ medio: 'efectivo', monto: '1' }])).status).toBe(201);
  });
});
