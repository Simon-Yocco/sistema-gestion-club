import { describe, it, expect } from 'vitest';
import { Venta } from '../../src/models/index.js';
import { loginComoSecretaria } from '../helpers/auth.js';
import { crearProductoConVariantes, crearComprador } from '../helpers/factories.js';

const DIA = 24 * 60 * 60 * 1000;

describe('GET /api/compradores/:id/cuenta', () => {
  it('ventas activas del comprador: primero las impagas (más viejas primero), con su deuda', async () => {
    const { agent } = await loginComoSecretaria();
    const { variantes } = await crearProductoConVariantes({ precio_venta: '5000.00', stock: 50 });
    const ana = await crearComprador({ nombre: 'Ana', apodo: 'Anita' });
    const otro = await crearComprador();
    const vender = async (comprador, cantidad, pagado, dias) => {
      const venta = (
        await agent.post('/api/ventas').send({
          comprador_id: comprador.id,
          items: [{ variante_id: variantes[0].id, cantidad }],
          pagos: pagado ? [{ medio: 'efectivo', monto: pagado }] : [],
        })
      ).body.venta;
      await Venta.update({ fecha: new Date(Date.now() - dias * DIA) }, { where: { id: venta.id } });
      return venta;
    };

    const pagada = await vender(ana, 1, '5000', 40);
    const vieja = await vender(ana, 2, null, 20);
    const nueva = await vender(ana, 3, '5000', 5);
    const anulada = await vender(ana, 1, null, 1);
    await Venta.update({ estado: 'anulada' }, { where: { id: anulada.id } });
    await vender(otro, 1, null, 3);

    const res = await agent.get(`/api/compradores/${ana.id}/cuenta`);

    expect(res.status).toBe(200);
    expect(res.body.comprador).toMatchObject({ id: ana.id, etiqueta: 'Ana ("Anita")' });
    expect(res.body.deuda_total).toBe('20000.00');
    expect(res.body.ventas_impagas).toBe(2);
    expect(res.body.ventas.map((v) => [v.id, v.deuda, v.estado_pago, v.antiguedad_dias])).toEqual([
      [vieja.id, '10000.00', 'pendiente', 20],
      [nueva.id, '10000.00', 'parcial', 5],
      [pagada.id, '0.00', 'pagada', 40],
    ]);
  });

  it('comprador sin ventas → cuenta vacía; inexistente → 404', async () => {
    const { agent } = await loginComoSecretaria();
    const c = await crearComprador();
    const res = await agent.get(`/api/compradores/${c.id}/cuenta`);
    expect(res.body).toMatchObject({ deuda_total: '0.00', ventas_impagas: 0, ventas: [] });
    expect((await agent.get('/api/compradores/99999/cuenta')).status).toBe(404);
  });
});
