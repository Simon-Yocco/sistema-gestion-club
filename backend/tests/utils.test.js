import { describe, it, expect } from 'vitest';
import {
  ordenarTalles,
  normalizarColor,
  normalizarTalle,
  claveTexto,
} from '../src/utils/talles.js';
import { dineroSchema, dineroNoNegativo, dineroPositivo } from '../src/utils/schemas.js';

describe('talles', () => {
  it('ordena letras, luego números y luego el resto', () => {
    expect(ordenarTalles(['XL', '40', 'S', 'Único', 'M', '38', 'XS', 'L', 'XXL'])).toEqual([
      'XS',
      'S',
      'M',
      'L',
      'XL',
      'XXL',
      '38',
      '40',
      'Único',
    ]);
  });

  it('normaliza talle y color', () => {
    expect(normalizarTalle(' xl ')).toBe('XL');
    expect(normalizarColor('  azul   marino ')).toBe('Azul marino');
    expect(claveTexto('Azúl ')).toBe(claveTexto('azul'));
  });
});

describe('dineroSchema', () => {
  it.each([
    ['15000', 1500000],
    ['15000.5', 1500050],
    [15000.5, 1500050],
    [' 0.99 ', 99],
  ])('%s → %i centavos', (entrada, esperado) => {
    expect(dineroSchema.parse(entrada)).toBe(esperado);
  });

  it.each(['15.000', '1,5', '1.234', 'abc', '', '1e3'])('rechaza %s', (entrada) => {
    expect(dineroSchema.safeParse(entrada).success).toBe(false);
  });

  it('variantes no negativo y positivo', () => {
    expect(dineroNoNegativo.safeParse('0').success).toBe(true);
    expect(dineroNoNegativo.safeParse('-1').success).toBe(false);
    expect(dineroPositivo.safeParse('0').success).toBe(false);
    expect(dineroPositivo.safeParse('0.01').success).toBe(true);
  });
});
