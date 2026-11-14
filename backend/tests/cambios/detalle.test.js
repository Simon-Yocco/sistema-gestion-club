// 9.3 Los cambios se muestran en el detalle de la venta.
import { describe, it, expect } from 'vitest';
import { loginComoSecretaria } from '../helpers/auth.js';
import { crearProductoConVariantes, crearComprador } from '../helpers/factories.js';

describe('cambios en el detalle de la venta', () => {
  it('muestra la prenda que salió, la que entró, la diferencia y cómo se resolvió', async () => {
    const { agent, usuario } = await loginComoSecretaria({ nombre: 'Sole' });
    const remera = await crearProductoConVariantes({
      nombre: 'Remera',
      precio_venta: '15000.00',
      colores: ['Azul'],
      talles: ['M'],
    });
    const buzo = await crearProductoConVariantes({
      nombre: 'Buzo',
      precio_venta: '35000.00',
      colores: ['Gris'],
      talles: ['L'],
    });
    const venta = (
      await agent.post('/api/ventas').send({
        comprador_id: (await crearComprador()).id,
        items: [{ variante_id: remera.variantes[0].id, cantidad: 1 }],
      })
    ).body.venta;

    await agent
      .post(`/api/ventas/${venta.id}/cambios`)
      .send({
        venta_item_id: venta.items[0].id,
        variante_nueva_id: buzo.variantes[0].id,
        motivo: 'Prefirió el buzo',
      })
      .expect(201);

    const detalle = (await agent.get(`/api/ventas/${venta.id}`)).body.venta;

    expect(detalle.cambios).toEqual([
      {
        id: expect.any(Number),
        fecha: expect.any(String),
        sin_venta_registrada: false,
        devuelta: {
          variante_id: remera.variantes[0].id,
          producto: 'Remera',
          color: 'Azul',
          talle: 'M',
          venta_item_id: venta.items[0].id,
          cantidad: 1,
          valor: '15000.00',
        },
        nueva: {
          variante_id: buzo.variantes[0].id,
          producto: 'Buzo',
          color: 'Gris',
          talle: 'L',
          venta_item_id: detalle.items[1].id,
          cantidad: 1,
          valor: '35000.00',
        },
        diferencia: '20000.00',
        resolucion: 'ajuste_deuda',
        motivo: 'Prefirió el buzo',
        usuario: { id: usuario.id, nombre: 'Sole' },
      },
    ]);
  });

  it('cambio sin venta registrada: se ve en la venta nueva, marcado como tal', async () => {
    const { agent } = await loginComoSecretaria();
    const { variantes } = await crearProductoConVariantes({
      talles: ['M', 'L'],
      colores: ['Azul'],
    });

    const { venta } = (
      await agent
        .post('/api/cambios/sin-venta')
        .send({ variante_devuelta_id: variantes[0].id, variante_nueva_id: variantes[1].id })
    ).body;

    expect(venta.cambios).toEqual([
      expect.objectContaining({
        sin_venta_registrada: true,
        devuelta: expect.objectContaining({ talle: 'M', venta_item_id: null }),
        nueva: expect.objectContaining({ talle: 'L' }),
        resolucion: 'sin_diferencia',
      }),
    ]);
  });
});
