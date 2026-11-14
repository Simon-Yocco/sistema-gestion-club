import { describe, it, expect } from 'vitest';
import { Egreso } from '../../src/models/index.js';
import { loginComoAdmin, loginComoSecretaria } from '../helpers/auth.js';
import { crearProductoConVariantes } from '../helpers/factories.js';

describe('GET /api/ingresos/:id', () => {
  it('detalle con ítems, egresos asociados y estado de pago', async () => {
    const { agent, usuario } = await loginComoAdmin({ nombre: 'Admin' });
    const { variantes } = await crearProductoConVariantes({
      nombre: 'Short',
      costo: '4500.00',
      colores: ['Negro'],
      talles: ['M', 'L'],
    });
    const creado = (
      await agent.post('/api/ingresos').send({
        fecha: '2026-11-01',
        proveedor: 'Textil Sur',
        observaciones: 'Factura A-0001',
        items: [
          { variante_id: variantes[0].id, cantidad: 4 },
          { variante_id: variantes[1].id, cantidad: 2 },
        ],
      })
    ).body.ingreso;
    await Egreso.create({
      fecha: '2026-11-03',
      monto: '27000.00',
      medio: 'efectivo',
      concepto: 'mercaderia',
      comprobante: 'R-15',
      ingreso_mercaderia_id: creado.id,
      usuario_id: usuario.id,
    });

    const res = await agent.get(`/api/ingresos/${creado.id}`);

    expect(res.status).toBe(200);
    expect(res.body.ingreso).toMatchObject({
      id: creado.id,
      fecha: '2026-11-01',
      proveedor: 'Textil Sur',
      observaciones: 'Factura A-0001',
      usuario: { id: usuario.id, nombre: 'Admin' },
      unidades: 6,
      total: '27000.00',
      pagado: '27000.00',
      estado_pago: 'pagado',
    });
    expect(res.body.ingreso.items.map((i) => [i.talle, i.cantidad, i.subtotal])).toEqual([
      ['M', 4, '18000.00'],
      ['L', 2, '9000.00'],
    ]);
    expect(res.body.ingreso.egresos).toEqual([
      expect.objectContaining({
        fecha: '2026-11-03',
        monto: '27000.00',
        medio: 'efectivo',
        comprobante: 'R-15',
      }),
    ]);
  });

  it('inexistente → 404; id inválido → 400; secretaría → 403', async () => {
    const { agent } = await loginComoAdmin();
    const res = await agent.get('/api/ingresos/99999');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('INGRESO_NO_ENCONTRADO');
    expect((await agent.get('/api/ingresos/abc')).status).toBe(400);

    const { agent: secre } = await loginComoSecretaria();
    expect((await secre.get('/api/ingresos/1')).status).toBe(403);
  });
});
