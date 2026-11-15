// Cómo paga el cliente. Montos en centavos; `objetivo` es lo que hay que cobrar.
// Primero se elige la forma (Efectivo / Transferencia / Mixto, y en una venta "Fiado") y
// recién ahí aparecen los montos, ya completados con el objetivo:
// - Efectivo o Transferencia: un solo monto. Sigue al objetivo (si se agrega o saca una
//   prenda se actualiza) hasta que se lo edita a mano (por ej. paga una parte).
// - Mixto: monto en efectivo y en transferencia; al escribir uno, el otro se completa con
//   lo que falta.
import { useEffect, useRef, useState } from 'react';
import { InputDinero } from '../../components/InputDinero.jsx';
import { Boton } from '../../components/Boton.jsx';
import { desdeCentavos, formatearPesos } from '../../utils/formato.js';

export const sumaPagos = (pagos) => pagos.reduce((a, p) => a + (p.monto ?? 0), 0);
export const pagosParaApi = (pagos) =>
  pagos.filter((p) => p.monto > 0).map((p) => ({ medio: p.medio, monto: desdeCentavos(p.monto) }));

const NOMBRE = { efectivo: 'Efectivo', transferencia: 'Transferencia' };
const OTRO = { efectivo: 'transferencia', transferencia: 'efectivo' };

/**
 * `textoSinPago`: si se pasa, agrega una opción para no cobrar nada ahora (en la venta:
 * "Fiado"). `modoInicial`: forma ya elegida al abrir (por ej. 'efectivo' en un reintegro).
 */
export function EditorPagos({
  pagos,
  onChange,
  objetivo,
  etiqueta = 'Forma de pago',
  textoSinPago,
  modoInicial = null,
}) {
  const [modo, setModo] = useState(modoInicial); // efectivo | transferencia | mixto | sin_pago
  const [aMano, setAMano] = useState(false); // el monto único se editó a mano
  const ultimoEditado = useRef('efectivo'); // en mixto: el que escribió la persona

  const monto = (medio) => pagos.find((p) => p.medio === medio)?.monto ?? null;
  const resto = (m) => Math.max(0, objetivo - (m ?? 0));
  const mixto = (medio, m) => {
    ultimoEditado.current = medio;
    const otro = OTRO[medio];
    const montos = { [medio]: m, [otro]: resto(m) };
    onChange([
      { medio: 'efectivo', monto: montos.efectivo },
      { medio: 'transferencia', monto: montos.transferencia },
    ]);
  };

  const elegir = (nuevo) => {
    setModo(nuevo);
    setAMano(false);
    if (nuevo === 'sin_pago') onChange([]);
    else if (nuevo === 'mixto') mixto('efectivo', null);
    else onChange([{ medio: nuevo, monto: objetivo }]);
  };

  useEffect(() => {
    if (modoInicial && pagos.length === 0 && objetivo > 0) elegir(modoInicial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Si cambia lo que hay que cobrar (se agregó o sacó una prenda), se actualizan los montos.
  const objetivoAnterior = useRef(objetivo);
  useEffect(() => {
    if (objetivoAnterior.current === objetivo) return;
    objetivoAnterior.current = objetivo;
    if (modo === 'efectivo' || modo === 'transferencia') {
      if (!aMano) onChange([{ medio: modo, monto: objetivo }]);
    } else if (modo === 'mixto') {
      mixto(ultimoEditado.current, monto(ultimoEditado.current));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [objetivo]);

  // Si desde afuera se vacían los pagos (por ej. cambió el cálculo), se vuelve a elegir.
  const modoVisible = modo !== 'sin_pago' && modo !== null && pagos.length === 0 ? null : modo;

  const opciones = [
    ['efectivo', 'Efectivo'],
    ['transferencia', 'Transferencia'],
    ['mixto', 'Mixto'],
    ...(textoSinPago ? [['sin_pago', textoSinPago]] : []),
  ];

  return (
    <fieldset className="editor-pagos">
      <legend className="campo__etiqueta">{etiqueta}</legend>
      <div className="editor-pagos__opciones">
        {opciones.map(([valor, texto]) => (
          <Boton
            key={valor}
            variante={modoVisible === valor ? 'primario' : 'secundario'}
            aria-pressed={modoVisible === valor}
            onClick={() => elegir(valor)}
            disabled={objetivo <= 0 && valor !== 'sin_pago'}
          >
            {texto}
          </Boton>
        ))}
      </div>

      {(modoVisible === 'efectivo' || modoVisible === 'transferencia') && (
        <div className="editor-pagos__montos">
          <InputDinero
            etiqueta={`Monto en ${NOMBRE[modoVisible].toLowerCase()}`}
            valor={monto(modoVisible)}
            onChange={(m) => {
              setAMano(true);
              onChange([{ medio: modoVisible, monto: m }]);
            }}
          />
        </div>
      )}

      {modoVisible === 'mixto' && (
        <>
          <div className="editor-pagos__montos editor-pagos__montos--dos">
            {['efectivo', 'transferencia'].map((medio) => (
              <InputDinero
                key={medio}
                etiqueta={`Monto en ${NOMBRE[medio].toLowerCase()}`}
                valor={monto(medio)}
                onChange={(m) => mixto(medio, m)}
              />
            ))}
          </div>
          <p className="editor-pagos__suma">
            Suma: {formatearPesos(sumaPagos(pagos), { centavos: true })}
          </p>
        </>
      )}
    </fieldset>
  );
}
