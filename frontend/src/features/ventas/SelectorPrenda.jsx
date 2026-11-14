// Elegir una prenda: buscar el producto por nombre y tocar el talle/color en la grilla.
// Las variantes sin stock se ven deshabilitadas (salvo `permitirSinStock`, para la prenda
// que DEVUELVE el cliente en un cambio sin venta registrada).
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { buscarProductos } from '../../api/recursos.js';
import { useDemorado } from '../../hooks/useDemorado.js';
import { formatearPesos } from '../../utils/formato.js';
import { Cargando } from '../../components/Cargando.jsx';

const ORDEN_TALLES = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
const ordenarTalles = (talles) =>
  [...talles].sort((a, b) => {
    const ia = ORDEN_TALLES.indexOf(a);
    const ib = ORDEN_TALLES.indexOf(b);
    if (ia >= 0 && ib >= 0) return ia - ib;
    if (ia >= 0) return -1;
    if (ib >= 0) return 1;
    return a.localeCompare(b, 'es', { numeric: true });
  });

/** onElegir({ variante_id, producto, color, talle, precio, stock }) */
export function SelectorPrenda({ onElegir, permitirSinStock = false, etiqueta = 'Buscar prenda' }) {
  const [texto, setTexto] = useState('');
  const q = useDemorado(texto.trim());
  const { data, isFetching } = useQuery({
    queryKey: ['productos', q],
    queryFn: () => buscarProductos(q),
    enabled: q.length > 0,
  });

  return (
    <div className="selector-prenda">
      <label className="campo">
        <span className="campo__etiqueta">{etiqueta}</span>
        <input
          className="input"
          type="search"
          placeholder="Ej.: remera"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />
      </label>
      {isFetching && <Cargando texto="Buscando…" />}
      {q && data?.productos.length === 0 && <p>No se encontraron prendas.</p>}
      {data?.productos.map((p) => (
        <GrillaProducto
          key={p.id}
          producto={p}
          onElegir={onElegir}
          permitirSinStock={permitirSinStock}
        />
      ))}
    </div>
  );
}

function GrillaProducto({ producto, onElegir, permitirSinStock }) {
  const colores = [...new Set(producto.variantes.map((v) => v.color))].sort();
  const talles = ordenarTalles([...new Set(producto.variantes.map((v) => v.talle))]);
  const celda = (color, talle) =>
    producto.variantes.find((v) => v.color === color && v.talle === talle);

  return (
    <div className="grilla-producto">
      <h3>
        {producto.nombre} <span className="precio">{formatearPesos(producto.precio_venta)}</span>
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
                const v = celda(color, talle);
                if (!v) return <td key={talle} />;
                const deshabilitada = !permitirSinStock && v.stock <= 0;
                return (
                  <td key={talle}>
                    <button
                      type="button"
                      className="grilla__celda"
                      disabled={deshabilitada}
                      aria-label={`${producto.nombre} ${color} ${talle}, stock ${v.stock}`}
                      onClick={() =>
                        onElegir({
                          variante_id: v.id,
                          producto: producto.nombre,
                          color,
                          talle,
                          precio: producto.precio_venta,
                          stock: v.stock,
                        })
                      }
                    >
                      <strong>{talle}</strong>
                      <small>stock {v.stock}</small>
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
