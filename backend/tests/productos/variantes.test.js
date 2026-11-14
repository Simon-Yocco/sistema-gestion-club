import { describe, it, expect } from 'vitest';
import { Variante } from '../../src/models/index.js';
import { loginComoAdmin, loginComoSecretaria } from '../helpers/auth.js';
import { crearProductoConVariantes } from '../helpers/factories.js';

const url = (id) => `/api/productos/${id}/variantes`;

describe('POST /api/productos/:id/variantes', () => {
  it('nuevo color: crea ese color en todos los talles existentes, con stock 0', async () => {
    const { agent } = await loginComoAdmin();
    const { producto } = await crearProductoConVariantes({
      colores: ['Blanca'],
      talles: ['S', 'M'],
      stock: 5,
    });

    const res = await agent.post(url(producto.id)).send({ colores: ['negra'] });

    expect(res.status).toBe(201);
    expect(res.body.creadas).toBe(2);
    expect(res.body.producto.grilla.colores).toEqual(['Blanca', 'Negra']);
    expect(res.body.producto.grilla.celdas.Negra).toMatchObject({
      S: { stock: 0 },
      M: { stock: 0 },
    });
    // las existentes no se tocan
    expect(res.body.producto.grilla.celdas.Blanca.S.stock).toBe(5);
  });

  it('nuevo talle: crea ese talle en todos los colores existentes', async () => {
    const { agent } = await loginComoAdmin();
    const { producto } = await crearProductoConVariantes({
      colores: ['Blanca', 'Azul'],
      talles: ['M'],
    });

    const res = await agent.post(url(producto.id)).send({ talles: ['xl'] });
    expect(res.body.creadas).toBe(2);
    expect(res.body.producto.grilla.talles).toEqual(['M', 'XL']);
  });

  it('color y talle nuevos a la vez completan toda la grilla', async () => {
    const { agent } = await loginComoAdmin();
    const { producto } = await crearProductoConVariantes({ colores: ['Blanca'], talles: ['M'] });

    const res = await agent.post(url(producto.id)).send({ colores: ['Azul'], talles: ['L'] });
    expect(res.body.creadas).toBe(3); // Blanca L, Azul M, Azul L
    expect(await Variante.count({ where: { producto_id: producto.id } })).toBe(4);
  });

  it('si ya existen todas (sin importar mayúsculas) → 409 SIN_VARIANTES_NUEVAS', async () => {
    const { agent } = await loginComoAdmin();
    const { producto } = await crearProductoConVariantes({ colores: ['Blanca'], talles: ['M'] });

    const res = await agent.post(url(producto.id)).send({ colores: ['BLANCA'], talles: ['m'] });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('SIN_VARIANTES_NUEVAS');
  });

  it('sin colores ni talles → 400; producto inexistente → 404; secretaría → 403', async () => {
    const { agent } = await loginComoAdmin();
    const { producto } = await crearProductoConVariantes();
    expect((await agent.post(url(producto.id)).send({})).status).toBe(400);
    expect((await agent.post(url(99999)).send({ colores: ['Roja'] })).status).toBe(404);

    const { agent: secre } = await loginComoSecretaria();
    expect((await secre.post(url(producto.id)).send({ colores: ['Roja'] })).status).toBe(403);
  });
});
