import { describe, it, expect } from 'vitest';
import { aCSV } from '../../src/utils/csv.js';

const BOM = String.fromCharCode(0xfeff);
import { loginComoAdmin } from '../helpers/auth.js';
import { crearProductoConVariantes } from '../helpers/factories.js';

describe('aCSV', () => {
  it('separador ;, coma decimal en montos, comillas cuando hace falta y BOM', () => {
    const csv = aCSV(
      ['producto', 'unidades', 'total', 'margen_pct', 'motivo'],
      [
        {
          producto: 'Remera',
          unidades: 3,
          total: '45000.50',
          margen_pct: 46.7,
          motivo: 'Talle; chico',
        },
        { producto: 'Buzo "Club"', unidades: 1, total: '-100.00', margen_pct: null, motivo: null },
      ],
    );
    expect(csv).toBe(
      '' +
        BOM +
        'producto;unidades;total;margen_pct;motivo\r\n' +
        'Remera;3;45000,50;46,7;"Talle; chico"\r\n' +
        '"Buzo ""Club""";1;-100,00;;\r\n',
    );
  });

  it('las fechas y textos con punto no se tocan', () => {
    expect(aCSV(['fecha', 'talle'], [{ fecha: '2026-11-14', talle: '38.5' }])).toContain(
      '2026-11-14;38.5',
    );
  });
});

describe('?formato=csv en los reportes', () => {
  it('descarga el detalle como archivo CSV', async () => {
    const { agent } = await loginComoAdmin();
    await crearProductoConVariantes({
      nombre: 'Remera',
      precio_venta: '15000.00',
      costo: '8000.50',
      colores: ['Azul'],
      talles: ['M'],
      stock: 2,
    });

    const res = await agent.get('/api/reportes/stock-valorizado?formato=csv');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/^text\/csv/);
    expect(res.headers['content-disposition']).toMatch(
      /^attachment; filename="?stock-valorizado_inicio_hoy.csv/,
    );
    expect(res.text).toBe(
      '' +
        BOM +
        'producto;color;talle;unidades;valor_costo;valor_venta\r\n' +
        'Remera;Azul;M;2;16001,00;30000,00\r\n',
    );
  });

  it('todos los reportes aceptan CSV, con el período en el nombre del archivo', async () => {
    const { agent } = await loginComoAdmin();
    for (const ruta of [
      'ventas',
      'ventas-por-medio',
      'ganancia',
      'stock-valorizado',
      'devoluciones',
      'egresos',
      'comision',
      'depositos',
    ]) {
      const res = await agent.get(
        `/api/reportes/${ruta}?formato=csv&desde=2026-11-01&hasta=2026-11-30`,
      );
      expect(res.status, ruta).toBe(200);
      expect(res.headers['content-disposition']).toContain(`${ruta}_2026-11-01_2026-11-30.csv`);
    }
    expect((await agent.get('/api/reportes/ventas?formato=pdf')).status).toBe(400);
  });
});
