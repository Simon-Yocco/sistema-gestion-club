import { describe, it, expect } from 'vitest';
import {
  totalVigente,
  pagadoNeto,
  deuda,
  estadoPago,
  ganancia,
  resumen,
} from '../../src/modules/ventas/ventaCalculos.js';

const item = (precio, costo, cantidad, devuelta = 0) => ({
  precio_unitario: precio,
  costo_unitario: costo,
  cantidad,
  cantidad_devuelta: devuelta,
});
const pago = (monto) => ({ monto });

// 2 remeras a $15.000 (costo $8.000) + 1 short a $9.000 (costo $4.500) = $39.000
const items = [item('15000.00', '8000.00', 2), item('9000.00', '4500.00', 1)];

describe('ventaCalculos', () => {
  it('pagada en efectivo', () => {
    const v = { items, pagos: [pago('39000.00')] };
    expect(resumen(v)).toEqual({
      total: 3900000,
      pagado: 3900000,
      deuda: 0,
      estado_pago: 'pagada',
      ganancia: 1850000, // 2×7000 + 4500
    });
  });

  it('pago mixto: efectivo + transferencia', () => {
    const v = { items, pagos: [pago('20000.00'), pago('19000.00')] };
    expect(pagadoNeto(v)).toBe(3900000);
    expect(estadoPago(v)).toBe('pagada');
  });

  it('fiado total: sin pagos → pendiente', () => {
    const v = { items, pagos: [] };
    expect(deuda(v)).toBe(3900000);
    expect(estadoPago(v)).toBe('pendiente');
  });

  it('fiado parcial → parcial', () => {
    const v = { items, pagos: [pago('10000.00')] };
    expect(deuda(v)).toBe(2900000);
    expect(estadoPago(v)).toBe('parcial');
  });

  it('cobros posteriores de fiado completan el pago', () => {
    const v = { items, pagos: [pago('10000.00'), pago('15000.00'), pago('14000.00')] };
    expect(deuda(v)).toBe(0);
    expect(estadoPago(v)).toBe('pagada');
  });

  it('devolución parcial en venta pagada: baja el total y la deuda queda negativa (a reintegrar)', () => {
    const v = {
      items: [item('15000.00', '8000.00', 2, 1), item('9000.00', '4500.00', 1)],
      pagos: [pago('39000.00')],
    };
    expect(totalVigente(v)).toBe(2400000);
    expect(deuda(v)).toBe(-1500000);
    expect(estadoPago(v)).toBe('pagada');
    expect(ganancia(v)).toBe(1150000); // 7000 + 4500
  });

  it('devolución con reintegro: el pago negativo deja la deuda en 0', () => {
    const v = {
      items: [item('15000.00', '8000.00', 2, 1), item('9000.00', '4500.00', 1)],
      pagos: [pago('39000.00'), pago('-15000.00')],
    };
    expect(pagadoNeto(v)).toBe(2400000);
    expect(deuda(v)).toBe(0);
  });

  it('devolución en venta fiada: solo baja la deuda', () => {
    const v = {
      items: [item('15000.00', '8000.00', 2, 1), item('9000.00', '4500.00', 1)],
      pagos: [pago('10000.00')],
    };
    expect(deuda(v)).toBe(1400000);
    expect(estadoPago(v)).toBe('parcial');
  });

  it('todo devuelto: total 0, ganancia 0, pagada', () => {
    const v = { items: [item('15000.00', '8000.00', 2, 2)], pagos: [] };
    expect(totalVigente(v)).toBe(0);
    expect(ganancia(v)).toBe(0);
    expect(estadoPago(v)).toBe('pagada');
  });

  it('sin errores de redondeo con centavos', () => {
    const v = { items: [item('0.10', '0.00', 1), item('0.20', '0.00', 1)], pagos: [pago('0.30')] };
    expect(totalVigente(v)).toBe(30);
    expect(deuda(v)).toBe(0);
  });

  it('ganancia puede ser negativa si se vendió por debajo del costo', () => {
    expect(ganancia({ items: [item('5000.00', '8000.00', 1)] })).toBe(-300000);
  });

  it('tolera venta sin ítems ni pagos', () => {
    expect(resumen({})).toEqual({
      total: 0,
      pagado: 0,
      deuda: 0,
      estado_pago: 'pagada',
      ganancia: 0,
    });
  });
});
