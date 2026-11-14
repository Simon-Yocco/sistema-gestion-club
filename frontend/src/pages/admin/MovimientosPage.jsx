// 14.7 Libro de movimientos de fondos con filtros y saldo acumulado.
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listarMovimientos } from '../../api/admin.js';
import { Input, Select } from '../../components/Campo.jsx';
import { Tabla, Paginacion } from '../../components/Tabla.jsx';
import { Cargando } from '../../components/Cargando.jsx';
import { IndicadorSaldos } from '../../features/fondos/Saldos.jsx';
import { aCentavos, formatearFechaHora, formatearPesos } from '../../utils/formato.js';

const TIPOS = {
  cobro_venta: 'Cobro de venta',
  cobro_fiado: 'Cobro de fiado',
  cobro_diferencia_cambio: 'Cobro por cambio',
  devolucion_diferencia_cambio: 'Devolución por cambio',
  devolucion_anulacion: 'Devolución / anulación',
  egreso: 'Egreso',
  prestamo_recibido: 'Préstamo recibido',
  devolucion_prestamo: 'Devolución de préstamo',
  deposito_bancario: 'Depósito bancario',
  extraccion_bancaria: 'Extracción bancaria',
  saldo_inicial: 'Saldo inicial',
};

export function MovimientosPage() {
  const [filtros, setFiltros] = useState({ desde: '', hasta: '', medio: '', tipo: '', pagina: 1 });
  const { data, isPending, error } = useQuery({
    queryKey: ['movimientos', filtros],
    queryFn: () => listarMovimientos(filtros),
  });
  const set = (campo) => (e) => setFiltros((f) => ({ ...f, [campo]: e.target.value, pagina: 1 }));

  return (
    <section>
      <h1>Libro de movimientos</h1>
      <IndicadorSaldos />
      <div className="filtros">
        <Input etiqueta="Desde" type="date" value={filtros.desde} onChange={set('desde')} />
        <Input etiqueta="Hasta" type="date" value={filtros.hasta} onChange={set('hasta')} />
        <Select
          etiqueta="Medio"
          value={filtros.medio}
          onChange={set('medio')}
          vacio="Los dos (saldo total)"
          opciones={[
            { valor: 'efectivo', texto: 'Efectivo' },
            { valor: 'transferencia', texto: 'Transferencia' },
          ]}
        />
        <Select
          etiqueta="Tipo"
          value={filtros.tipo}
          onChange={set('tipo')}
          vacio="Todos"
          opciones={Object.entries(TIPOS).map(([valor, texto]) => ({ valor, texto }))}
        />
      </div>
      {error && <p className="alerta alerta--error">{error.message}</p>}
      {isPending ? (
        <Cargando />
      ) : (
        <>
          <Tabla
            filas={data.movimientos}
            vacio="No hay movimientos."
            columnas={[
              { clave: 'fecha', titulo: 'Fecha', render: (m) => formatearFechaHora(m.fecha) },
              { clave: 'tipo', titulo: 'Tipo', render: (m) => TIPOS[m.tipo] },
              { clave: 'descripcion', titulo: 'Descripción' },
              { clave: 'medio', titulo: 'Medio' },
              {
                clave: 'monto',
                titulo: 'Monto',
                alinear: 'derecha',
                render: (m) => (
                  <span className={aCentavos(m.monto) < 0 ? 'negativo' : 'positivo'}>
                    {formatearPesos(m.monto)}
                  </span>
                ),
              },
              {
                clave: 'saldo_acumulado',
                titulo: 'Saldo',
                alinear: 'derecha',
                render: (m) => formatearPesos(m.saldo_acumulado),
              },
              { clave: 'usuario', titulo: 'Usuario', render: (m) => m.usuario.nombre },
            ]}
          />
          <Paginacion
            {...data.paginacion}
            onCambiar={(pagina) => setFiltros((f) => ({ ...f, pagina }))}
          />
        </>
      )}
    </section>
  );
}
