// 15.3 Revisión de validaciones: a todos los endpoints se les mandan datos inválidos
// (montos negativos o cero, cantidades inválidas, textos vacíos, IDs inexistentes, tipos
// equivocados) y se verifica que respondan con un error controlado (4xx con el formato
// estándar), NUNCA con un 500.
import { describe, it, expect } from 'vitest';
import { loginComoAdmin } from '../helpers/auth.js';
import { crearProductoConVariantes } from '../helpers/factories.js';
import { listarEndpoints, conParametros } from '../helpers/endpoints.js';

const BODIES_INVALIDOS = [
  {},
  { monto: -1, medio: 'efectivo', tipo: 'recibido', concepto: 'otro' },
  { monto: 0, medio: 'efectivo', tipo: 'deposito', concepto: 'otro' },
  { monto: 'mucho', medio: 'cheque' },
  { monto: '1e9999', medio: 'efectivo', concepto: 'otro' },
  { items: [] },
  { items: [{ variante_id: 99999, cantidad: 1 }] },
  { items: [{ variante_id: 1, cantidad: 0 }] },
  { items: [{ variante_id: 1, cantidad: 1.5 }] },
  { items: [{ variante_id: 'x', cantidad: 'y' }] },
  { items: 'no es una lista' },
  { pagos: [{ medio: 'efectivo', monto: -5 }] },
  { motivo: '' },
  { motivo: '   ' },
  { nombre: '', username: '', password: '', rol: 'jefe' },
  { nombre: 'x'.repeat(5000) },
  { precio_venta: -1, costo: -1, colores: [], talles: [] },
  { venta_item_id: 99999, variante_nueva_id: 99999 },
  { variante_devuelta_id: 99999, variante_nueva_id: 99999 },
  { comprador_id: 99999, items: [{ variante_id: 1, cantidad: 1 }] },
  { activo: 'quizás' },
  [],
  'texto',
];
const IDS_INVALIDOS = [99999, 'abc', -1, 0, '1.5'];

const resumen = (metodo, ruta, body, res) =>
  `${metodo.toUpperCase()} ${ruta} ${JSON.stringify(body)?.slice(0, 60)} → ${res.status} ${JSON.stringify(res.body).slice(0, 120)}`;

describe('revisión de validaciones: datos inválidos nunca producen un 500', () => {
  const endpoints = listarEndpoints();

  it('POST y PATCH con bodies inválidos → 4xx con formato de error', async () => {
    const { agent } = await loginComoAdmin();
    await crearProductoConVariantes(); // que exista la variante 1 en algunos casos
    const fallas = [];

    for (const e of endpoints.filter((x) => ['post', 'patch'].includes(x.metodo))) {
      if (e.ruta.endsWith('/auth/logout')) continue;
      for (const id of [1, ...IDS_INVALIDOS]) {
        if (id !== 1 && !e.ruta.includes(':')) continue;
        for (const body of BODIES_INVALIDOS) {
          const ruta = conParametros(e.ruta, id);
          const req = agent[e.metodo](ruta);
          const res = await (typeof body === 'string'
            ? req.set('Content-Type', 'application/json').send(body)
            : req.send(body));
          const ok = res.status >= 400 && res.status < 500 && res.body?.error?.code;
          if (!ok) fallas.push(resumen(e.metodo, ruta, body, res));
        }
      }
    }
    expect(fallas).toEqual([]);
  }, 120_000);

  it('GET con IDs inexistentes o inválidos y filtros inválidos → 4xx, nunca 500', async () => {
    const { agent } = await loginComoAdmin();
    const fallas = [];
    const queries = [
      '',
      '?pagina=-1',
      '?desde=ayer',
      '?desde=2026-12-31&hasta=2026-01-01',
      '?por_pagina=100000',
    ];

    for (const e of endpoints.filter((x) => x.metodo === 'get')) {
      const ids = e.ruta.includes(':') ? IDS_INVALIDOS : [1];
      for (const id of ids) {
        for (const q of queries) {
          const ruta = conParametros(e.ruta, id) + q;
          const res = await agent.get(ruta);
          if (res.status >= 500) fallas.push(resumen('get', ruta, null, res));
          if (e.ruta.includes(':') && res.status < 400)
            fallas.push(resumen('get', ruta, null, res));
        }
      }
    }
    expect(fallas).toEqual([]);
  }, 120_000);
});
