import { describe, it, expect } from 'vitest';
import { Producto, Variante } from '../../src/models/index.js';
import { loginComoAdmin, loginComoSecretaria } from '../helpers/auth.js';
import { crearProductoConVariantes } from '../helpers/factories.js';

describe('activar / desactivar', () => {
  it('producto: desactivado no aparece para secretaría; reactivado vuelve a aparecer', async () => {
    const { agent: admin } = await loginComoAdmin();
    const { agent: secre } = await loginComoSecretaria();
    const { producto } = await crearProductoConVariantes({ nombre: 'Remera' });

    const off = await admin.patch(`/api/productos/${producto.id}`).send({ activo: false });
    expect(off.status).toBe(200);
    expect(off.body.producto.activo).toBe(false);
    expect((await secre.get('/api/productos')).body.productos).toEqual([]);
    // no se borró: el admin lo sigue viendo
    expect((await admin.get('/api/productos')).body.productos).toHaveLength(1);
    expect(await Producto.count()).toBe(1);

    await admin.patch(`/api/productos/${producto.id}`).send({ activo: true }).expect(200);
    expect((await secre.get('/api/productos')).body.productos).toHaveLength(1);
  });

  it('variante: desactivada no aparece para secretaría ni cuenta en el stock total', async () => {
    const { agent: admin } = await loginComoAdmin();
    const { agent: secre } = await loginComoSecretaria();
    const { producto, variantes } = await crearProductoConVariantes({
      colores: ['Azul'],
      talles: ['S', 'M'],
      stock: 4,
    });

    const res = await admin
      .patch(`/api/productos/${producto.id}/variantes/${variantes[0].id}`)
      .send({ activo: false });
    expect(res.status).toBe(200);
    expect(res.body.producto.stock_total).toBe(4);
    expect(res.body.producto.variantes.find((v) => v.id === variantes[0].id).activo).toBe(false);

    const vista = (await secre.get(`/api/productos/${producto.id}`)).body.producto;
    expect(vista.variantes.map((v) => v.id)).toEqual([variantes[1].id]);
    expect(await Variante.count()).toBe(2);
  });

  it('variante de otro producto → 404; body inválido → 400; secretaría → 403', async () => {
    const { agent } = await loginComoAdmin();
    const { producto } = await crearProductoConVariantes();
    const { variantes: ajenas } = await crearProductoConVariantes();

    const ajena = await agent
      .patch(`/api/productos/${producto.id}/variantes/${ajenas[0].id}`)
      .send({ activo: false });
    expect(ajena.status).toBe(404);
    expect(ajena.body.error.code).toBe('VARIANTE_NO_ENCONTRADA');

    const url = `/api/productos/${producto.id}/variantes/${ajenas[0].id}`;
    expect((await agent.patch(url).send({ stock: 3 })).status).toBe(400);

    const { agent: secre } = await loginComoSecretaria();
    expect((await secre.patch(url).send({ activo: false })).status).toBe(403);
  });
});
