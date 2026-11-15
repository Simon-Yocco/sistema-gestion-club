// 14.2 Ingreso de mercadería, dentro de la ficha del producto (pantalla Productos): como los
// ítems de una venta (color, talle, cantidad → Agregar), con talles o colores nuevos si
// hace falta → confirmar. Y el listado de ingresos con estado pagado / parcial / no pagado.
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { crearIngreso, listarIngresos } from '../../api/admin.js';
import { useToast } from '../../components/Toast.jsx';
import { Boton } from '../../components/Boton.jsx';
import { Input, Select } from '../../components/Campo.jsx';
import { Confirmacion } from '../../components/Modal.jsx';
import { Tabla, Paginacion } from '../../components/Tabla.jsx';
import { formatearFecha, formatearPesos, hoy } from '../../utils/formato.js';

const ESTADO = { pagado: 'Pagado', parcial: 'Pago parcial', no_pagado: 'No pagado' };
const CLASE = { pagado: 'pagada', parcial: 'parcial', no_pagado: 'pendiente' };

/** Clave para juntar ítems repetidos: sin mayúsculas ni acentos. */
const clave = (t) => String(t).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
/** Talles que se ofrecen siempre en el desplegable (además de los que ya tiene el producto). */
export const TALLES_SUGERIDOS = [
  '4',
  '6',
  '8',
  '10',
  '12',
  '14',
  '16',
  'XS',
  'S',
  'M',
  'L',
  'XL',
  '2XL',
  '3XL',
  '4XL',
  '5XL',
];

const claveItem = (i) => `${i.producto_id}|${clave(i.color)}|${clave(i.talle)}`;

/**
 * Ingresar mercadería de un producto, como los ítems de una venta: color, talle y cantidad
 * → "Agregar". Si el color o el talle todavía no existen en el producto, se crean al
 * confirmar (el backend los da de alta en el mismo ingreso).
 */
