import { describe, it, expect } from 'vitest';
import { sequelize, Pago, MovimientoFondos } from '../../src/models/index.js';
import {
  reintegrar,
  proponerReintegro,
  resolverReintegros,
  pagadoPorMedio,
} from '../../src/modules/devoluciones/reintegro.service.js';
import { crearUsuario } from '../helpers/factories.js';

const pago = (id, medio, monto, tipo = 'cobro') => ({ id, medio, monto, tipo });

describe('reintegroService', () => {
  it('reintegrar crea pago negativo y movimiento negativo en el mismo medio', async () => {
    const usuario = await crearUsuario();
    const { Venta } = await import('../../src/models/index.js');
    const venta = await Venta.create({ usuario_id: usuario.id });

    await sequelize.transaction((t) =>
      reintegrar(
        venta,
        [
          { medio: 'efectivo', monto: 500000 },
          { medio: 'transferencia', monto: 100000 },
        ],
        'devolucion_anulacion',
        usuario,
        t,
      ),
    );

    const pagos = await Pago.findAll({ order: [['id', 'ASC']] });
    expect(pagos.map((p) => [p.medio, p.monto, p.tipo])).toEqual([
      ['efectivo', '-5000.00', 'devolucion'],
      ['transferencia', '-1000.00', 'devolucion'],
    ]);
    const movs = await MovimientoFondos.findAll({ order: [['id', 'ASC']] });
    expect(movs.map((m) => [m.medio, m.monto, m.tipo, m.referencia_id])).toEqual([
      ['efectivo', '-5000.00', 'devolucion_anulacion', pagos[0].id],
      ['transferencia', '-1000.00', 'devolucion_anulacion', pagos[1].id],
    ]);
  });

  it('pagadoPorMedio descuenta los reintegros', () => {
    const venta = {
      pagos: [
        pago(1, 'efectivo', '10000.00'),
        pago(2, 'transferencia', '5000.00'),
        pago(3, 'efectivo', '-2000.00', 'devolucion'),
      ],
    };
    expect(pagadoPorMedio(venta)).toEqual({ efectivo: 800000, transferencia: 500000 });
  });

  describe('proponerReintegro (8.4: lo mismo que se cobró, del cobro más reciente)', () => {
    const venta = {
      pagos: [pago(1, 'efectivo', '10000.00'), pago(2, 'transferencia', '5000.00')],
    };

    it('todo lo cobrado → cada medio lo suyo', () => {
      expect(proponerReintegro(venta, 1500000)).toEqual([
        { medio: 'efectivo', monto: 1000000 },
        { medio: 'transferencia', monto: 500000 },
      ]);
    });

    it('una parte → primero el medio del último cobro', () => {
      expect(proponerReintegro(venta, 600000)).toEqual([
        { medio: 'efectivo', monto: 100000 },
        { medio: 'transferencia', monto: 500000 },
      ]);
      expect(proponerReintegro(venta, 300000)).toEqual([{ medio: 'transferencia', monto: 300000 }]);
    });

    it('tiene en cuenta reintegros anteriores', () => {
      const conReintegro = {
        pagos: [...venta.pagos, pago(3, 'transferencia', '-5000.00', 'devolucion')],
      };
      expect(proponerReintegro(conReintegro, 400000)).toEqual([
        { medio: 'efectivo', monto: 400000 },
      ]);
    });

    it('monto 0 → nada', () => {
      expect(proponerReintegro(venta, 0)).toEqual([]);
    });
  });

  describe('resolverReintegros', () => {
    const venta = { pagos: [pago(1, 'efectivo', '10000.00')] };

    it('sin indicar → propuesta por defecto', () => {
      expect(resolverReintegros(venta, 300000, undefined)).toEqual([
        { medio: 'efectivo', monto: 300000 },
      ]);
    });

    it('indicado por el usuario (puede ser otro medio) si suma exacto', () => {
      const indicados = [
        { medio: 'transferencia', monto: 200000 },
        { medio: 'efectivo', monto: 100000 },
      ];
      expect(resolverReintegros(venta, 300000, indicados)).toEqual(indicados);
    });

    it('si no suma exacto → REINTEGRO_NO_COINCIDE', () => {
      expect(() => resolverReintegros(venta, 300000, [{ medio: 'efectivo', monto: 1 }])).toThrow(
        expect.objectContaining({ code: 'REINTEGRO_NO_COINCIDE' }),
      );
      expect(() => resolverReintegros(venta, 0, [{ medio: 'efectivo', monto: 1 }])).toThrow(
        expect.objectContaining({ code: 'REINTEGRO_NO_COINCIDE' }),
      );
    });
  });
});
