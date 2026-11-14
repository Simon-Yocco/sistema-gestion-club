import { Boton } from './Boton.jsx';

/**
 * Tabla simple. columnas: [{ clave, titulo, render?(fila), alinear?: 'derecha' }].
 * `onFila` hace las filas clicables (por ej. para ir al detalle).
 */
export function Tabla({
  columnas,
  filas,
  vacio = 'No hay datos para mostrar.',
  onFila,
  clave = 'id',
}) {
  if (!filas || filas.length === 0) return <p className="tabla__vacia">{vacio}</p>;
  return (
    <div className="tabla__contenedor">
      <table className="tabla">
        <thead>
          <tr>
            {columnas.map((c) => (
              <th key={c.clave} className={c.alinear === 'derecha' ? 'derecha' : undefined}>
                {c.titulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((fila) => (
            <tr
              key={fila[clave]}
              className={onFila ? 'tabla__fila--clic' : undefined}
              onClick={onFila ? () => onFila(fila) : undefined}
            >
              {columnas.map((c) => (
                <td key={c.clave} className={c.alinear === 'derecha' ? 'derecha' : undefined}>
                  {c.render ? c.render(fila) : fila[c.clave]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Paginación con "Anterior / Siguiente". Usa la `paginacion` que devuelve la API. */
export function Paginacion({ pagina, por_pagina: porPagina, total, onCambiar }) {
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  if (paginas <= 1) return null;
  return (
    <nav className="paginacion" aria-label="Paginación">
      <Boton variante="secundario" disabled={pagina <= 1} onClick={() => onCambiar(pagina - 1)}>
        ← Anterior
      </Boton>
      <span>
        Página {pagina} de {paginas}
      </span>
      <Boton
        variante="secundario"
        disabled={pagina >= paginas}
        onClick={() => onCambiar(pagina + 1)}
      >
        Siguiente →
      </Boton>
    </nav>
  );
}
