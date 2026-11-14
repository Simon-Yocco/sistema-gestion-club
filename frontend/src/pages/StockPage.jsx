// 13.10 Stock (consulta): buscador y filtro; grilla color × talle por producto.
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { consultarStock } from '../api/recursos.js';
import { useDemorado } from '../hooks/useDemorado.js';
import { Input, Select } from '../components/Campo.jsx';
import { Cargando } from '../components/Cargando.jsx';

/** Agrupa las filas de /stock por producto → { colores, talles, celdas }. */
function agrupar(filas) {
  const productos = new Map();
  for (const f of filas) {
    const p = productos.get(f.producto_id) ?? { id: f.producto_id, nombre: f.producto, filas: [] };
    p.filas.push(f);
    productos.set(f.producto_id, p);
  }
  return [...productos.values()].map((p) => ({
    ...p,
    colores: [...new Set(p.filas.map((f) => f.color))],
    talles: [...new Set(p.filas.map((f) => f.talle))],
  }));
}

export function StockPage() {
  const [texto, setTexto] = useState('');
  const [estado, setEstado] = useState('');
  const q = useDemorado(texto.trim());
  const { data, isPending, error } = useQuery({
    queryKey: ['stock', q, estado],
    queryFn: () => consultarStock({ q, estado }),
  });

  return (
    <section>
      <h1>Stock</h1>
      <div className="filtros">
        <Input
          etiqueta="Buscar prenda"
          type="search"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />
        <Select
          etiqueta="Mostrar"
          value={estado}
          onChange={(e) => setEstado(e.target.value)}
          vacio="Todo"
          opciones={[
            { valor: 'con_stock', texto: 'Solo con stock' },
            { valor: 'sin_stock', texto: 'Solo sin stock' },
          ]}
        />
      </div>
      {error && <p className="alerta alerta--error">{error.message}</p>}
      {isPending ? (
        <Cargando />
      ) : (
        <>
          <p>Total: {data.total_unidades} prendas.</p>
          {data.filas.length === 0 && (
            <p className="tabla__vacia">No hay prendas con ese filtro.</p>
          )}
          {agrupar(data.filas).map((p) => (
            <div key={p.id} className="grilla-producto">
              <h3>{p.nombre}</h3>
              <table className="grilla">
                <thead>
                  <tr>
                    <th />
                    {p.talles.map((t) => (
                      <th key={t}>{t}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {p.colores.map((color) => (
                    <tr key={color}>
                      <th scope="row">{color}</th>
                      {p.talles.map((talle) => {
                        const f = p.filas.find((x) => x.color === color && x.talle === talle);
                        return (
                          <td key={talle} className={f && f.stock === 0 ? 'sin-stock' : undefined}>
                            {f ? f.stock : ''}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </>
      )}
    </section>
  );
}
