import { describe, it, expect } from 'vitest';
import { Venta } from '../src/models/index.js';
import { diasDesde } from '../src/utils/fechas.js';
import { loginComoSecretaria } from './helpers/auth.js';
import { crearProductoConVariantes, crearComprador } from './helpers/factories.js';

const DIA = 24 * 60 * 60 * 1000;
const haceDias = (n) => new Date(Date.now() - n * DIA);

/**
 * Ana: debe $15.000 desde hace 30 días + $5.000 desde hace 2 días (2 ventas impagas).
 * Beto: debe $25.000 desde hace 10 días.
 * Caro: pagó todo. Dani: debía pero la venta está anulada.
 */
async function escenario(agent) {
  const { variantes } = await crearProductoConVariantes({ precio_venta: '5000.00', stock: 100 });
  const v = variantes[0].id;
  const [ana, beto, caro, dani] = await Promise.all(
    ['Ana', 'Beto', 'Caro', 'Dani'].map((nombre) => crearComprador({ nombre })),
  );
  const vender = async (comprador, cantidad, pagado, dias) => {
    const venta = (
      await agent.post('/api/ventas').send({
        comprador_id: comprador.id,
        items: [{ variante_id: v, cantidad }],
        pagos: pagado ? [{ medio: 'efectivo', monto: pagado }] : [],
      })
    ).body.venta;
    await Venta.update({ fecha: haceDias(dias) }, { where: { id: venta.id } });
    return venta;
  };

  await vender(ana, 3, null, 30);
  await vender(ana, 2, '5000', 2);
  await vender(beto, 5, null, 10);
  await vender(caro, 1, '5000', 40);
  const anulada = await vender(dani, 1, null, 50);
  await Venta.update({ estado: 'anulada' }, { where: { id: anulada.id } });
  return { ana, beto };
}

describe('GET /api/deudores', () => {
  it('lista compradores con deuda, monto, ventas impagas y antigüedad (más vieja primero)', async () => {
    const { agent } = await loginComoSecretaria();
    const { ana, beto } = await escenario(agent);

    const res = await agent.get('/api/deudores');

    expect(res.status).toBe(200);
    expect(res.body.deudores.map((d) => [d.comprador.nombre, d.deuda, d.ventas_impagas])).toEqual([
      ['Ana', '20000.00', 2],
      ['Beto', '25000.00', 1],
    ]);
    expect(res.body.deudores[0].comprador).toMatchObject({ id: ana.id, telefono: ana.telefono });
    expect(res.body.deudores[0].antiguedad_dias).toBe(30);
    expect(res.body.deudores[1]).toMatchObject({ comprador: { id: beto.id }, antiguedad_dias: 10 });
    expect(res.body.total_adeudado).toBe('45000.00');
    expect(res.body.cantidad).toBe(2);
  });

  it('ordena por monto', async () => {
    const { agent } = await loginComoSecretaria();
    await escenario(agent);
    const res = await agent.get('/api/deudores?orden=monto');
    expect(res.body.deudores.map((d) => d.comprador.nombre)).toEqual(['Beto', 'Ana']);
  });

  it('sin deudores: lista vacía; orden inválido → 400', async () => {
    const { agent } = await loginComoSecretaria();
    const res = await agent.get('/api/deudores');
    expect(res.body).toEqual({ deudores: [], total_adeudado: '0.00', cantidad: 0 });
    expect((await agent.get('/api/deudores?orden=nombre')).status).toBe(400);
  });
});

describe('diasDesde', () => {
  it('cuenta días de calendario en hora argentina', () => {
    const ahora = new Date('2026-11-14T15:00:00Z'); // 14/11 12:00 en Argentina
    expect(diasDesde(new Date('2026-11-14T03:30:00Z'), ahora)).toBe(0); // 14/11 00:30 AR
    expect(diasDesde(new Date('2026-11-14T02:30:00Z'), ahora)).toBe(1); // 13/11 23:30 AR
    expect(diasDesde(new Date('2026-10-15T15:00:00Z'), ahora)).toBe(30);
  });
});

describe('GET /api/clientes', () => {
  it('lista todos los compradores con su deuda (0 si no deben), compras y última compra', async () => {
    const { agent } = await loginComoSecretaria();
    const { ana, beto } = await escenario(agent);
    await crearComprador({ nombre: 'Eli' }); // nunca compró

    const res = await agent.get('/api/clientes');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ cantidad: 5, deudores: 2, total_adeudado: '45000.00' });
    expect(res.body.clientes.map((c) => [c.comprador.nombre, c.deuda, c.compras])).toEqual([
      ['Ana', '20000.00', 2],
      ['Beto', '25000.00', 1],
      ['Caro', '0.00', 1],
      ['Dani', '0.00', 0], // su única venta está anulada
      ['Eli', '0.00', 0],
    ]);
    const eli = res.body.clientes[4];
    expect(eli).toMatchObject({ ultima_compra: null, deuda_desde: null, antiguedad_dias: null });
    expect(res.body.clientes[0]).toMatchObject({ comprador: { id: ana.id }, antiguedad_dias: 30 });
    expect(res.body.clientes[1].comprador.id).toBe(beto.id);
  });

  it('filtro solo deudores, búsqueda y orden por monto', async () => {
    const { agent } = await loginComoSecretaria();
    await escenario(agent);

    const deudores = await agent.get('/api/clientes?solo_deudores=true&orden=monto');
    expect(deudores.body.clientes.map((c) => c.comprador.nombre)).toEqual(['Beto', 'Ana']);

    const busqueda = await agent.get('/api/clientes?q=car');
    expect(busqueda.body.clientes.map((c) => c.comprador.nombre)).toEqual(['Caro']);

    expect((await agent.get('/api/clientes?orden=cualquiera')).status).toBe(400);
  });
});
