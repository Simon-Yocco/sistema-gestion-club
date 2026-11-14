// 6.7 Principio 7: cada ítem de venta guarda el precio y el costo del momento.
// Un cambio posterior en el producto no modifica ventas ya registradas (regla 6 y 13).
import { describe, it, expect } from 'vitest';
import { loginComoAdmin } from '../helpers/auth.js';
import { crearProductoConVariantes, crearComprador } from '../helpers/factories.js';

describe('precio y costo congelados', () => {
  it('cambiar precio y costo del producto no afecta la venta ya hecha, sí la siguiente', async () => {
    const { agent } = await loginComoAdmin();
    const { producto, variantes } = await crearProductoConVariantes({
      precio_venta: '15000.00',
      costo: '8000.00',
      stock: 10,
    });
    const comprador = await crearComprador({ numero_socio: '1' });
    const vender = () =>
      agent
        .post('/api/ventas')
        .send({
          comprador_id: comprador.id,
          items: [{ variante_id: variantes[0].id, cantidad: 2 }],
        })
        .then((r) => r.body.venta);

    const antes = await vender();

    await agent
      .patch(`/api/productos/${producto.id}`)
      .send({ precio_venta: '18000', costo: '9500' })
      .expect(200);

    const vieja = (await agent.get(`/api/ventas/${antes.id}`)).body.venta;
    expect(vieja.items[0].precio_unitario).toBe('15000.00');
    expect(vieja.items[0].costo_unitario).toBe('8000.00');
    expect(vieja.total).toBe('30000.00');
    expect(vieja.deuda).toBe('30000.00'); // la deuda del fiado tampoco cambia
    expect(vieja.ganancia).toBe('14000.00');

    const nueva = (await agent.get(`/api/ventas/${(await vender()).id}`)).body.venta;
    expect(nueva.items[0].precio_unitario).toBe('18000.00');
    expect(nueva.total).toBe('36000.00');
    expect(nueva.ganancia).toBe('17000.00');
  });
});
