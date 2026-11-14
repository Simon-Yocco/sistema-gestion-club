import { describe, it, expect } from 'vitest';
import { MovimientoFondos } from '../../src/models/index.js';
import { loginComoAdmin, loginComoSecretaria } from '../helpers/auth.js';

/** Préstamo 100.000 efectivo, depósito 30.000, egreso 5.000 transferencia, devolución 20.000. */
async function operaciones(agent) {
  await agent.post('/api/prestamos').send({ tipo: 'recibido', monto: '100000', medio: 'efectivo' });
  await agent.post('/api/transferencias-medios').send({ tipo: 'deposito', monto: '30000' });
  await agent
    .post('/api/egresos')
    .send({ monto: '5000', medio: 'transferencia', concepto: 'otro' });
  await agent
    .post('/api/prestamos')
    .send({ tipo: 'devolucion', monto: '20000', medio: 'efectivo' });
}

describe('GET /api/saldos (10.4)', () => {
  it('saldo por medio, total y deuda con la comisión; secretaría también lo ve', async () => {
    const { agent } = await loginComoSecretaria();
    await operaciones(agent);

    const res = await agent.get('/api/saldos');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      efectivo: '50000.00', // 100.000 − 30.000 − 20.000
      transferencia: '25000.00', // 30.000 − 5.000
      total: '75000.00',
      deuda_comision: '80000.00',
      prestamos_recibidos: '100000.00',
      prestamos_devueltos: '20000.00',
    });
  });

  it('sin movimientos: todo en cero', async () => {
    const { agent } = await loginComoSecretaria();
    expect((await agent.get('/api/saldos')).body).toMatchObject({
      efectivo: '0.00',
      transferencia: '0.00',
      total: '0.00',
      deuda_comision: '0.00',
    });
  });
});

describe('GET /api/movimientos (10.5)', () => {
  it('libro del más reciente al más viejo con saldo acumulado total', async () => {
    const { agent } = await loginComoAdmin();
    await operaciones(agent);

    const res = await agent.get('/api/movimientos');

    expect(res.status).toBe(200);
    expect(res.body.movimientos.map((m) => [m.tipo, m.medio, m.monto, m.saldo_acumulado])).toEqual([
      ['devolucion_prestamo', 'efectivo', '-20000.00', '75000.00'],
      ['egreso', 'transferencia', '-5000.00', '95000.00'],
      ['deposito_bancario', 'transferencia', '30000.00', '100000.00'],
      ['deposito_bancario', 'efectivo', '-30000.00', '70000.00'],
      ['prestamo_recibido', 'efectivo', '100000.00', '100000.00'],
    ]);
    expect(res.body.movimientos[1]).toMatchObject({
      referencia: { tipo: 'egreso', id: expect.any(Number) },
      usuario: { nombre: expect.any(String) },
    });
    expect(res.body.paginacion.total).toBe(5);
  });

  it('por medio: saldo acumulado de ese medio', async () => {
    const { agent } = await loginComoAdmin();
    await operaciones(agent);

    const res = await agent.get('/api/movimientos?medio=efectivo');
    expect(res.body.movimientos.map((m) => [m.monto, m.saldo_acumulado])).toEqual([
      ['-20000.00', '50000.00'],
      ['-30000.00', '70000.00'],
      ['100000.00', '100000.00'],
    ]);
  });

  it('el saldo acumulado es correcto aunque se filtre por tipo o se pagine', async () => {
    const { agent } = await loginComoAdmin();
    await operaciones(agent);

    const egresos = await agent.get('/api/movimientos?tipo=egreso');
    expect(egresos.body.movimientos.map((m) => m.saldo_acumulado)).toEqual(['95000.00']);

    const pagina2 = await agent.get('/api/movimientos?pagina=2&por_pagina=2');
    expect(pagina2.body.movimientos.map((m) => m.saldo_acumulado)).toEqual([
      '100000.00',
      '70000.00',
    ]);
  });

  it('filtra por día (hora argentina)', async () => {
    const { agent } = await loginComoAdmin();
    await operaciones(agent);
    const primero = await MovimientoFondos.findOne({ where: { tipo: 'prestamo_recibido' } });
    await primero.update({ fecha: new Date('2026-11-01T15:00:00Z') });

    const res = await agent.get('/api/movimientos?desde=2026-11-01&hasta=2026-11-01');
    expect(res.body.movimientos.map((m) => m.tipo)).toEqual(['prestamo_recibido']);
  });

  it('solo admin: secretaría → 403', async () => {
    const { agent } = await loginComoSecretaria();
    expect((await agent.get('/api/movimientos')).status).toBe(403);
  });
});
