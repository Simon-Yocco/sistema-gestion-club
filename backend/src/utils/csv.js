// 11.8 Exportación a CSV pensada para abrir con Excel en Argentina:
//  - separador ";" (con configuración regional es-AR, Excel usa ";" y la coma es decimal);
//  - montos con coma decimal: "15000.50" → "15000,50";
//  - BOM UTF-8 al principio, para que Excel muestre bien las tildes y la ñ.

/** Marca de orden de bytes UTF-8: Excel la usa para detectar la codificación. */
const BOM = String.fromCharCode(0xfeff);
const MONTO = /^-?\d+\.\d{2}$/;

function celda(valor) {
  if (valor === null || valor === undefined) return '';
  let texto;
  if (typeof valor === 'number') texto = String(valor).replace('.', ',');
  else if (typeof valor === 'string' && MONTO.test(valor)) texto = valor.replace('.', ',');
  else texto = String(valor);
  // Comillas si tiene separador, comillas o saltos de línea.
  return /[;"\r\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

/** columnas: nombres de campo (se usan también como encabezado); filas: objetos. */
export function aCSV(columnas, filas) {
  const lineas = [
    columnas.join(';'),
    ...filas.map((f) => columnas.map((col) => celda(f[col])).join(';')),
  ];
  return `${BOM}${lineas.join('\r\n')}\r\n`;
}
