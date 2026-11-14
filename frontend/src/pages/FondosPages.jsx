// 13.11 Egresos · 13.12 Préstamos de la comisión · 13.12b Depósitos y extracciones.
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  crearEgreso,
  listarEgresos,
  listarPrestamos,
  listarTransferencias,
  registrarPrestamo,
  registrarTransferencia,
} from '../api/recursos.js';
import { useInvalidar } from '../hooks/useInvalidar.js';
import { useToast } from '../components/Toast.jsx';
import { Boton } from '../components/Boton.jsx';
import { Input, Select } from '../components/Campo.jsx';
import { InputDinero } from '../components/InputDinero.jsx';
import { SelectorMedioPago } from '../components/SelectorMedioPago.jsx';
import { Tabla } from '../components/Tabla.jsx';
import { AvisoSaldoNegativo, IndicadorSaldos } from '../features/fondos/Saldos.jsx';
import {
  desdeCentavos,
  formatearFecha,
  formatearFechaHora,
  formatearPesos,
  hoy,
} from '../utils/formato.js';

/** Envía el formulario, muestra el aviso de saldo negativo si vino, refresca y limpia. */
function useEnviar(accion, exito, limpiar) {
  const toast = useToast();
  const invalidar = useInvalidar();
  const [enviando, setEnviando] = useState(false);
  const enviar = async (e) => {
    e.preventDefault();
    setEnviando(true);
    try {
      const res = await accion();
      await invalidar();
      toast.exito(exito);
      if (res?.advertencia) toast.aviso(res.advertencia.message);
      limpiar();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setEnviando(false);
    }
  };
  return { enviar, enviando };
}

// ---------------------------------------------------------------- 13.11 Egresos

export function EgresosPage() {
  const vacio = {
    fecha: hoy(),
    monto: null,
    medio: 'efectivo',
    concepto: 'otro',
    descripcion: '',
    comprobante: '',
  };
  const [f, setF] = useState(vacio);
  const set = (campo) => (e) => setF((x) => ({ ...x, [campo]: e.target.value }));
  const lista = useQuery({
    queryKey: ['egresos'],
    queryFn: () => listarEgresos({ por_pagina: 20 }),
  });
  const { enviar, enviando } = useEnviar(
    () => crearEgreso({ ...f, monto: desdeCentavos(f.monto) }),
    'Egreso registrado.',
    () => setF(vacio),
  );

  return (
    <section>
      <h1>Egresos</h1>
      <IndicadorSaldos />
      <form className="panel formulario" onSubmit={enviar}>
        <h2>Registrar un pago de la tienda</h2>
        <InputDinero
          etiqueta="Monto"
          valor={f.monto}
          onChange={(monto) => setF((x) => ({ ...x, monto }))}
        />
        <SelectorMedioPago valor={f.medio} onChange={(medio) => setF((x) => ({ ...x, medio }))} />
        <Select
          etiqueta="Concepto"
          value={f.concepto}
          onChange={set('concepto')}
          opciones={[
            { valor: 'mercaderia', texto: 'Compra de mercadería' },
            { valor: 'otro', texto: 'Otro gasto' },
          ]}
        />
        <Input etiqueta="Descripción" value={f.descripcion} onChange={set('descripcion')} />
        <Input
          etiqueta="N° de comprobante (opcional)"
          value={f.comprobante}
          onChange={set('comprobante')}
        />
        <Input etiqueta="Fecha" type="date" max={hoy()} value={f.fecha} onChange={set('fecha')} />
        {f.monto > 0 && <AvisoSaldoNegativo cambios={{ [f.medio]: -f.monto }} />}
        <Boton type="submit" tamano="grande" disabled={!(f.monto > 0)} cargando={enviando}>
          Registrar egreso
        </Boton>
      </form>
      <h2>Últimos egresos</h2>
      <Tabla
        filas={lista.data?.egresos}
        vacio="Todavía no hay egresos."
        columnas={[
          { clave: 'fecha', titulo: 'Fecha', render: (e) => formatearFecha(e.fecha) },
          {
            clave: 'concepto',
            titulo: 'Concepto',
            render: (e) => (e.concepto === 'mercaderia' ? 'Mercadería' : 'Otro'),
          },
          { clave: 'descripcion', titulo: 'Descripción' },
          { clave: 'medio', titulo: 'Medio' },
          {
            clave: 'monto',
            titulo: 'Monto',
            alinear: 'derecha',
            render: (e) => formatearPesos(e.monto),
          },
        ]}
      />
    </section>
  );
}

// ---------------------------------------------------------------- 13.12 Préstamos

