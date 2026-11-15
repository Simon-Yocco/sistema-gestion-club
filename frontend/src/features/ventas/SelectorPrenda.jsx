// Elegir una prenda: se ven todas, se filtran escribiendo, y se toca el talle/color en la grilla.
// Las variantes sin stock no se muestran.
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { buscarProductos } from '../../api/recursos.js';
import { formatearPesos } from '../../utils/formato.js';
import { Cargando } from '../../components/Cargando.jsx';

const ORDEN_TALLES = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', 'XXXL', '3XL', '4XL', '5XL'];
export const ordenarTalles = (talles) =>
  [...talles].sort((a, b) => {
    const ia = ORDEN_TALLES.indexOf(a);
    const ib = ORDEN_TALLES.indexOf(b);
    if (ia >= 0 && ib >= 0) return ia - ib;
    if (ia >= 0) return -1;
    if (ib >= 0) return 1;
    return a.localeCompare(b, 'es', { numeric: true });
  });

/** Solo las variantes que tienen stock. */
export const conStock = (variantes) => variantes.filter((v) => v.stock > 0);

/** Minúsculas y sin acentos, para filtrar "algodon" = "algodón". */
const normalizar = (t) => t.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/**
 * Muestra todas las prendas desde el principio; al escribir se van filtrando al instante
 * (por nombre o descripción). Son pocas, así que se traen una vez y se filtra acá.
 * onElegir({ variante_id, producto, color, talle, precio, stock })
 */
export function SelectorPrenda({ onElegir, etiqueta = 'Buscar prenda' }) {
  const [texto, setTexto] = useState('');
  const { data, isPending } = useQuery({
    queryKey: ['productos', 'todos'],
    queryFn: () => buscarProductos(),
  });

  const buscado = normalizar(texto.trim());
  const productos = (data?.productos ?? [])
    // Los talles sin stock no se muestran.
    .map((p) => ({ ...p, variantes: conStock(p.variantes) }))
    .filter((p) => p.variantes.length > 0)
    .filter((p) => !buscado || normalizar(`${p.nombre} ${p.descripcion ?? ''}`).includes(buscado));

  return (
    <div className="selector-prenda">
      <label className="campo">
        <span className="campo__etiqueta">{etiqueta}</span>
        <input
          className="input"
          type="search"
          placeholder="Escribí para filtrar (ej.: remera)"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />
      </label>
      {isPending && <Cargando texto="Cargando prendas…" />}
      {data && productos.length === 0 && <p>No se encontraron prendas.</p>}
      {productos.map((p) => (
        <GrillaProducto key={p.id} producto={p} onElegir={onElegir} />
      ))}
    </div>
  );
}

function GrillaProducto({ producto, onElegir }) {
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
                return (
                  <td key={talle}>
                    <button
                      type="button"
                      className="grilla__celda"
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
