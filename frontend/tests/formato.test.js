import { describe, it, expect } from 'vitest';
import {
  formatearPesos,
  aCentavos,
  desdeCentavos,
  formatearFecha,
  formatearFechaHora,
  hoy,
  partesFecha,
} from '../src/utils/formato.js';

describe('formatearPesos', () => {
  it.each([
    ['15000.50', '$ 15.000,50'],
    ['15000.00', '$ 15.000,00'],
    ['0.99', '$ 0,99'],
    ['-2500.00', '-$ 2.500,00'],
    ['1234567.89', '$ 1.234.567,89'],
  ])('%s → %s', (entrada, esperado) => {
    expect(formatearPesos(entrada)).toBe(esperado);
  });

  it('desde centavos y vacíos', () => {
    expect(formatearPesos(1500050, { centavos: true })).toBe('$ 15.000,50');
    expect(formatearPesos(null)).toBe('');
  });
});

describe('aCentavos', () => {
  it.each([
    ['15000.50', 1500050], // formato API
    ['15.000,50', 1500050], // formato argentino
    ['15000,5', 1500050],
    ['$ 15.000', 1500000],
    ['15000', 1500000],
    ['0,99', 99],
    ['-100,00', -10000],
  ])('%s → %i', (entrada, esperado) => {
    expect(aCentavos(entrada)).toBe(esperado);
  });

  it.each(['', 'abc', '1,2,3', '15.00.0', '1,234'])('%s → null', (entrada) => {
    expect(aCentavos(entrada)).toBeNull();
  });

  it('ida y vuelta con la API', () => {
    expect(desdeCentavos(aCentavos('15.000,50'))).toBe('15000.50');
    expect(desdeCentavos(-5)).toBe('-0.05');
  });
});

describe('fechas en hora de Argentina', () => {
  it('fecha de calendario y fecha con hora', () => {
    expect(formatearFecha('2026-11-14')).toBe('14/11/2026');
    // 02:30 UTC del 15/11 = 23:30 del 14/11 en Argentina
    expect(formatearFecha('2026-11-15T02:30:00.000Z')).toBe('14/11/2026');
    expect(formatearFechaHora('2026-11-15T02:30:00.000Z')).toBe('14/11/2026 23:30');
    expect(partesFecha('2026-11-15T02:30:00.000Z')).toEqual({
      dia: 'Sábado',
      fecha: '14/11/2026',
      hora: '23:30',
    });
  });

  it('hoy usa el día de Argentina', () => {
    expect(hoy(new Date('2026-11-15T02:30:00Z'))).toBe('2026-11-14');
  });
});
