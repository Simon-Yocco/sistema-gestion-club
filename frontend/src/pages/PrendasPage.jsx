// Prendas (antes "Stock"): el catálogo de la tienda para secretaría. Cada prenda con su
// precio, descripción, cuántas quedan y la grilla color × talle con el stock de cada una
// (solo los talles que tienen stock).
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { buscarProductos } from '../api/recursos.js';
import { useAuth } from '../features/auth/AuthContext.jsx';
import { useDemorado } from '../hooks/useDemorado.js';
import { conStock, ordenarTalles } from '../features/ventas/SelectorPrenda.jsx';
import { Input, Select } from '../components/Campo.jsx';
import { Cargando } from '../components/Cargando.jsx';
import { formatearPesos } from '../utils/formato.js';

const FILTROS = {
  con_stock: (p) => p.stock_total > 0,
  sin_stock: (p) => p.stock_total === 0,
};

function Prenda({ producto: p }) {
  // Solo se muestran los colores y talles que tienen stock.
  const variantes = conStock(p.variantes);
  const colores = [...new Set(variantes.map((v) => v.color))];
  const talles = ordenarTalles([...new Set(variantes.map((v) => v.talle))]);
  const stock = (color, talle) =>
    variantes.find((v) => v.color === color && v.talle === talle)?.stock;

  return (
    <article className="prenda" aria-label={p.nombre}>
      <header className="prenda__cabecera">
        <h2>{p.nombre}</h2>
        <strong className="prenda__precio">{formatearPesos(p.precio_venta)}</strong>
      </header>
      {p.descripcion && <p className="prenda__descripcion">{p.descripcion}</p>}
      <p className={p.stock_total === 0 ? 'prenda__total sin-stock' : 'prenda__total'}>
        {p.stock_total === 0
          ? 'Sin stock'
          : `${p.stock_total} ${p.stock_total === 1 ? 'unidad' : 'unidades'} en total`}
      </p>
      {variantes.length > 0 && (
        <div className="prenda__grilla">
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
                    return <td key={talle}>{stock(color, talle) ?? ''}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </article>
  );
}

export function PrendasPage() {
  const { puede } = useAuth();
  const [texto, setTexto] = useState('');
  const [filtro, setFiltro] = useState('');
  const q = useDemorado(texto.trim());
  const { data, isPending, error } = useQuery({
    queryKey: ['productos', 'catalogo', q],
    queryFn: () => buscarProductos(q || undefined),
  });

  const productos = (data?.productos ?? []).filter(FILTROS[filtro] ?? (() => true));
  const unidades = productos.reduce((a, p) => a + p.stock_total, 0);

  return (
    <section>
      <div className="titulo-con-accion">
        <h1>Prendas</h1>
        {puede('ventas.registrar') && (
          <Link to="/ventas/nueva" className="boton boton--club boton--grande">
            + Nueva venta
          </Link>
        )}
      </div>
      <div className="filtros">
        <Input
          etiqueta="Buscar prenda"
          type="search"
          placeholder="Ej.: remera"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />
        <Select
          etiqueta="Mostrar"
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          vacio="Todas"
          opciones={[
            { valor: 'con_stock', texto: 'Con stock' },
            { valor: 'sin_stock', texto: 'Agotadas' },
          ]}
        />
      </div>
      {error && <p className="alerta alerta--error">{error.message}</p>}
      {isPending ? (
        <Cargando />
      ) : (
        <>
          <p>
            {productos.length} {productos.length === 1 ? 'prenda' : 'prendas'} · {unidades} unidades
            en stock.
          </p>
          {productos.length === 0 && <p className="tabla__vacia">No hay prendas con ese filtro.</p>}
          <div className="prendas">
            {productos.map((p) => (
              <Prenda key={p.id} producto={p} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
