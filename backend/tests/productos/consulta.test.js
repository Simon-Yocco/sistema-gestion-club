import { describe, it, expect } from 'vitest';
import { Producto, Variante } from '../../src/models/index.js';
import { loginComoAdmin, loginComoSecretaria } from '../helpers/auth.js';
import { crearProductoConVariantes } from '../helpers/factories.js';

describe('GET /api/productos', () => {
  it('lista con variantes y stock total, ordenado por nombre', async () => {
    const { agent } = await loginComoSecretaria();
    await crearProductoConVariantes({
      nombre: 'Short',
      colores: ['Negro'],
      talles: ['M'],
      stock: 4,
    });
    await crearProductoConVariantes({
      nombre: 'Remera',
      colores: ['Blanca', 'Azul'],
      talles: ['L', 'S', 'M'],
      stock: 2,
    });

    const res = await agent.get('/api/productos');

    expect(res.status).toBe(200);
    expect(res.body.productos.map((p) => p.nombre)).toEqual(['Remera', 'Short']);
    const remera = res.body.productos[0];
    expect(remera.stock_total).toBe(12);
    expect(remera.precio_venta).toBe('15000.00');
    // ordenadas por color y por talle natural (S < M < L)
    expect(remera.variantes.map((v) => `${v.color} ${v.talle}`)).toEqual([
      'Azul S',
      'Azul M',
      'Azul L',
      'Blanca S',
      'Blanca M',
      'Blanca L',
    ]);
  });

  it('busca por nombre (sin distinguir mayúsculas)', async () => {
    const { agent } = await loginComoSecretaria();
    await crearProductoConVariantes({ nombre: 'Remera titular' });
    await crearProductoConVariantes({ nombre: 'Remera suplente' });
    await crearProductoConVariantes({ nombre: 'Buzo' });

    const res = await agent.get('/api/productos?q=REMERA');
    expect(res.body.productos.map((p) => p.nombre)).toEqual(['Remera suplente', 'Remera titular']);
  });

  it('la búsqueda trata % y _ como texto, no como comodines', async () => {
    const { agent } = await loginComoSecretaria();
    await crearProductoConVariantes({ nombre: 'Remera' });
    expect((await agent.get('/api/productos?q=%25')).body.productos).toEqual([]);
  });

  it('secretaría: solo productos y variantes activos, y sin costo', async () => {
    const { agent } = await loginComoSecretaria();
    const { variantes } = await crearProductoConVariantes({
      nombre: 'Activo',
      colores: ['Azul'],
      talles: ['S', 'M'],
      stock: 3,
    });
    await Variante.update({ activo: false }, { where: { id: variantes[0].id } });
    const { producto: inactivo } = await crearProductoConVariantes({ nombre: 'Inactivo' });
    await Producto.update({ activo: false }, { where: { id: inactivo.id } });

    // pide inactivos explícitamente, pero igual no los ve
    const res = await agent.get('/api/productos?activo=false');
    expect(res.body.productos.map((p) => p.nombre)).toEqual(['Activo']);
    expect(res.body.productos[0].variantes).toHaveLength(1);
    expect(res.body.productos[0].stock_total).toBe(3);
    expect(res.body.productos[0]).not.toHaveProperty('costo');
  });

  it('admin: ve inactivos, filtra por activo y ve el costo', async () => {
    const { agent } = await loginComoAdmin();
    await crearProductoConVariantes({ nombre: 'Activo', costo: '8000.00' });
    const { producto } = await crearProductoConVariantes({ nombre: 'Inactivo' });
    await Producto.update({ activo: false }, { where: { id: producto.id } });

    const todos = await agent.get('/api/productos');
    expect(todos.body.productos.map((p) => p.nombre)).toEqual(['Activo', 'Inactivo']);
    expect(todos.body.productos[0].costo).toBe('8000.00');

    const inactivos = await agent.get('/api/productos?activo=false');
    expect(inactivos.body.productos.map((p) => p.nombre)).toEqual(['Inactivo']);
  });
});

describe('GET /api/productos/:id', () => {
  it('detalle con grilla color × talle', async () => {
    const { agent } = await loginComoSecretaria();
    const { producto, variantes } = await crearProductoConVariantes({
      colores: ['Blanca', 'Azul'],
      talles: ['XL', 'M'],
      stock: 1,
    });
    await Variante.update({ stock: 0 }, { where: { id: variantes[0].id } }); // Blanca XL

    const res = await agent.get(`/api/productos/${producto.id}`);

    expect(res.status).toBe(200);
    expect(res.body.producto.grilla.colores).toEqual(['Azul', 'Blanca']);
    expect(res.body.producto.grilla.talles).toEqual(['M', 'XL']);
    expect(res.body.producto.grilla.celdas.Blanca.XL).toEqual({
      id: variantes[0].id,
      stock: 0,
      activo: true,
    });
    expect(res.body.producto.grilla.celdas.Azul.M.stock).toBe(1);
  });

  it('inexistente → 404; inactivo → 404 para secretaría pero visible para admin', async () => {
    const { producto } = await crearProductoConVariantes();
    await Producto.update({ activo: false }, { where: { id: producto.id } });

    const { agent: secre } = await loginComoSecretaria();
    expect((await secre.get('/api/productos/99999')).body.error.code).toBe(
      'PRODUCTO_NO_ENCONTRADO',
    );
    expect((await secre.get(`/api/productos/${producto.id}`)).status).toBe(404);

    const { agent: admin } = await loginComoAdmin();
    expect((await admin.get(`/api/productos/${producto.id}`)).status).toBe(200);
  });
});
