import { describe, it, expect } from 'vitest';
import { Producto, Egreso, MovimientoFondos } from '../../src/models/index.js';
import { loginComoAdmin } from '../helpers/auth.js';
import { crearProductoConVariantes, crearComprador } from '../helpers/factories.js';

describe('11.4 stock valorizado', () => {
  it('unidades por variante con valor a costo y a precio de venta actuales', async () => {
    const { agent } = await loginComoAdmin();
    const { producto } = await crearProductoConVariantes({
      nombre: 'Remera',
      precio_venta: '15000.00',
      costo: '8000.00',
      colores: ['Azul'],
      talles: ['S', 'M'],
      stock: 3,
    });
    await crearProductoConVariantes({ nombre: 'Agotado', stock: 0 });
    await Producto.update({ activo: false }, { where: { id: producto.id } });

    const res = await agent.get('/api/reportes/stock-valorizado');
    expect(res.body).toMatchObject({
      unidades: 6,
      valor_costo: '48000.00',
      valor_venta: '90000.00',
    });
    expect(res.body.detalle.map((d) => [d.talle, d.unidades, d.valor_costo, d.activo])).toEqual([
      ['M', 3, '24000.00', false],
      ['S', 3, '24000.00', false],
    ]);
  });
});

describe('11.5 anulaciones y devoluciones', () => {
  it('listado con monto, motivo y usuario', async () => {
    const { agent, usuario } = await loginComoAdmin({ nombre: 'Admin' });
    const { variantes } = await crearProductoConVariantes({ precio_venta: '10000.00', stock: 10 });
    const comprador = await crearComprador({ nombre: 'Ana' });
    const vender = () =>
      agent
        .post('/api/ventas')
        .send({
          comprador_id: comprador.id,
          items: [{ variante_id: variantes[0].id, cantidad: 3 }],
        })
        .then((r) => r.body.venta);

    const v1 = await vender();
    await agent
      .post(`/api/ventas/${v1.id}/devoluciones`)
      .send({ items: [{ venta_item_id: v1.items[0].id, cantidad: 1 }], motivo: 'Fallada' })
      .expect(201);
    const v2 = await vender();
    await agent.post(`/api/ventas/${v2.id}/anular`).send({ motivo: 'Error de carga' }).expect(201);

    const res = await agent.get('/api/reportes/devoluciones');
    expect(res.body).toMatchObject({
      cantidad_devoluciones: 1,
      cantidad_anulaciones: 1,
      monto_total: '40000.00',
    });
    expect(
      res.body.detalle.map((d) => [d.tipo, d.venta_id, d.unidades, d.monto, d.motivo]),
    ).toEqual([
      ['anulacion', v2.id, 3, '30000.00', 'Error de carga'],
      ['devolucion', v1.id, 1, '10000.00', 'Fallada'],
    ]);
    expect(res.body.detalle[0]).toMatchObject({ usuario: 'Admin', comprador: 'Ana' });
    expect(usuario.id).toBeTruthy();
  });
});

describe('11.6 egresos por concepto', () => {
  it('agrupa por concepto con totales por medio, en el período', async () => {
    const { agent } = await loginComoAdmin();
    const egreso = (fecha, monto, medio, concepto) =>
      agent.post('/api/egresos').send({ fecha, monto, medio, concepto }).expect(201);
    await egreso('2026-11-02', '1000', 'efectivo', 'otro');
    await egreso('2026-11-03', '5000', 'transferencia', 'mercaderia');
    await egreso('2026-11-04', '2000', 'efectivo', 'mercaderia');
    await egreso('2026-10-30', '9999', 'efectivo', 'otro');

    const res = await agent.get('/api/reportes/egresos?desde=2026-11-01&hasta=2026-11-30');
    expect(res.body).toMatchObject({ cantidad: 3, total: '8000.00' });
    expect(res.body.por_concepto).toEqual([
      {
        concepto: 'mercaderia',
        cantidad: 2,
        total: '7000.00',
        efectivo: '2000.00',
        transferencia: '5000.00',
      },
      {
        concepto: 'otro',
        cantidad: 1,
        total: '1000.00',
        efectivo: '1000.00',
        transferencia: '0.00',
      },
    ]);
    expect(await Egreso.count()).toBe(4);
  });
});

describe('11.7 deuda con la comisión', () => {
  it('historial con deuda acumulada y totales del período', async () => {
    const { agent } = await loginComoAdmin();
    const op = (tipo, monto) =>
      agent.post('/api/prestamos').send({ tipo, monto, medio: 'efectivo' }).expect(201);
    await op('recibido', '50000');
    await op('devolucion', '20000');
    await op('recibido', '10000');
    const primero = await MovimientoFondos.findOne({ order: [['id', 'ASC']] });
    await primero.update({ fecha: new Date('2026-10-15T15:00:00Z') });

    const todo = await agent.get('/api/reportes/comision');
    expect(todo.body.detalle.map((d) => [d.tipo, d.monto, d.deuda_acumulada])).toEqual([
      ['recibido', '10000.00', '40000.00'],
      ['devolucion', '20000.00', '30000.00'],
      ['recibido', '50000.00', '50000.00'],
    ]);
    expect(todo.body.deuda_actual).toBe('40000.00');

    const desdeNov = await agent.get('/api/reportes/comision?desde=2026-11-01');
    expect(desdeNov.body).toMatchObject({
      recibido_en_periodo: '10000.00',
      devuelto_en_periodo: '20000.00',
      deuda_actual: '40000.00',
    });
    expect(desdeNov.body.detalle).toHaveLength(2);
  });
});

describe('11.7b depósitos y extracciones', () => {
  it('totales por tipo en el período', async () => {
    const { agent } = await loginComoAdmin();
    const op = (fecha, tipo, monto) =>
      agent.post('/api/transferencias-medios').send({ fecha, tipo, monto }).expect(201);
    await op('2026-11-01', 'deposito', '1000');
    await op('2026-11-02', 'extraccion', '300');
    await op('2026-11-03', 'deposito', '500');
    await op('2026-10-01', 'deposito', '7777');

    const res = await agent.get('/api/reportes/depositos?desde=2026-11-01&hasta=2026-11-30');
    expect(res.body).toMatchObject({ total_depositos: '1500.00', total_extracciones: '300.00' });
    expect(res.body.detalle.map((d) => d.fecha)).toEqual([
      '2026-11-03',
      '2026-11-02',
      '2026-11-01',
    ]);
  });
});
