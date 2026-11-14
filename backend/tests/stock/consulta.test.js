import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { Producto, Variante } from '../../src/models/index.js';
import { loginComoSecretaria } from '../helpers/auth.js';
import { crearProductoConVariantes } from '../helpers/factories.js';

async function escenario() {
  const remera = await crearProductoConVariantes({
    nombre: 'Remera',
    colores: ['Blanca'],
    talles: ['L', 'S'],
    stock: 3,
  });
  await Variante.update({ stock: 0 }, { where: { id: remera.variantes[0].id } }); // Blanca L
  const short = await crearProductoConVariantes({
    nombre: 'Short',
    colores: ['Negro'],
    talles: ['M'],
    stock: 2,
  });
  return { remera, short };
}

describe('GET /api/stock', () => {
  it('stock por producto / color / talle, ordenado, con total de unidades', async () => {
    const { agent } = await loginComoSecretaria();
    await escenario();

    const res = await agent.get('/api/stock');
    expect(res.status).toBe(200);
    expect(res.body.filas.map((f) => [f.producto, f.color, f.talle, f.stock])).toEqual([
      ['Remera', 'Blanca', 'S', 3],
      ['Remera', 'Blanca', 'L', 0],
      ['Short', 'Negro', 'M', 2],
    ]);
    expect(res.body.total_unidades).toBe(5);
  });

  it('filtros: sin stock, con stock, por producto y por nombre', async () => {
    const { agent } = await loginComoSecretaria();
    const { short } = await escenario();

    const sin = await agent.get('/api/stock?estado=sin_stock');
    expect(sin.body.filas.map((f) => `${f.producto} ${f.talle}`)).toEqual(['Remera L']);

    const con = await agent.get('/api/stock?estado=con_stock');
    expect(con.body.filas).toHaveLength(2);

    const porId = await agent.get(`/api/stock?producto_id=${short.producto.id}`);
    expect(porId.body.filas.map((f) => f.producto)).toEqual(['Short']);

    const porNombre = await agent.get('/api/stock?q=rem');
    expect(porNombre.body.filas.every((f) => f.producto === 'Remera')).toBe(true);

    // % y _ se buscan como texto, no como comodines
    expect((await agent.get('/api/stock?q=%25')).body.filas).toEqual([]);
    expect((await agent.get('/api/stock?q=_')).body.filas).toEqual([]);
  });

  it('no incluye productos ni variantes inactivos', async () => {
    const { agent } = await loginComoSecretaria();
    const { remera, short } = await escenario();
    await Producto.update({ activo: false }, { where: { id: short.producto.id } });
    await Variante.update({ activo: false }, { where: { id: remera.variantes[1].id } });

    const res = await agent.get('/api/stock');
    expect(res.body.filas.map((f) => `${f.producto} ${f.talle}`)).toEqual(['Remera L']);
  });

  it('estado inválido → 400; sin sesión → 401', async () => {
    const { agent } = await loginComoSecretaria();
    expect((await agent.get('/api/stock?estado=poco')).status).toBe(400);
    expect((await request(createApp()).get('/api/stock')).status).toBe(401);
  });
});
