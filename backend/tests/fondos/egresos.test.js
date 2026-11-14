import { describe, it, expect } from 'vitest';
import { MovimientoFondos, Egreso, IngresoMercaderia } from '../../src/models/index.js';
import { hoyArgentina } from '../../src/utils/fechas.js';
import { loginComoSecretaria, loginComoAdmin } from '../helpers/auth.js';
import { saldos } from '../helpers/fondos.js';

/** Carga saldo inicial con un préstamo recibido directo en la base (10.3 todavía no se usa acá). */
async function saldoInicial(usuario, efectivo) {
  await MovimientoFondos.create({
    medio: 'efectivo',
    monto: efectivo,
    tipo: 'saldo_inicial',
    usuario_id: usuario.id,
  });
}

describe('POST /api/egresos', () => {
  it('con saldo suficiente: registra el egreso y un movimiento negativo, sin advertencia', async () => {
    const { agent, usuario } = await loginComoSecretaria();
    await saldoInicial(usuario, '50000.00');

    const res = await agent.post('/api/egresos').send({
      monto: '12000',
      medio: 'efectivo',
      concepto: 'otro',
      descripcion: 'Bolsas',
      comprobante: 'F-123',
    });

    expect(res.status).toBe(201);
    expect(res.body.egreso).toMatchObject({
      fecha: hoyArgentina(),
      monto: '12000.00',
      medio: 'efectivo',
      concepto: 'otro',
      descripcion: 'Bolsas',
      comprobante: 'F-123',
      ingreso_mercaderia_id: null,
    });
    expect(res.body.saldos).toEqual({ efectivo: '38000.00', transferencia: '0.00' });
    expect(res.body).not.toHaveProperty('advertencia');

    const mov = await MovimientoFondos.findOne({ where: { tipo: 'egreso' } });
    expect(mov).toMatchObject({
      medio: 'efectivo',
      monto: '-12000.00',
      referencia_tipo: 'egreso',
      referencia_id: res.body.egreso.id,
    });
  });

  it('sin saldo suficiente: NO bloquea, pero avisa SALDO_NEGATIVO', async () => {
    const { agent } = await loginComoSecretaria();

    const res = await agent
      .post('/api/egresos')
      .send({ monto: '5000', medio: 'transferencia', concepto: 'otro' });

    expect(res.status).toBe(201);
    expect(res.body.advertencia).toMatchObject({
      code: 'SALDO_NEGATIVO',
      medios: ['transferencia'],
    });
    expect(res.body.saldos.transferencia).toBe('-5000.00');
    expect(await saldos()).toEqual({ efectivo: 0, transferencia: -500000 });
  });

  it('egreso de mercadería que referencia el ingreso que paga', async () => {
    const { agent, usuario } = await loginComoAdmin();
    const ingreso = await IngresoMercaderia.create({ fecha: '2026-11-01', usuario_id: usuario.id });

    const res = await agent.post('/api/egresos').send({
      fecha: '2026-11-02',
      monto: '80000',
      medio: 'transferencia',
      concepto: 'mercaderia',
      ingreso_mercaderia_id: ingreso.id,
    });
    expect(res.status).toBe(201);
    expect(res.body.egreso).toMatchObject({
      fecha: '2026-11-02',
      ingreso_mercaderia_id: ingreso.id,
    });

    // y el ingreso queda pagado
    const det = await agent.get(`/api/ingresos/${ingreso.id}`);
    expect(det.body.ingreso.pagado).toBe('80000.00');
  });

  it('validaciones', async () => {
    const { agent } = await loginComoSecretaria();
    const casos = [
      [{ monto: '0', medio: 'efectivo', concepto: 'otro' }, 'VALIDACION'],
      [{ monto: '-10', medio: 'efectivo', concepto: 'otro' }, 'VALIDACION'],
      [{ monto: '10', medio: 'cheque', concepto: 'otro' }, 'VALIDACION'],
      [{ monto: '10', medio: 'efectivo', concepto: 'sueldos' }, 'VALIDACION'],
      [{ monto: '10', medio: 'efectivo', concepto: 'otro', fecha: '2999-01-01' }, 'VALIDACION'],
      [
        { monto: '10', medio: 'efectivo', concepto: 'otro', ingreso_mercaderia_id: 1 },
        'VALIDACION',
      ],
      [
        { monto: '10', medio: 'efectivo', concepto: 'mercaderia', ingreso_mercaderia_id: 99999 },
        'INGRESO_NO_ENCONTRADO',
      ],
    ];
    for (const [body, code] of casos) {
      const res = await agent.post('/api/egresos').send(body);
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect(res.body.error.code).toBe(code);
    }
    expect(await Egreso.count()).toBe(0);
    expect(await MovimientoFondos.count()).toBe(0);
  });
});

describe('GET /api/egresos', () => {
  it('lista con filtros por fecha, concepto y medio, con el total filtrado', async () => {
    const { agent } = await loginComoSecretaria();
    const crear = (fecha, monto, medio, concepto) =>
      agent.post('/api/egresos').send({ fecha, monto, medio, concepto }).expect(201);
    await crear('2026-11-01', '1000', 'efectivo', 'otro');
    await crear('2026-11-05', '2000', 'transferencia', 'mercaderia');
    await crear('2026-11-10', '3000', 'efectivo', 'mercaderia');

    const todos = await agent.get('/api/egresos');
    expect(todos.body.egresos.map((e) => e.fecha)).toEqual([
      '2026-11-10',
      '2026-11-05',
      '2026-11-01',
    ]);
    expect(todos.body.total).toBe('6000.00');
    expect(todos.body.paginacion.total).toBe(3);

    const merca = await agent.get('/api/egresos?concepto=mercaderia');
    expect(merca.body.total).toBe('5000.00');

    const efectivo = await agent.get('/api/egresos?medio=efectivo&desde=2026-11-02');
    expect(efectivo.body.egresos.map((e) => e.monto)).toEqual(['3000.00']);
    expect(efectivo.body.total).toBe('3000.00');

    const vacio = await agent.get('/api/egresos?desde=2026-12-01');
    expect(vacio.body).toMatchObject({ egresos: [], total: '0.00' });
  });
});
