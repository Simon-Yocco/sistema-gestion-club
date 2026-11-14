import { describe, it, expect } from 'vitest';
import { MovimientoFondos } from '../../src/models/index.js';
import { loginComoSecretaria } from '../helpers/auth.js';
import { saldos } from '../helpers/fondos.js';

const prestamo = (agent, body) => agent.post('/api/prestamos').send(body);

describe('POST /api/prestamos', () => {
  it('préstamo recibido: suma al saldo del medio y a la deuda con la comisión', async () => {
    const { agent } = await loginComoSecretaria();

    const res = await prestamo(agent, { tipo: 'recibido', monto: '100000', medio: 'efectivo' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      movimiento: { tipo: 'prestamo_recibido', medio: 'efectivo', monto: '100000.00' },
      deuda_comision: '100000.00',
      saldos: { efectivo: '100000.00', transferencia: '0.00' },
    });
    expect(await saldos()).toEqual({ efectivo: 10000000, transferencia: 0 });
  });

  it('devoluciones parciales: restan del saldo y de la deuda', async () => {
    const { agent } = await loginComoSecretaria();
    await prestamo(agent, { tipo: 'recibido', monto: '100000', medio: 'efectivo' });
    await prestamo(agent, { tipo: 'recibido', monto: '50000', medio: 'transferencia' });

    const res = await prestamo(agent, {
      tipo: 'devolucion',
      monto: '30000',
      medio: 'transferencia',
    });

    expect(res.body.deuda_comision).toBe('120000.00');
    expect(res.body).not.toHaveProperty('advertencia');
    expect(await saldos()).toEqual({ efectivo: 10000000, transferencia: 2000000 });
    const mov = await MovimientoFondos.findOne({ where: { tipo: 'devolucion_prestamo' } });
    expect(mov.monto).toBe('-30000.00');
  });

  it('devolver más de lo que se debe → 400 DEVOLUCION_EXCEDE_DEUDA', async () => {
    const { agent } = await loginComoSecretaria();
    await prestamo(agent, { tipo: 'recibido', monto: '10000', medio: 'efectivo' });

    const res = await prestamo(agent, { tipo: 'devolucion', monto: '10000.01', medio: 'efectivo' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({
      code: 'DEVOLUCION_EXCEDE_DEUDA',
      details: { deuda: '10000.00' },
    });
  });

  it('devolver en un medio sin saldo: permitido, con advertencia', async () => {
    const { agent } = await loginComoSecretaria();
    await prestamo(agent, { tipo: 'recibido', monto: '10000', medio: 'efectivo' });

    const res = await prestamo(agent, {
      tipo: 'devolucion',
      monto: '10000',
      medio: 'transferencia',
    });
    expect(res.status).toBe(201);
    expect(res.body.advertencia).toMatchObject({ code: 'SALDO_NEGATIVO' });
    expect(res.body.deuda_comision).toBe('0.00');
  });

  it('historial con totales', async () => {
    const { agent } = await loginComoSecretaria();
    await prestamo(agent, {
      tipo: 'recibido',
      monto: '10000',
      medio: 'efectivo',
      descripcion: 'Para mercadería',
    });
    await prestamo(agent, { tipo: 'devolucion', monto: '4000', medio: 'efectivo' });

    const res = await agent.get('/api/prestamos');
    expect(res.body).toMatchObject({
      recibidos: '10000.00',
      devueltos: '4000.00',
      deuda_comision: '6000.00',
    });
    expect(res.body.movimientos.map((m) => [m.tipo, m.monto])).toEqual([
      ['devolucion', '4000.00'],
      ['recibido', '10000.00'],
    ]);
  });

  it('validaciones', async () => {
    const { agent } = await loginComoSecretaria();
    expect((await prestamo(agent, { tipo: 'regalo', monto: '1', medio: 'efectivo' })).status).toBe(
      400,
    );
    expect(
      (await prestamo(agent, { tipo: 'recibido', monto: '0', medio: 'efectivo' })).status,
    ).toBe(400);
  });
});
