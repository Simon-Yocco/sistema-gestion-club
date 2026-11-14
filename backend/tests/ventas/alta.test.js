import { describe, it, expect } from 'vitest';
import {
  Variante,
  Producto,
  Venta,
  VentaItem,
  Pago,
  MovimientoFondos,
  Comprador,
} from '../../src/models/index.js';
import { loginComoSecretaria } from '../helpers/auth.js';
import { crearProductoConVariantes, crearComprador } from '../helpers/factories.js';

const stockDe = async (id) => (await Variante.findByPk(id)).stock;

/** Movimientos agrupados por medio: { efectivo: '15000.00', transferencia: ... }. */
async function movimientosPorMedio() {
  const movs = await MovimientoFondos.findAll({ order: [['id', 'ASC']] });
  return movs.map((m) => [m.medio, m.monto, m.tipo, m.referencia_tipo]);
}

/** Remera $15.000 (Azul M, stock 5) y Short $9.000 (Negro L, stock 2). */
async function catalogo() {
  const remera = await crearProductoConVariantes({
    nombre: 'Remera',
    precio_venta: '15000.00',
    costo: '8000.00',
    colores: ['Azul'],
    talles: ['M'],
    stock: 5,
  });
  const short = await crearProductoConVariantes({
    nombre: 'Short',
    precio_venta: '9000.00',
    costo: '4500.00',
    colores: ['Negro'],
    talles: ['L'],
    stock: 2,
  });
  return { remera: remera.variantes[0], short: short.variantes[0] };
}

