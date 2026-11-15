// 10.6 Test de consistencia global: después de una serie de operaciones mezcladas, el saldo
// por medio, el stock de cada variante y la deuda de cada venta tienen que coincidir con el
// cálculo manual y con las invariantes del sistema.
import { describe, it, expect } from 'vitest';
import { QueryTypes } from 'sequelize';
import { sequelize } from '../src/models/index.js';
import { loginComoAdmin } from './helpers/auth.js';
import { crearComprador } from './helpers/factories.js';
import { saldos } from './helpers/fondos.js';

const consulta = (sql) => sequelize.query(sql, { type: QueryTypes.SELECT });

describe('consistencia global (10.6)', () => {
  it('saldos, stock y deudas cuadran después de operaciones mezcladas', async () => {
    const { agent } = await loginComoAdmin();
    const ok = async (req, status = 201) => {
      const res = await req;
      expect(res.status, JSON.stringify(res.body)).toBe(status);
      return res.body;
    };
    const post = (url, body) => ok(agent.post(url).send(body));

    // --- Catálogo (stock 0) e ingreso de mercadería
    const crearProducto = async (nombre, precio, colores, talles) =>
      (
        await post('/api/productos', {
          nombre,
          precio_venta: precio,
          costo: '1000',
          colores,
          talles,
        })
      ).producto.grilla.celdas;
    const remera = await crearProducto('Remera', '15000', ['Azul'], ['M', 'L']);
    const buzo = await crearProducto('Buzo', '35000', ['Gris'], ['M']);
    const short = await crearProducto('Short', '9000', ['Negro'], ['L']);
    const v = {
      remeraM: remera.Azul.M.id,
      remeraL: remera.Azul.L.id,
      buzo: buzo.Gris.M.id,
      short: short.Negro.L.id,
    };
    const { ingreso } = await post('/api/ingresos', {
      items: [
        { variante_id: v.remeraM, cantidad: 10 },
        { variante_id: v.remeraL, cantidad: 10 },
        { variante_id: v.buzo, cantidad: 5 },
        { variante_id: v.short, cantidad: 8 },
      ],
    });

    const [ana, beto, caro, dani] = await Promise.all(
      ['Ana', 'Beto', 'Caro', 'Dani'].map((nombre) => crearComprador({ nombre })),
    );
    const ef = (monto) => ({ medio: 'efectivo', monto });
    const tr = (monto) => ({ medio: 'transferencia', monto });

    // --- Fondos y ventas                                             efectivo  transf.
    await post('/api/prestamos', { tipo: 'recibido', monto: '50000', medio: 'efectivo' }); // 50.000  0
    await post('/api/transferencias-medios', { tipo: 'deposito', monto: '20000' }); //  30.000  20.000

    const v1 = (
      await post('/api/ventas', {
        comprador_id: ana.id,
        items: [{ variante_id: v.remeraM, cantidad: 2 }],
        pagos: [ef('30000')],
      })
    ).venta; //                                                                    60.000  20.000

    const v2 = (
      await post('/api/ventas', {
        comprador_id: beto.id,
        items: [{ variante_id: v.buzo, cantidad: 1 }],
        pagos: [tr('10000')],
      })
    ).venta; // fiado: debe 25.000                                                 60.000  30.000
    await post(`/api/ventas/${v2.id}/pagos`, { pagos: [ef('15000')] }); // debe 10.000  75.000  30.000

    const v3 = (
      await post('/api/ventas', {
        comprador_id: caro.id,
        items: [
          { variante_id: v.short, cantidad: 1 },
          { variante_id: v.remeraL, cantidad: 1 },
        ],
        pagos: [ef('14000'), tr('10000')],
      })
    ).venta; //                                                                    89.000  40.000

    await post(`/api/ventas/${v1.id}/devoluciones`, {
      items: [{ venta_item_id: v1.items[0].id, cantidad: 1 }],
      motivo: 'Talle',
    }); // reintegra 15.000 en efectivo                                            74.000  40.000

    await post(`/api/ventas/${v3.id}/cambios`, {
      venta_item_id: v3.items[0].id, // short → remera L: +6.000
      variante_nueva_id: v.remeraL,
      pagos: [tr('6000')],
    }); //                                                                         74.000  46.000

    await post(`/api/ventas/${v2.id}/cambios`, {
      venta_item_id: v2.items[0].id, // buzo → remera M: −20.000 con deuda 10.000
      variante_nueva_id: v.remeraM,
    }); // reintegra 10.000 (último cobro: efectivo)                              64.000  46.000

    await post(`/api/ventas/${v3.id}/anular`, { motivo: 'Error' });
    // reintegra 30.000: tr 6.000 + tr 10.000 + ef 14.000                          50.000  30.000

    await post('/api/egresos', {
      monto: '8000',
      medio: 'efectivo',
      concepto: 'mercaderia',
      ingreso_mercaderia_id: ingreso.id,
    }); //                                                                         42.000  30.000
    await post('/api/transferencias-medios', { tipo: 'extraccion', monto: '5000' }); // 47.000  25.000
    await post('/api/prestamos', { tipo: 'devolucion', monto: '10000', medio: 'transferencia' }); // 47.000  15.000

    const v4 = (
      await post('/api/ventas', {
        comprador_id: dani.id,
        items: [{ variante_id: v.short, cantidad: 2 }],
      })
    ).venta; // fiado total 18.000                                                 47.000  15.000

    // ================================================================ Saldos
    expect(await saldos()).toEqual({ efectivo: 4700000, transferencia: 1500000 });
    expect(await ok(agent.get('/api/saldos'), 200)).toMatchObject({
      efectivo: '47000.00',
      transferencia: '15000.00',
      total: '62000.00',
      deuda_comision: '40000.00',
    });

    // Invariante: lo cobrado/reintegrado en pagos con medio = movimientos de ventas.
    const [{ pagos }] = await consulta(
      'SELECT COALESCE(SUM(monto), 0) AS pagos FROM pago WHERE medio IS NOT NULL',
    );
    const [{ movsVentas }] = await consulta(
      `SELECT COALESCE(SUM(monto), 0) AS movsVentas FROM movimiento_fondos
       WHERE tipo IN ('cobro_venta', 'cobro_fiado', 'cobro_diferencia_cambio',
                      'devolucion_diferencia_cambio', 'devolucion_anulacion')`,
    );
    expect(String(pagos)).toBe(String(movsVentas));

    // Invariante: el saldo total = Σ movimientos (el depósito/extracción no cambia el total).
    const [{ total }] = await consulta('SELECT SUM(monto) AS total FROM movimiento_fondos');
    expect(String(total)).toBe('62000.00');

    // ================================================================ Stock
    const stock = Object.fromEntries(
      (await consulta('SELECT id, stock FROM variante')).map((f) => [f.id, f.stock]),
    );
    expect(stock[v.remeraM]).toBe(8); // 10 − 2 + 1 (devolución) − 1 (cambio v2)
    expect(stock[v.remeraL]).toBe(10); // 10 − 1 − 1 (cambio v3) + 2 (anulación v3)
    expect(stock[v.buzo]).toBe(5); // 5 − 1 + 1 (cambio v2)
    expect(stock[v.short]).toBe(6); // 8 − 1 + 1 (cambio v3) − 2 (v4)

    // Invariante: stock = ingresos − vendidos + devueltos (+ devueltas en cambios sin venta).
    const esperado = await consulta(
      `SELECT v.id,
         COALESCE((SELECT SUM(cantidad) FROM ingreso_item WHERE variante_id = v.id), 0)
         - COALESCE((SELECT SUM(cantidad) FROM venta_item WHERE variante_id = v.id), 0)
         + COALESCE((SELECT SUM(cantidad_devuelta) FROM venta_item WHERE variante_id = v.id), 0)
         + COALESCE((SELECT SUM(cantidad_devuelta) FROM cambio
                     WHERE variante_devuelta_id = v.id AND venta_item_devuelto_id IS NULL), 0)
         AS stock
       FROM variante v`,
    );
    for (const { id, stock: calculado } of esperado) {
      expect(stock[id], `variante ${id}`).toBe(Number(calculado));
    }

    // ================================================================ Deudas
    const deuda = async (venta) => (await ok(agent.get(`/api/ventas/${venta.id}`), 200)).venta;
    expect(await deuda(v1)).toMatchObject({ total: '15000.00', pagado: '15000.00', deuda: '0.00' });
    expect(await deuda(v2)).toMatchObject({ total: '15000.00', pagado: '15000.00', deuda: '0.00' });
    expect(await deuda(v3)).toMatchObject({ estado: 'anulada', total: '0.00', pagado: '0.00' });
    expect(await deuda(v4)).toMatchObject({ total: '18000.00', deuda: '18000.00' });

    const deudores = await ok(agent.get('/api/deudores'), 200);
    expect(deudores.deudores.map((d) => [d.comprador.nombre, d.deuda])).toEqual([
      ['Dani', '18000.00'],
    ]);
    expect(deudores.total_adeudado).toBe('18000.00');

    // El ingreso quedó parcialmente pagado con el egreso.
    const detalleIngreso = await ok(agent.get(`/api/ingresos/${ingreso.id}`), 200);
    expect(detalleIngreso.ingreso).toMatchObject({ pagado: '8000.00', estado_pago: 'parcial' });
  });
});