export function PrestamosPage() {
  const vacio = { tipo: 'recibido', monto: null, medio: 'efectivo', descripcion: '' };
  const [f, setF] = useState(vacio);
  const lista = useQuery({ queryKey: ['saldos', 'prestamos'], queryFn: listarPrestamos });
  const { enviar, enviando } = useEnviar(
    () =>
      registrarPrestamo({
        ...f,
        monto: desdeCentavos(f.monto),
        descripcion: f.descripcion || null,
      }),
    f.tipo === 'recibido' ? 'Préstamo registrado.' : 'Devolución registrada.',
    () => setF(vacio),
  );

  return (
    <section>
      <h1>Préstamos de la comisión directiva</h1>
      <IndicadorSaldos />
      {lista.data && (
        <p>
          Deuda actual con la comisión: <strong>{formatearPesos(lista.data.deuda_comision)}</strong>
        </p>
      )}
      <form className="panel formulario" onSubmit={enviar}>
        <Select
          etiqueta="Operación"
          value={f.tipo}
          onChange={(e) => setF((x) => ({ ...x, tipo: e.target.value }))}
          opciones={[
            { valor: 'recibido', texto: 'La comisión le presta a la tienda' },
            { valor: 'devolucion', texto: 'La tienda le devuelve a la comisión' },
          ]}
        />
        <InputDinero
          etiqueta="Monto"
          valor={f.monto}
          onChange={(monto) => setF((x) => ({ ...x, monto }))}
        />
        <SelectorMedioPago valor={f.medio} onChange={(medio) => setF((x) => ({ ...x, medio }))} />
        <Input
          etiqueta="Descripción (opcional)"
          value={f.descripcion}
          onChange={(e) => setF((x) => ({ ...x, descripcion: e.target.value }))}
        />
        {f.tipo === 'devolucion' && f.monto > 0 && (
          <AvisoSaldoNegativo cambios={{ [f.medio]: -f.monto }} />
        )}
        <Boton type="submit" tamano="grande" disabled={!(f.monto > 0)} cargando={enviando}>
          Registrar
        </Boton>
      </form>
      <h2>Historial</h2>
      <Tabla
        filas={lista.data?.movimientos}
        vacio="Sin préstamos registrados."
        columnas={[
          { clave: 'fecha', titulo: 'Fecha', render: (m) => formatearFechaHora(m.fecha) },
          {
            clave: 'tipo',
            titulo: 'Tipo',
            render: (m) => (m.tipo === 'recibido' ? 'Préstamo recibido' : 'Devolución'),
          },
          { clave: 'medio', titulo: 'Medio' },
          {
            clave: 'monto',
            titulo: 'Monto',
            alinear: 'derecha',
            render: (m) => formatearPesos(m.monto),
          },
          { clave: 'descripcion', titulo: 'Descripción' },
        ]}
      />
    </section>
  );
}

// ---------------------------------------------------------------- 13.12b Depósitos y extracciones

export function BancoPage() {
  const vacio = { fecha: hoy(), tipo: 'deposito', monto: null, comprobante: '', descripcion: '' };
  const [f, setF] = useState(vacio);
  const set = (campo) => (e) => setF((x) => ({ ...x, [campo]: e.target.value }));
  const lista = useQuery({ queryKey: ['saldos', 'banco'], queryFn: listarTransferencias });
  const { enviar, enviando } = useEnviar(
    () => registrarTransferencia({ ...f, monto: desdeCentavos(f.monto) }),
    f.tipo === 'deposito' ? 'Depósito registrado.' : 'Extracción registrada.',
    () => setF(vacio),
  );
  const m = f.monto ?? 0;
  const cambios =
    f.tipo === 'deposito' ? { efectivo: -m, transferencia: m } : { efectivo: m, transferencia: -m };

  return (
    <section>
      <h1>Depósitos y extracciones bancarias</h1>
      <IndicadorSaldos />
      <form className="panel formulario" onSubmit={enviar}>
        <Select
          etiqueta="Operación"
          value={f.tipo}
          onChange={set('tipo')}
          opciones={[
            { valor: 'deposito', texto: 'Depósito: efectivo → banco' },
            { valor: 'extraccion', texto: 'Extracción: banco → efectivo' },
          ]}
        />
        <InputDinero
          etiqueta="Monto"
          valor={f.monto}
          onChange={(monto) => setF((x) => ({ ...x, monto }))}
        />
        <Input
          etiqueta="N° de comprobante (opcional)"
          value={f.comprobante}
          onChange={set('comprobante')}
        />
        <Input etiqueta="Fecha" type="date" max={hoy()} value={f.fecha} onChange={set('fecha')} />
        {m > 0 && (
          <p>
            Efectivo {formatearPesos(cambios.efectivo, { centavos: true })} · Transferencia{' '}
            {formatearPesos(cambios.transferencia, { centavos: true })} (el total no cambia).
          </p>
        )}
        {m > 0 && <AvisoSaldoNegativo cambios={cambios} />}
        <Boton type="submit" tamano="grande" disabled={!(m > 0)} cargando={enviando}>
          Registrar
        </Boton>
      </form>
      <h2>Últimos registrados</h2>
      <Tabla
        filas={lista.data?.transferencias}
        vacio="Sin depósitos ni extracciones."
        columnas={[
          { clave: 'fecha', titulo: 'Fecha', render: (t) => formatearFecha(t.fecha) },
          {
            clave: 'tipo',
            titulo: 'Tipo',
            render: (t) => (t.tipo === 'deposito' ? 'Depósito' : 'Extracción'),
          },
          {
            clave: 'monto',
            titulo: 'Monto',
            alinear: 'derecha',
            render: (t) => formatearPesos(t.monto),
          },
          { clave: 'comprobante', titulo: 'Comprobante' },
        ]}
      />
    </section>
  );
}