export function NuevoIngreso({ producto }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [linea, setLinea] = useState({ color: '', talle: '', cantidad: '' });
  const [items, setItems] = useState([]); // { producto_id, producto, color, talle, cantidad, nueva }
  const [datos, setDatos] = useState({ fecha: hoy(), proveedor: '', observaciones: '' });
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const colores = [...new Set(producto.variantes.map((v) => v.color))];
  const talles = [...new Set(producto.variantes.map((v) => v.talle))];
  const cantidad = Number.parseInt(linea.cantidad, 10);
  const lineaLista = Boolean(linea.color.trim() && linea.talle.trim() && cantidad > 0);
  const unidades = items.reduce((a, i) => a + i.cantidad, 0);

  const agregar = (e) => {
    e.preventDefault();
    if (!lineaLista) return;
    const existe = producto.variantes.find(
      (v) => clave(v.color) === clave(linea.color) && clave(v.talle) === clave(linea.talle),
    );
    const nuevo = {
      producto_id: producto.id,
      producto: producto.nombre,
      color: existe ? existe.color : linea.color.trim(),
      talle: existe ? existe.talle : linea.talle.trim().toUpperCase(),
      cantidad,
      nueva: !existe,
    };
    setItems((actuales) => {
      const igual = actuales.find((i) => claveItem(i) === claveItem(nuevo));
      if (!igual) return [...actuales, nuevo];
      return actuales.map((i) => (i === igual ? { ...i, cantidad: i.cantidad + cantidad } : i));
    });
    // Queda el color elegido para seguir cargando otros talles del mismo color.
    setLinea((l) => ({ ...l, talle: '', cantidad: '' }));
  };

  const quitar = (id) => setItems((actuales) => actuales.filter((i) => claveItem(i) !== id));

  const confirmar = async () => {
    setEnviando(true);
    try {
      const { ingreso } = await crearIngreso({
        ...datos,
        items: items.map((i) => ({
          producto_id: i.producto_id,
          color: i.color,
          talle: i.talle,
          cantidad: i.cantidad,
        })),
      });
      await Promise.all(
        [['ingresos'], ['stock'], ['productos'], ['producto']].map((queryKey) =>
          queryClient.invalidateQueries({ queryKey }),
        ),
      );
      toast.exito(
        `Ingreso #${ingreso.id} registrado: ${ingreso.unidades} prendas, ${formatearPesos(ingreso.total)} a costo.`,
      );
      setItems([]);
      setConfirmando(false);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="panel">
      <h2>Ingresar mercadería</h2>
      <form className="filtros" onSubmit={agregar}>
        <Input
          etiqueta="Color"
          list="ingreso-colores"
          autoComplete="off"
          value={linea.color}
          onChange={(e) => setLinea((l) => ({ ...l, color: e.target.value }))}
        />
        <datalist id="ingreso-colores">
          {colores.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        <Input
          etiqueta="Talle"
          list="ingreso-talles"
          autoComplete="off"
          value={linea.talle}
          onChange={(e) => setLinea((l) => ({ ...l, talle: e.target.value }))}
        />
        <datalist id="ingreso-talles">
          {[...TALLES_SUGERIDOS, ...talles.filter((t) => !TALLES_SUGERIDOS.includes(t))].map(
            (t) => (
              <option key={t} value={t} />
            ),
          )}
        </datalist>
        <Input
          etiqueta="Cantidad"
          type="number"
          min="1"
          inputMode="numeric"
          value={linea.cantidad}
          onChange={(e) => setLinea((l) => ({ ...l, cantidad: e.target.value }))}
        />
        <Boton type="submit" disabled={!lineaLista}>
          + Agregar
        </Boton>
      </form>
      <Tabla
        filas={items.map((i) => ({ ...i, id: claveItem(i) }))}
        vacio="Todavía no agregaste prendas."
        columnas={[
          { clave: 'cantidad', titulo: 'Cant.', alinear: 'derecha' },
          { clave: 'color', titulo: 'Color' },
          {
            clave: 'talle',
            titulo: 'Talle',
            render: (i) => (
              <>
                {i.talle} {i.nueva && <span className="etiqueta etiqueta--parcial">nuevo</span>}
              </>
            ),
          },
          {
            clave: 'quitar',
            titulo: '',
            render: (i) => (
              <Boton
                variante="texto"
                aria-label={`Quitar ${i.producto} ${i.color} ${i.talle}`}
                onClick={() => quitar(i.id)}
              >
                ✕
              </Boton>
            ),
          },
        ]}
      />

      {items.length > 0 && (
        <>
          <p className="centrado">
            <strong>{unidades} prendas</strong> en {items.length}{' '}
            {items.length === 1 ? 'ítem' : 'ítems'}.
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
          <div className="acciones">
            <Boton tamano="grande" onClick={() => setConfirmando(true)}>
              Revisar y confirmar
            </Boton>
          </div>
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
            <li key={claveItem(i)}>
              {i.cantidad} × {i.producto} {i.color} {i.talle}
              {i.nueva && ' (nuevo en el producto)'}
            </li>
          ))}
        </ul>
        <p>El stock se suma al confirmar. El pago al proveedor se registra aparte, como egreso.</p>
      </Confirmacion>
    </div>
  );
}

export function ListadoIngresos() {
  const [filtros, setFiltros] = useState({ estado_pago: '', pagina: 1, por_pagina: 20 });
  const { data } = useQuery({
    queryKey: ['ingresos', filtros],
    queryFn: () => listarIngresos(filtros),
  });
  return (
    <section className="seccion-separada">
      <h2>Ingresos de mercadería registrados</h2>
      <div className="filtros">
        <Select
          etiqueta="Estado de pago al proveedor"
          value={filtros.estado_pago}
          onChange={(e) => setFiltros((f) => ({ ...f, estado_pago: e.target.value, pagina: 1 }))}
          vacio="Todos"
          opciones={Object.entries(ESTADO).map(([valor, texto]) => ({ valor, texto }))}
        />
      </div>
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
    </section>
  );
}
