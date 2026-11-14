import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { loginComoAdmin, loginComoSecretaria } from '../helpers/auth.js';
import { crearProductoConVariantes, crearComprador } from '../helpers/factories.js';

async function ventaMixtaFiada(agent) {
  const { variantes } = await crearProductoConVariantes({
    nombre: 'Remera',
    precio_venta: '15000.00',
    costo: '8000.00',
    colores: ['Azul'],
    talles: ['M'],
  });
  const comprador = await crearComprador({ nombre: 'Ana', numero_socio: '10' });
  const res = await agent.post('/api/ventas').send({
    comprador_id: comprador.id,
    items: [{ variante_id: variantes[0].id, cantidad: 2 }],
    pagos: [
      { medio: 'efectivo', monto: '10000' },
      { medio: 'transferencia', monto: '5000' },
    ],
  });
  return res.body.venta;
}

describe('GET /api/ventas/:id', () => {
  it('detalle completo para secretaría (sin costos ni ganancia)', async () => {
    const { agent, usuario } = await loginComoSecretaria({ nombre: 'Sole' });
    const creada = await ventaMixtaFiada(agent);

    const res = await agent.get(`/api/ventas/${creada.id}`);

    expect(res.status).toBe(200);
    const v = res.body.venta;
    expect(v).toMatchObject({
      id: creada.id,
      estado: 'activa',
      motivo_anulacion: null,
      anulada_por: null,
      comprador: { nombre: 'Ana', numero_socio: '10', puede_fiar: true },
      usuario: { id: usuario.id, nombre: 'Sole' },
      total: '30000.00',
      pagado: '15000.00',
      deuda: '15000.00',
      estado_pago: 'parcial',
      devoluciones: [],
      cambios: [],
    });
    expect(v.fecha).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(v.items).toEqual([
      expect.objectContaining({
        producto: 'Remera',
        color: 'Azul',
        talle: 'M',
        cantidad: 2,
        cantidad_devuelta: 0,
        cantidad_vigente: 2,
        precio_unitario: '15000.00',
        subtotal: '30000.00',
        origen: 'venta',
      }),
    ]);
    expect(v.pagos.map((p) => [p.medio, p.monto, p.usuario.nombre])).toEqual([
      ['efectivo', '10000.00', 'Sole'],
      ['transferencia', '5000.00', 'Sole'],
    ]);
    expect(v).not.toHaveProperty('ganancia');
    expect(v.items[0]).not.toHaveProperty('costo_unitario');
  });

  it('el admin ve costo unitario y ganancia', async () => {
    const { agent } = await loginComoAdmin();
    const creada = await ventaMixtaFiada(agent);

    const v = (await agent.get(`/api/ventas/${creada.id}`)).body.venta;
    expect(v.items[0].costo_unitario).toBe('8000.00');
    expect(v.ganancia).toBe('14000.00');
  });

  it('inexistente → 404; id inválido → 400; sin sesión → 401', async () => {
    const { agent } = await loginComoSecretaria();
    const res = await agent.get('/api/ventas/99999');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('VENTA_NO_ENCONTRADA');
    expect((await agent.get('/api/ventas/abc')).status).toBe(400);
    expect((await request(createApp()).get('/api/ventas/1')).status).toBe(401);
  });
});
