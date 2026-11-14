import { describe, it, expect } from 'vitest';
import { Variante } from '../../src/models/index.js';
import { loginComoAdmin, loginComoSecretaria } from '../helpers/auth.js';
import { crearProductoConVariantes } from '../helpers/factories.js';

const remera = {
  nombre: 'Remera titular',
  descripcion: 'Oficial',
  precio_venta: '15000',
  costo: 8000.5,
  colores: ['blanca', 'Azul'],
  talles: ['l', 'S', 'M'],
};

describe('POST /api/productos', () => {
  it('crea el producto con la grilla colores × talles, stock 0', async () => {
    const { agent } = await loginComoAdmin();
    const res = await agent.post('/api/productos').send(remera);

    expect(res.status).toBe(201);
    const p = res.body.producto;
    expect(p).toMatchObject({
      nombre: 'Remera titular',
      descripcion: 'Oficial',
      precio_venta: '15000.00',
      costo: '8000.50',
      activo: true,
      stock_total: 0,
    });
    expect(p.variantes).toHaveLength(6);
    expect(p.variantes.every((v) => v.stock === 0 && v.activo)).toBe(true);
    // colores con mayúscula inicial, talles en mayúsculas y orden natural
    expect(p.grilla.colores).toEqual(['Azul', 'Blanca']);
    expect(p.grilla.talles).toEqual(['S', 'M', 'L']);
    expect(await Variante.count({ where: { producto_id: p.id } })).toBe(6);
  });

  it('color o talle repetido en el pedido (sin importar mayúsculas/acentos) → 400', async () => {
    const { agent } = await loginComoAdmin();

    const colores = await agent
      .post('/api/productos')
      .send({ ...remera, colores: ['Azul', 'azúl'] });
    expect(colores.status).toBe(400);
    expect(colores.body.error).toMatchObject({
      code: 'VARIANTE_DUPLICADA',
      details: { campo: 'colores' },
    });

    const talles = await agent.post('/api/productos').send({ ...remera, talles: ['M', ' m '] });
    expect(talles.status).toBe(400);
    expect(talles.body.error.code).toBe('VARIANTE_DUPLICADA');
  });

  it('nombre repetido → 409 PRODUCTO_DUPLICADO y no crea nada', async () => {
    const { agent } = await loginComoAdmin();
    await crearProductoConVariantes({ nombre: 'Remera titular' });
    const antes = await Variante.count();

    const res = await agent.post('/api/productos').send(remera);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('PRODUCTO_DUPLICADO');
    expect(await Variante.count()).toBe(antes);
  });

  it('valida precio, costo y listas', async () => {
    const { agent } = await loginComoAdmin();
    const res = await agent.post('/api/productos').send({
      nombre: '',
      precio_venta: '-1',
      costo: '10,50',
      colores: [],
      talles: [''],
    });
    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d) => d.campo).sort()).toEqual([
      'body.colores',
      'body.costo',
      'body.nombre',
      'body.precio_venta',
      'body.talles.0',
    ]);
  });

  it('secretaría no puede crear productos → 403', async () => {
    const { agent } = await loginComoSecretaria();
    expect((await agent.post('/api/productos').send(remera)).status).toBe(403);
  });
});
