import { describe, it, expect } from 'vitest';
import { MovimientoFondos, TransferenciaMedios } from '../../src/models/index.js';
import { loginComoSecretaria } from '../helpers/auth.js';
import { saldos } from '../helpers/fondos.js';

const registrar = (agent, body) => agent.post('/api/transferencias-medios').send(body);

describe('POST /api/transferencias-medios', () => {
  it('depósito: −monto en efectivo, +monto en transferencia, el total no cambia', async () => {
    const { agent } = await loginComoSecretaria();
    await agent
      .post('/api/prestamos')
      .send({ tipo: 'recibido', monto: '50000', medio: 'efectivo' });
    const antes = await saldos();

    const res = await registrar(agent, {
      tipo: 'deposito',
      monto: '30000',
      comprobante: 'BOL-77',
    });

    expect(res.status).toBe(201);
    expect(res.body.transferencia).toMatchObject({
      tipo: 'deposito',
      monto: '30000.00',
      comprobante: 'BOL-77',
    });
    expect(res.body.saldos).toEqual({ efectivo: '20000.00', transferencia: '30000.00' });
    expect(res.body).not.toHaveProperty('advertencia');

    const despues = await saldos();
    expect(despues.efectivo).toBe(antes.efectivo - 3000000);
    expect(despues.transferencia).toBe(antes.transferencia + 3000000);
    expect(despues.efectivo + despues.transferencia).toBe(antes.efectivo + antes.transferencia);

    const movs = await MovimientoFondos.findAll({
      where: { tipo: 'deposito_bancario' },
      order: [['id', 'ASC']],
    });
    expect(movs.map((m) => [m.medio, m.monto, m.referencia_tipo, m.referencia_id])).toEqual([
      ['efectivo', '-30000.00', 'transferencia_medios', res.body.transferencia.id],
      ['transferencia', '30000.00', 'transferencia_medios', res.body.transferencia.id],
    ]);
  });

  it('extracción: −monto en transferencia, +monto en efectivo', async () => {
    const { agent } = await loginComoSecretaria();
    await agent
      .post('/api/prestamos')
      .send({ tipo: 'recibido', monto: '20000', medio: 'transferencia' });

    const res = await registrar(agent, { tipo: 'extraccion', monto: '5000' });

    expect(res.body.saldos).toEqual({ efectivo: '5000.00', transferencia: '15000.00' });
    const tipos = (await MovimientoFondos.findAll({ where: { tipo: 'extraccion_bancaria' } })).map(
      (m) => m.medio,
    );
    expect(tipos.sort()).toEqual(['efectivo', 'transferencia']);
  });

  it('si el medio de origen queda negativo: no bloquea, avisa', async () => {
    const { agent } = await loginComoSecretaria();
    const res = await registrar(agent, { tipo: 'deposito', monto: '1000' });
    expect(res.status).toBe(201);
    expect(res.body.advertencia).toMatchObject({ code: 'SALDO_NEGATIVO', medios: ['efectivo'] });
    expect(await saldos()).toEqual({ efectivo: -100000, transferencia: 100000 });
  });

  it('monto ≤ 0 o tipo inválido → 400 y no se guarda nada', async () => {
    const { agent } = await loginComoSecretaria();
    for (const body of [
      { tipo: 'deposito', monto: '0' },
      { tipo: 'deposito', monto: '-5' },
      { tipo: 'transferencia', monto: '5' },
    ]) {
      expect((await registrar(agent, body)).status).toBe(400);
    }
    expect(await TransferenciaMedios.count()).toBe(0);
    expect(await MovimientoFondos.count()).toBe(0);
  });
});

describe('GET /api/transferencias-medios', () => {
  it('lista con filtros por fecha y tipo, y totales por tipo', async () => {
    const { agent } = await loginComoSecretaria();
    await registrar(agent, { fecha: '2026-11-01', tipo: 'deposito', monto: '1000' });
    await registrar(agent, { fecha: '2026-11-05', tipo: 'extraccion', monto: '300' });
    await registrar(agent, { fecha: '2026-11-10', tipo: 'deposito', monto: '2000' });

    const todo = await agent.get('/api/transferencias-medios');
    expect(todo.body.transferencias.map((t) => t.fecha)).toEqual([
      '2026-11-10',
      '2026-11-05',
      '2026-11-01',
    ]);
    expect(todo.body).toMatchObject({ total_depositos: '3000.00', total_extracciones: '300.00' });

    const depositos = await agent.get('/api/transferencias-medios?tipo=deposito&desde=2026-11-02');
    expect(depositos.body.transferencias.map((t) => t.monto)).toEqual(['2000.00']);
    expect(depositos.body).toMatchObject({
      total_depositos: '2000.00',
      total_extracciones: '0.00',
    });
  });
});
