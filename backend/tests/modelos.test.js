import { describe, it, expect } from 'vitest';
import * as modelos from '../src/models/index.js';
import { sequelize, Producto, Variante, Usuario, Venta, Pago } from '../src/models/index.js';
import { crearUsuario, crearProductoConVariantes, crearComprador } from './helpers/factories.js';

describe('modelos y asociaciones', () => {
  it('crea un producto con variantes y lo recupera con include', async () => {
    const { producto } = await crearProductoConVariantes({
      nombre: 'Remera titular',
      precio_venta: '15000.00',
      colores: ['Blanca', 'Azul'],
      talles: ['S', 'M', 'L'],
      stock: 5,
    });

    const leido = await Producto.findByPk(producto.id, {
      include: [{ model: Variante, as: 'variantes' }],
      order: [[{ model: Variante, as: 'variantes' }, 'id', 'ASC']],
    });

    expect(leido.nombre).toBe('Remera titular');
    expect(leido.precio_venta).toBe('15000.00'); // DECIMAL llega como string
    expect(leido.variantes).toHaveLength(6);
    expect(leido.variantes.map((v) => `${v.color}-${v.talle}`)).toContain('Azul-M');
    expect(leido.variantes.every((v) => v.stock === 5)).toBe(true);
  });

  it('no permite dos variantes con el mismo producto, talle y color', async () => {
    const { producto } = await crearProductoConVariantes({ colores: ['Blanca'], talles: ['M'] });
    await expect(
      Variante.create({ producto_id: producto.id, color: 'Blanca', talle: 'M' }),
    ).rejects.toMatchObject({ name: 'SequelizeUniqueConstraintError' });
  });

  it('el stock no puede ser negativo', async () => {
    const { variantes } = await crearProductoConVariantes({ colores: ['Blanca'], talles: ['M'] });
    await expect(
      sequelize.query('UPDATE variante SET stock = stock - 99 WHERE id = ?', {
        replacements: [variantes[0].id],
      }),
    ).rejects.toThrow(/out of range/i);
  });

  it('el usuario no expone password_hash salvo con el scope conPassword', async () => {
    const u = await crearUsuario();
    expect((await Usuario.findByPk(u.id)).password_hash).toBeUndefined();
    expect((await Usuario.scope('conPassword').findByPk(u.id)).password_hash).toBeTruthy();
  });

  it('venta con comprador, ítems y pagos', async () => {
    const usuario = await crearUsuario();
    const comprador = await crearComprador();
    const { variantes } = await crearProductoConVariantes();
    const venta = await Venta.create(
      {
        comprador_id: comprador.id,
        usuario_id: usuario.id,
        items: [
          {
            variante_id: variantes[0].id,
            cantidad: 2,
            precio_unitario: '15000.00',
            costo_unitario: '8000.00',
          },
        ],
        pagos: [{ medio: 'efectivo', monto: '10000.00', tipo: 'cobro', usuario_id: usuario.id }],
      },
      { include: ['items', 'pagos'] },
    );

    const leida = await Venta.findByPk(venta.id, { include: ['comprador', 'items', 'pagos'] });
    expect(leida.estado).toBe('activa');
    expect(leida.comprador.id).toBe(comprador.id);
    expect(leida.items[0].cantidad_devuelta).toBe(0);
    expect(leida.items[0].origen).toBe('venta');
    expect(leida.pagos[0].monto).toBe('10000.00');
  });

  it('un cobro con monto negativo viola el CHECK de pago', async () => {
    const usuario = await crearUsuario();
    const venta = await Venta.create({ usuario_id: usuario.id });
    await expect(
      Pago.create({
        venta_id: venta.id,
        medio: 'efectivo',
        monto: '-100.00',
        tipo: 'cobro',
        usuario_id: usuario.id,
      }),
    ).rejects.toThrow(/chk_pago_signo/);
  });
});

describe('los modelos coinciden con las migraciones', () => {
  const lista = Object.values(modelos).filter(
    (m) => m?.prototype instanceof modelos.sequelize.Sequelize.Model,
  );

  it.each(lista.map((m) => [m.name, m]))('%s', async (_nombre, modelo) => {
    const columnas = Object.keys(
      await sequelize.getQueryInterface().describeTable(modelo.getTableName()),
    );
    const atributos = Object.values(modelo.getAttributes()).map((a) => a.field);
    expect([...atributos].sort()).toEqual([...columnas].sort());
  });
});
