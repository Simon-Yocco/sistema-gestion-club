// 14.2 Ingreso de mercadería: elegir producto → cargar cantidades en la grilla color × talle
// → confirmar. Listado de ingresos con estado pagado / parcial / no pagado.
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { crearIngreso, listarIngresos } from '../../api/admin.js';
import { buscarProductos } from '../../api/recursos.js';
import { useDemorado } from '../../hooks/useDemorado.js';
import { useToast } from '../../components/Toast.jsx';
import { Boton } from '../../components/Boton.jsx';
import { Input, Select } from '../../components/Campo.jsx';
import { Confirmacion } from '../../components/Modal.jsx';
import { Tabla, Paginacion } from '../../components/Tabla.jsx';
import { formatearFecha, formatearPesos, hoy } from '../../utils/formato.js';

const ESTADO = { pagado: 'Pagado', parcial: 'Pago parcial', no_pagado: 'No pagado' };
const CLASE = { pagado: 'pagada', parcial: 'parcial', no_pagado: 'pendiente' };

export function IngresosPage() {
  return (
    <section>
      <h1>Ingreso de mercadería</h1>
      <NuevoIngreso />
      <ListadoIngresos />
    </section>
  );
}

function NuevoIngreso() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [texto, setTexto] = useState('');
  const q = useDemorado(texto.trim());
  const productos = useQuery({
    queryKey: ['productos', 'ingreso', q],
    queryFn: () => buscarProductos(q),
    enabled: q.length > 0,
  });
  // cantidades: { [variante_id]: { cantidad, descripcion } }
  const [cantidades, setCantidades] = useState({});
  const [datos, setDatos] = useState({ fecha: hoy(), proveedor: '', observaciones: '' });
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const items = Object.entries(cantidades)
    .filter(([, v]) => v.cantidad > 0)
    .map(([id, v]) => ({ variante_id: Number(id), ...v }));
  const unidades = items.reduce((a, i) => a + i.cantidad, 0);

  const setCantidad = (variante, producto, valor) =>
    setCantidades((c) => ({
      ...c,
      [variante.id]: {
        cantidad: Math.max(0, Number.parseInt(valor, 10) || 0),
        descripcion: `${producto.nombre} ${variante.color} ${variante.talle}`,
      },
    }));

  const confirmar = async () => {
    setEnviando(true);
    try {
      const { ingreso } = await crearIngreso({
        ...datos,
        items: items.map(({ variante_id, cantidad }) => ({ variante_id, cantidad })),
      });
      await Promise.all(
        [['ingresos'], ['stock'], ['productos']].map((queryKey) =>
          queryClient.invalidateQueries({ queryKey }),
        ),
      );
      toast.exito(
        `Ingreso #${ingreso.id} registrado: ${ingreso.unidades} prendas, ${formatearPesos(ingreso.total)} a costo.`,
      );
      setCantidades({});
      setConfirmando(false);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="panel">
      <h2>Nuevo ingreso</h2>
      <Input
        etiqueta="Buscar producto"
        type="search"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
      />
      {productos.data?.productos.map((p) => {
        const colores = [...new Set(p.variantes.map((v) => v.color))];
        const talles = [...new Set(p.variantes.map((v) => v.talle))];
        return (
          <div key={p.id} className="grilla-producto">
            <h3>
              {p.nombre} <span className="precio">costo {formatearPesos(p.costo)}</span>
            </h3>
            <table className="grilla">
              <thead>
                <tr>
                  <th />
                  {talles.map((t) => (
                    <th key={t}>{t}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {colores.map((color) => (
                  <tr key={color}>
                    <th scope="row">{color}</th>
                    {talles.map((talle) => {
                      const v = p.variantes.find((x) => x.color === color && x.talle === talle);
                      if (!v) return <td key={talle} />;
                      return (
                        <td key={talle}>
                          <input
                            className="input input--cantidad"
                            type="number"
                            min="0"
                            inputMode="numeric"
                            aria-label={`Cantidad ${p.nombre} ${color} ${talle}`}
                            value={cantidades[v.id]?.cantidad || ''}
                            onChange={(e) => setCantidad(v, p, e.target.value)}
                          />
                          <small>hay {v.stock}</small>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}

      {items.length > 0 && (
        <>
          <p>
            <strong>{unidades} prendas</strong> en {items.length}{' '}
            {items.length === 1 ? 'variante' : 'variantes'}.
          </p>
          <div className="filtros">
            <Input
              etiqueta="Fecha"
              type="date"
              max={hoy()}
              value={datos.fecha}
              onChange={(e) => setDatos((d) => ({ ...d, fecha: e.target.value }))}
            />
            <Input
              etiqueta="Proveedor (opcional)"
              value={datos.proveedor}
              onChange={(e) => setDatos((d) => ({ ...d, proveedor: e.target.value }))}
            />
            <Input
              etiqueta="Observaciones"
              value={datos.observaciones}
              onChange={(e) => setDatos((d) => ({ ...d, observaciones: e.target.value }))}
            />
          </div>
          <Boton tamano="grande" onClick={() => setConfirmando(true)}>
            Revisar y confirmar
          </Boton>
        </>
      )}

      <Confirmacion
        abierto={confirmando}
        titulo="Confirmar ingreso de mercadería"
        textoConfirmar="Confirmar ingreso"
        cargando={enviando}
        onConfirmar={confirmar}
        onCancelar={() => setConfirmando(false)}
      >
        <ul>
          {items.map((i) => (
            <li key={i.variante_id}>
              {i.cantidad} × {i.descripcion}
            </li>
          ))}
        </ul>
        <p>El stock se suma al confirmar. El pago al proveedor se registra aparte, como egreso.</p>
      </Confirmacion>
    </div>
  );
}

function ListadoIngresos() {
  const [filtros, setFiltros] = useState({ estado_pago: '', pagina: 1, por_pagina: 20 });
  const { data } = useQuery({
    queryKey: ['ingresos', filtros],
    queryFn: () => listarIngresos(filtros),
  });
  return (
    <>
      <h2>Ingresos registrados</h2>
      <Select
        etiqueta="Estado de pago"
        value={filtros.estado_pago}
        onChange={(e) => setFiltros((f) => ({ ...f, estado_pago: e.target.value, pagina: 1 }))}
        vacio="Todos"
        opciones={Object.entries(ESTADO).map(([valor, texto]) => ({ valor, texto }))}
      />
      <Tabla
        filas={data?.ingresos}
        vacio="Todavía no hay ingresos."
        columnas={[
          { clave: 'id', titulo: 'N°' },
          { clave: 'fecha', titulo: 'Fecha', render: (i) => formatearFecha(i.fecha) },
          { clave: 'proveedor', titulo: 'Proveedor' },
          { clave: 'unidades', titulo: 'Prendas', alinear: 'derecha' },
          {
            clave: 'total',
            titulo: 'Total a costo',
            alinear: 'derecha',
            render: (i) => formatearPesos(i.total),
          },
          {
            clave: 'pagado',
            titulo: 'Pagado',
            alinear: 'derecha',
            render: (i) => formatearPesos(i.pagado),
          },
          {
            clave: 'estado_pago',
            titulo: 'Estado',
            render: (i) => (
              <span className={`etiqueta etiqueta--${CLASE[i.estado_pago]}`}>
                {ESTADO[i.estado_pago]}
              </span>
            ),
          },
        ]}
      />
      {data && (
        <Paginacion
          {...data.paginacion}
          onCambiar={(pagina) => setFiltros((f) => ({ ...f, pagina }))}
        />
      )}
    </>
  );
}
