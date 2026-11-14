import { describe, it, expect } from 'vitest';
import { Producto } from '../../src/models/index.js';
import { loginComoAdmin, loginComoSecretaria } from '../helpers/auth.js';
import { crearProductoConVariantes } from '../helpers/factories.js';

describe('PATCH /api/productos/:id', () => {
  it('cambia el precio: rige para todas las variantes, sin tocar el resto de los datos', async () => {
    const { agent } = await loginComoAdmin();
    const { producto } = await crearProductoConVariantes({
      nombre: 'Remera',
      descripcion: 'Oficial',
      precio_venta: '15000.00',
      costo: '8000.00',
    });

    const res = await agent
      .patch(`/api/productos/${producto.id}`)
      .send({ precio_venta: '16500.50' });

    expect(res.status).toBe(200);
    expect(res.body.producto).toMatchObject({
      nombre: 'Remera',
      descripcion: 'Oficial',
      precio_venta: '16500.50',
      costo: '8000.00',
    });
    const enBase = await Producto.findByPk(producto.id);
    expect(enBase.precio_venta).toBe('16500.50');
    expect(enBase.descripcion).toBe('Oficial');
  });

  it('edita nombre, costo y descripción (vacía → null)', async () => {
    const { agent } = await loginComoAdmin();
    const { producto } = await crearProductoConVariantes({ descripcion: 'Vieja' });

    const res = await agent
      .patch(`/api/productos/${producto.id}`)
      .send({ nombre: 'Buzo', costo: 9500, descripcion: '' });
    expect(res.body.producto).toMatchObject({
      nombre: 'Buzo',
      costo: '9500.00',
      descripcion: null,
    });
  });

  it('nombre de otro producto → 409', async () => {
    const { agent } = await loginComoAdmin();
    await crearProductoConVariantes({ nombre: 'Short' });
    const { producto } = await crearProductoConVariantes({ nombre: 'Remera' });
    const res = await agent.patch(`/api/productos/${producto.id}`).send({ nombre: 'Short' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('PRODUCTO_DUPLICADO');
  });

  it('body vacío, campos desconocidos o precio negativo → 400', async () => {
    const { agent } = await loginComoAdmin();
    const { producto } = await crearProductoConVariantes();
    const url = `/api/productos/${producto.id}`;
    expect((await agent.patch(url).send({})).status).toBe(400);
    expect((await agent.patch(url).send({ stock: 100 })).status).toBe(400);
    expect((await agent.patch(url).send({ precio_venta: -5 })).status).toBe(400);
  });

  it('inexistente → 404; secretaría → 403', async () => {
    const { agent: admin } = await loginComoAdmin();
    expect((await admin.patch('/api/productos/99999').send({ nombre: 'X' })).status).toBe(404);

    const { producto } = await crearProductoConVariantes();
    const { agent: secre } = await loginComoSecretaria();
    expect(
      (await secre.patch(`/api/productos/${producto.id}`).send({ precio_venta: 1 })).status,
    ).toBe(403);
  });
});
