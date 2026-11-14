// 14.4 Inicio del administrador: saldos, deuda con la comisión, ventas del día y del mes,
// total adeudado por fiado y productos con poco stock.
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { obtenerReporte } from '../../api/admin.js';
import { consultarStock, listarDeudores } from '../../api/recursos.js';
import { IndicadorSaldos } from '../../features/fondos/Saldos.jsx';
import { formatearPesos, hoy } from '../../utils/formato.js';

const POCO_STOCK = 2;

function Tarjeta({ titulo, valor, detalle, a }) {
  const contenido = (
    <>
      <span>{titulo}</span>
      <strong>{valor ?? '…'}</strong>
      {detalle && <small>{detalle}</small>}
    </>
  );
  return a ? (
    <Link to={a} className="tarjeta">
      {contenido}
    </Link>
  ) : (
    <div className="tarjeta">{contenido}</div>
  );
}

export function DashboardPage() {
  const dia = hoy();
  const inicioMes = `${dia.slice(0, 8)}01`;
  const ventasHoy = useQuery({
    queryKey: ['reporte', 'ventas', dia, dia],
    queryFn: () => obtenerReporte('ventas', { desde: dia, hasta: dia }),
  });
  const ventasMes = useQuery({
    queryKey: ['reporte', 'ventas', inicioMes, dia],
    queryFn: () => obtenerReporte('ventas', { desde: inicioMes, hasta: dia }),
  });
  const deudores = useQuery({
    queryKey: ['deudores', 'antiguedad'],
    queryFn: () => listarDeudores('antiguedad'),
  });
  const stock = useQuery({ queryKey: ['stock', 'dashboard'], queryFn: () => consultarStock({}) });
  const poco = stock.data?.filas.filter((f) => f.stock <= POCO_STOCK) ?? [];

  return (
    <section>
      <h1>Inicio</h1>
      <IndicadorSaldos />
      <div className="tarjetas">
        <Tarjeta
          titulo="Ventas de hoy"
          valor={ventasHoy.data && formatearPesos(ventasHoy.data.total)}
          detalle={
            ventasHoy.data &&
            `${ventasHoy.data.cantidad_ventas} ventas · ${ventasHoy.data.unidades} prendas`
          }
          a="/ventas"
        />
        <Tarjeta
          titulo="Ventas del mes"
          valor={ventasMes.data && formatearPesos(ventasMes.data.total)}
          detalle={
            ventasMes.data &&
            `${ventasMes.data.cantidad_ventas} ventas · ${ventasMes.data.unidades} prendas`
          }
          a="/reportes"
        />
        <Tarjeta
          titulo="Fiado pendiente"
          valor={deudores.data && formatearPesos(deudores.data.total_adeudado)}
          detalle={deudores.data && `${deudores.data.cantidad} personas`}
          a="/deudores"
        />
      </div>

      <h2>Poco stock (≤ {POCO_STOCK})</h2>
      {stock.data && poco.length === 0 && <p>Todo con stock suficiente.</p>}
      <ul className="poco-stock">
        {poco.map((f) => (
          <li key={f.variante_id} className={f.stock === 0 ? 'sin-stock' : undefined}>
            {f.producto} {f.color} {f.talle}: <strong>{f.stock}</strong>
          </li>
        ))}
      </ul>
      {poco.length > 0 && <Link to="/ingresos">Cargar mercadería →</Link>}
    </section>
  );
}
