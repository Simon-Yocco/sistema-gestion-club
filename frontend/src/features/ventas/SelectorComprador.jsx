// Comprador: buscar por nombre, apodo o teléfono, o cargar uno nuevo en el momento.
// valor = null | { id, etiqueta, puede_fiar, ... } (existente) | { nuevo: true, nombre, apodo, telefono }
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { buscarCompradores } from '../../api/recursos.js';
import { useDemorado } from '../../hooks/useDemorado.js';
import { Boton } from '../../components/Boton.jsx';
import { Input } from '../../components/Campo.jsx';

export const puedeFiar = (c) => Boolean(c && (c.nuevo ? c.telefono?.trim() : c.puede_fiar));

/** Para el body de la API: { comprador_id } o { comprador: {...} } o {}. */
export function compradorParaApi(c) {
  if (!c) return {};
  if (!c.nuevo) return { comprador_id: c.id };
  const { nombre, apodo, telefono } = c;
  return { comprador: { nombre: nombre.trim(), apodo: apodo || null, telefono: telefono || null } };
}

export function SelectorComprador({ valor, onChange }) {
  const [texto, setTexto] = useState('');
  const q = useDemorado(texto.trim());
  const { data } = useQuery({
    queryKey: ['compradores', q],
    queryFn: () => buscarCompradores(q),
    enabled: q.length >= 2,
  });

  if (valor && !valor.nuevo) {
    return (
      <div className="comprador-elegido">
        <span>
          <strong>{valor.etiqueta}</strong>
          {valor.telefono && <small> · {valor.telefono}</small>}
        </span>
        <Boton variante="texto" onClick={() => onChange(null)}>
          Cambiar
        </Boton>
      </div>
    );
  }

  if (valor?.nuevo) {
    const set = (campo) => (e) => onChange({ ...valor, [campo]: e.target.value });
    return (
      <div className="comprador-nuevo">
        <Input etiqueta="Nombre" value={valor.nombre} onChange={set('nombre')} />
        <Input etiqueta="Apodo (opcional)" value={valor.apodo} onChange={set('apodo')} />
        <Input
          etiqueta="Teléfono"
          ayuda="Obligatorio si queda saldo pendiente (fiado)."
          value={valor.telefono}
          onChange={set('telefono')}
          inputMode="tel"
        />
        <Boton variante="texto" onClick={() => onChange(null)}>
          Cancelar
        </Boton>
      </div>
    );
  }

  return (
    <div className="selector-comprador">
      <label className="campo">
        <span className="campo__etiqueta">Comprador (nombre, apodo o teléfono)</span>
        <input
          autoComplete="off"
          className="input"
          type="search"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Opcional si paga todo"
        />
      </label>
      {q.length >= 2 && (
        <ul className="lista-opciones">
          {data?.compradores.map((c) => (
            <li key={c.id}>
              <button type="button" onClick={() => onChange(c)}>
                {c.etiqueta}
                {c.telefono && <small> · {c.telefono}</small>}
              </button>
            </li>
          ))}
          <li>
            <button
              type="button"
              className="lista-opciones__nuevo"
              onClick={() =>
                onChange({ nuevo: true, nombre: texto.trim(), apodo: '', telefono: '' })
              }
            >
              + Cargar comprador nuevo «{texto.trim()}»
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}
