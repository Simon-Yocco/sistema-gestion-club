// 14.6 Gráfico de barras horizontal simple (sin librerías): una fila por dato.
// datos: [{ etiqueta, valor (número), texto (lo que se muestra) }]
export function Barras({ datos, titulo, vacio = 'Sin datos para graficar.' }) {
  if (!datos?.length) return <p className="tabla__vacia">{vacio}</p>;
  const maximo = Math.max(...datos.map((d) => Math.abs(d.valor)), 1);
  return (
    <figure className="barras">
      {titulo && <figcaption>{titulo}</figcaption>}
      {datos.map((d) => (
        <div key={d.etiqueta} className="barras__fila">
          <span className="barras__etiqueta">{d.etiqueta}</span>
          <span className="barras__pista">
            <span
              className={`barras__barra ${d.valor < 0 ? 'barras__barra--negativa' : ''}`}
              style={{ width: `${(Math.abs(d.valor) / maximo) * 100}%` }}
            />
          </span>
          <span className="barras__valor">{d.texto}</span>
        </div>
      ))}
    </figure>
  );
}