describe('POST /api/ventas', () => {
  it('venta pagada en efectivo: descuenta stock, congela precio y costo, mueve fondos', async () => {
    const { agent, usuario } = await loginComoSecretaria();
    const { remera, short } = await catalogo();

    const res = await agent.post('/api/ventas').send({
      comprador: { nombre: 'Juan' },
      items: [
        { variante_id: remera.id, cantidad: 2 },
        { variante_id: short.id, cantidad: 1 },
      ],
      pagos: [{ medio: 'efectivo', monto: '39000' }],
    });

    expect(res.status).toBe(201);
    const v = res.body.venta;
    expect(v).toMatchObject({
      estado: 'activa',
      total: '39000.00',
      pagado: '39000.00',
      deuda: '0.00',
      estado_pago: 'pagada',
      comprador: { nombre: 'Juan', identificable: false },
      usuario: { id: usuario.id },
    });
    expect(v.items.map((i) => [i.producto, i.cantidad, i.precio_unitario, i.subtotal])).toEqual([
      ['Remera', 2, '15000.00', '30000.00'],
      ['Short', 1, '9000.00', '9000.00'],
    ]);
    expect(v.items[0]).not.toHaveProperty('costo_unitario'); // secretaría no ve costos
    expect(v.pagos).toEqual([
      expect.objectContaining({ medio: 'efectivo', monto: '39000.00', tipo: 'cobro' }),
    ]);

    expect(await stockDe(remera.id)).toBe(3);
    expect(await stockDe(short.id)).toBe(1);
    const item = await VentaItem.findOne({ where: { variante_id: remera.id } });
    expect(item.costo_unitario).toBe('8000.00');
    expect(await movimientosPorMedio()).toEqual([['efectivo', '39000.00', 'cobro_venta', 'pago']]);
  });

  it('venta pagada por transferencia', async () => {
    const { agent } = await loginComoSecretaria();
    const { remera } = await catalogo();
    const res = await agent.post('/api/ventas').send({
      items: [{ variante_id: remera.id, cantidad: 1 }],
      pagos: [{ medio: 'transferencia', monto: 15000 }],
    });
    expect(res.status).toBe(201);
    expect(res.body.venta.comprador).toBeNull();
    expect(await movimientosPorMedio()).toEqual([
      ['transferencia', '15000.00', 'cobro_venta', 'pago'],
    ]);
  });

  it('pago mixto: un movimiento por cada medio', async () => {
    const { agent } = await loginComoSecretaria();
    const { remera } = await catalogo();
    const res = await agent.post('/api/ventas').send({
      items: [{ variante_id: remera.id, cantidad: 1 }],
      pagos: [
        { medio: 'efectivo', monto: '10000' },
        { medio: 'transferencia', monto: '5000' },
      ],
    });
    expect(res.body.venta.estado_pago).toBe('pagada');
    expect(await movimientosPorMedio()).toEqual([
      ['efectivo', '10000.00', 'cobro_venta', 'pago'],
      ['transferencia', '5000.00', 'cobro_venta', 'pago'],
    ]);
  });

  it('fiado total: sin pagos, con comprador identificable; stock baja pero no entra dinero', async () => {
    const { agent } = await loginComoSecretaria();
    const { remera } = await catalogo();
    const comprador = await crearComprador({ numero_socio: '123' });

    const res = await agent.post('/api/ventas').send({
      comprador_id: comprador.id,
      items: [{ variante_id: remera.id, cantidad: 1 }],
    });

    expect(res.status).toBe(201);
    expect(res.body.venta).toMatchObject({
      pagado: '0.00',
      deuda: '15000.00',
      estado_pago: 'pendiente',
      comprador: { id: comprador.id },
    });
    expect(await stockDe(remera.id)).toBe(4);
    expect(await MovimientoFondos.count()).toBe(0);
  });

  it('fiado parcial con comprador nuevo creado en el momento (con teléfono)', async () => {
    const { agent } = await loginComoSecretaria();
    const { remera } = await catalogo();

    const res = await agent.post('/api/ventas').send({
      comprador: { nombre: 'Laura', telefono: '1155551234' },
      items: [{ variante_id: remera.id, cantidad: 2 }],
      pagos: [{ medio: 'efectivo', monto: '10000' }],
    });

    expect(res.status).toBe(201);
    expect(res.body.venta).toMatchObject({
      total: '30000.00',
      pagado: '10000.00',
      deuda: '20000.00',
      estado_pago: 'parcial',
      comprador: { nombre: 'Laura', identificable: true },
    });
    expect(await Comprador.count()).toBe(1);
  });

  it('fiado sin comprador identificable → 400 COMPRADOR_REQUERIDO_FIADO, nada se guarda', async () => {
    const { agent } = await loginComoSecretaria();
    const { remera } = await catalogo();

    for (const body of [
      { items: [{ variante_id: remera.id, cantidad: 1 }] },
      {
        comprador: { nombre: 'Solo nombre' },
        items: [{ variante_id: remera.id, cantidad: 1 }],
        pagos: [{ medio: 'efectivo', monto: '1000' }],
      },
    ]) {
      const res = await agent.post('/api/ventas').send(body);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('COMPRADOR_REQUERIDO_FIADO');
    }
    expect(await Venta.count()).toBe(0);
    expect(await Comprador.count()).toBe(0); // el comprador nuevo tampoco quedó
    expect(await stockDe(remera.id)).toBe(5);
  });

  it('sin stock → 409 STOCK_INSUFICIENTE indicando la variante; nada se guarda', async () => {
    const { agent } = await loginComoSecretaria();
    const { remera, short } = await catalogo();

    const res = await agent.post('/api/ventas').send({
      items: [
        { variante_id: remera.id, cantidad: 1 },
        { variante_id: short.id, cantidad: 3 },
      ],
      pagos: [{ medio: 'efectivo', monto: '42000' }],
    });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({
      code: 'STOCK_INSUFICIENTE',
      details: { variante_id: short.id, producto: 'Short', disponible: 2, solicitado: 3 },
    });
    // la remera se había descontado primero: la transacción lo revierte
    expect(await stockDe(remera.id)).toBe(5);
    expect(await Venta.count()).toBe(0);
    expect(await Pago.count()).toBe(0);
    expect(await MovimientoFondos.count()).toBe(0);
  });

  it('pagos que superan el total → 400 PAGO_EXCEDE_TOTAL', async () => {
    const { agent } = await loginComoSecretaria();
    const { remera } = await catalogo();
    const res = await agent.post('/api/ventas').send({
      items: [{ variante_id: remera.id, cantidad: 1 }],
      pagos: [
        { medio: 'efectivo', monto: '10000' },
        { medio: 'transferencia', monto: '5000.01' },
      ],
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({
      code: 'PAGO_EXCEDE_TOTAL',
      details: { total: '15000.00', pagado: '15000.01' },
    });
    expect(await Venta.count()).toBe(0);
  });

  it('variante o producto inactivo → 409 VARIANTE_INACTIVA', async () => {
    const { agent } = await loginComoSecretaria();
    const { remera, short } = await catalogo();
    await Variante.update({ activo: false }, { where: { id: remera.id } });
    await Producto.update({ activo: false }, { where: { id: short.producto_id } });

    for (const v of [remera, short]) {
      const res = await agent.post('/api/ventas').send({
        items: [{ variante_id: v.id, cantidad: 1 }],
        pagos: [{ medio: 'efectivo', monto: '1' }],
      });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('VARIANTE_INACTIVA');
    }
  });

  it('validaciones: sin ítems, prenda repetida, inexistente, monto 0, medio inválido', async () => {
    const { agent } = await loginComoSecretaria();
    const { remera } = await catalogo();
    const item = { variante_id: remera.id, cantidad: 1 };

    const casos = [
      [{ items: [] }, 'VALIDACION'],
      [{ items: [item, item] }, 'ITEM_DUPLICADO'],
      [{ items: [{ variante_id: 99999, cantidad: 1 }] }, 'VARIANTE_NO_ENCONTRADA'],
      [{ items: [item], pagos: [{ medio: 'efectivo', monto: 0 }] }, 'VALIDACION'],
      [{ items: [item], pagos: [{ medio: 'cheque', monto: 100 }] }, 'VALIDACION'],
      [{ items: [item], comprador_id: 1, comprador: { nombre: 'X' } }, 'VALIDACION'],
    ];
    for (const [body, code] of casos) {
      const res = await agent.post('/api/ventas').send(body);
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect(res.body.error.code).toBe(code);
    }
  });

  it('comprador_id inexistente → 404', async () => {
    const { agent } = await loginComoSecretaria();
    const { remera } = await catalogo();
    const res = await agent.post('/api/ventas').send({
      comprador_id: 99999,
      items: [{ variante_id: remera.id, cantidad: 1 }],
      pagos: [{ medio: 'efectivo', monto: '15000' }],
    });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('COMPRADOR_NO_ENCONTRADO');
  });
});
