import { describe, it, expect } from 'vitest';
import { toCents, fromCents, sum, add, subtract, multiply, formatARS } from '../src/utils/money.js';

describe('toCents', () => {
  it.each([
    ['15000.00', 1500000],
    ['15000.5', 1500050],
    ['15000', 1500000],
    ['0.01', 1],
    ['0.10', 10],
    ['-250.75', -25075],
    ['  99.99 ', 9999],
    ['9999999999.99', 999999999999],
  ])('string %s → %i', (entrada, esperado) => {
    expect(toCents(entrada)).toBe(esperado);
  });

  it.each([
    [15000, 1500000],
    [0.1, 10],
    [0.29, 29], // 0.29 * 100 = 28.999999999999996 en float
    [1.13, 113],
    [19.99, 1999],
    [-3.5, -350],
  ])('number %d → %i sin errores de float', (entrada, esperado) => {
    expect(toCents(entrada)).toBe(esperado);
  });

  it.each([
    ['1.005', 101],
    ['1.004', 100],
    ['2.675', 268], // 2.675 en float es 2.67499999...
    [2.675, 268],
    ['-1.005', -101],
    ['0.999', 100],
    ['0.001', 0],
    ['-0.001', 0],
  ])('redondeo a 2 decimales: %s → %i', (entrada, esperado) => {
    expect(toCents(entrada)).toBe(esperado);
  });

  it('no devuelve -0', () => {
    expect(Object.is(toCents('-0.00'), 0)).toBe(true);
  });

  it.each(['', 'abc', '1,50', '1.2.3', '$100', null, undefined, NaN, Infinity, {}])(
    'rechaza %s',
    (entrada) => {
      expect(() => toCents(entrada)).toThrow(TypeError);
    },
  );
});

describe('fromCents', () => {
  it.each([
    [1500050, '15000.50'],
    [1, '0.01'],
    [10, '0.10'],
    [0, '0.00'],
    [-25075, '-250.75'],
    [-5, '-0.05'],
  ])('%i → %s', (entrada, esperado) => {
    expect(fromCents(entrada)).toBe(esperado);
  });

  it('ida y vuelta con DECIMAL', () => {
    for (const s of ['0.00', '0.01', '15000.50', '-250.75', '9999999999.99']) {
      expect(fromCents(toCents(s))).toBe(s);
    }
  });

  it('rechaza valores no enteros', () => {
    expect(() => fromCents(10.5)).toThrow(TypeError);
    expect(() => fromCents('100')).toThrow(TypeError);
  });
});

describe('operaciones', () => {
  it('sum acepta argumentos o array', () => {
    expect(sum(10, 20, 30)).toBe(60);
    expect(sum([10, 20, 30])).toBe(60);
    expect(sum([])).toBe(0);
  });

  it('0.10 + 0.20 da exactamente 0.30', () => {
    expect(add(toCents(0.1), toCents(0.2))).toBe(toCents('0.30'));
  });

  it('subtract puede dar negativo', () => {
    expect(subtract(1000, 1500)).toBe(-500);
  });

  it('multiply precio × cantidad', () => {
    expect(multiply(1500000, 3)).toBe(4500000);
    expect(() => multiply(1500000, 1.5)).toThrow(TypeError);
  });

  it('las operaciones rechazan valores que no son centavos', () => {
    expect(() => sum(1, 0.5)).toThrow(TypeError);
    expect(() => add('10', 1)).toThrow(TypeError);
    expect(() => subtract(1, NaN)).toThrow(TypeError);
  });
});

describe('formatARS', () => {
  it.each([
    [1500000, '$ 15.000,00'],
    [1500050, '$ 15.000,50'],
    [99, '$ 0,99'],
    [0, '$ 0,00'],
    [123456789, '$ 1.234.567,89'],
    [-1500000, '-$ 15.000,00'],
  ])('%i → %s', (entrada, esperado) => {
    expect(formatARS(entrada)).toBe(esperado);
  });
});
