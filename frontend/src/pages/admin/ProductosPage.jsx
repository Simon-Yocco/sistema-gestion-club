// 14.1 Productos: listado, alta con grilla de variantes (colores × talles), edición de
// precio y costo, agregar colores/talles y activar/desactivar productos y variantes.
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  agregarVariantes,
  crearProducto,
  editarProducto,
  editarVariante,
  listarProductosAdmin,
} from '../../api/admin.js';
import { useToast } from '../../components/Toast.jsx';
import { Boton } from '../../components/Boton.jsx';
import { Input } from '../../components/Campo.jsx';
import { InputDinero } from '../../components/InputDinero.jsx';
import { Modal } from '../../components/Modal.jsx';
import { Tabla } from '../../components/Tabla.jsx';
import { Cargando } from '../../components/Cargando.jsx';
import { aCentavos, desdeCentavos, formatearPesos } from '../../utils/formato.js';

const lista = (texto) =>
  texto
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);

function useGuardar() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [guardando, setGuardando] = useState(false);
  const guardar = async (accion, exito) => {
    setGuardando(true);
    try {
      const res = await accion();
      await queryClient.invalidateQueries({ queryKey: ['productos'] });
      await queryClient.invalidateQueries({ queryKey: ['stock'] });
      toast.exito(exito);
      return res;
    } catch (err) {
      toast.error(err.message);
      return null;
    } finally {
      setGuardando(false);
    }
  };
  return { guardar, guardando };
}

export function ProductosPage() {
  const [texto, setTexto] = useState('');
  const [nuevo, setNuevo] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const { data, isPending } = useQuery({
    queryKey: ['productos', 'admin', texto],
    queryFn: () => listarProductosAdmin({ q: texto.trim() }),
  });
  const editando = data?.productos.find((p) => p.id === editandoId);

  return (
    <section>
      <h1>Productos</h1>
      <div className="filtros">
        <Input
          etiqueta="Buscar"
          type="search"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />
        <Boton onClick={() => setNuevo(true)}>+ Nuevo producto</Boton>
      </div>
      {isPending ? (
        <Cargando />
      ) : (
        <Tabla
          filas={data.productos}
          vacio="No hay productos."
          onFila={(p) => setEditandoId(p.id)}
          columnas={[
            { clave: 'nombre', titulo: 'Producto' },
            {
              clave: 'precio_venta',
              titulo: 'Precio',
              alinear: 'derecha',
              render: (p) => formatearPesos(p.precio_venta),
            },
            {
              clave: 'costo',
              titulo: 'Costo',
              alinear: 'derecha',
              render: (p) => formatearPesos(p.costo),
            },
            {
              clave: 'variantes',
              titulo: 'Variantes',
              alinear: 'derecha',
              render: (p) => p.variantes.length,
            },
            { clave: 'stock_total', titulo: 'Stock', alinear: 'derecha' },
            {
              clave: 'activo',
              titulo: 'Estado',
              render: (p) =>
                p.activo ? 'Activo' : <span className="etiqueta etiqueta--gris">Inactivo</span>,
            },
          ]}
        />
      )}
      {nuevo && <NuevoProducto onCerrar={() => setNuevo(false)} />}
      {editando && <EditarProducto producto={editando} onCerrar={() => setEditandoId(null)} />}
    </section>
  );
}

function NuevoProducto({ onCerrar }) {
  const { guardar, guardando } = useGuardar();
  const [f, setF] = useState({
    nombre: '',
    descripcion: '',
    precio: null,
    costo: null,
    colores: '',
    talles: '',
  });
  const set = (campo) => (e) => setF((x) => ({ ...x, [campo]: e.target.value }));
  const colores = lista(f.colores);
  const talles = lista(f.talles);
  const valido =
    f.nombre.trim() && f.precio !== null && f.costo !== null && colores.length && talles.length;

  const crear = async () => {
    const res = await guardar(
      () =>
        crearProducto({
          nombre: f.nombre.trim(),
          descripcion: f.descripcion,
          precio_venta: desdeCentavos(f.precio),
          costo: desdeCentavos(f.costo),
          colores,
          talles,
        }),
      'Producto creado. El stock se carga desde "Mercadería".',
    );
    if (res) onCerrar();
  };

  return (
    <Modal
      abierto
      titulo="Nuevo producto"
      onCerrar={onCerrar}
      pie={
        <Boton onClick={crear} disabled={!valido} cargando={guardando}>
          Crear producto
        </Boton>
      }
    >
      <Input etiqueta="Nombre" value={f.nombre} onChange={set('nombre')} />
      <Input
        etiqueta="Descripción (opcional)"
        value={f.descripcion}
        onChange={set('descripcion')}
      />
      <InputDinero
        etiqueta="Precio de venta"
        valor={f.precio}
        onChange={(precio) => setF((x) => ({ ...x, precio }))}
      />
      <InputDinero
        etiqueta="Costo"
        valor={f.costo}
        onChange={(costo) => setF((x) => ({ ...x, costo }))}
      />
      <Input
        etiqueta="Colores (separados por coma)"
        placeholder="Azul, Blanca"
        value={f.colores}
        onChange={set('colores')}
      />
      <Input
        etiqueta="Talles (separados por coma)"
        placeholder="S, M, L, XL"
        value={f.talles}
        onChange={set('talles')}
      />
      {colores.length > 0 && talles.length > 0 && (
        <p>Se van a crear {colores.length * talles.length} variantes con stock 0.</p>
      )}
    </Modal>
  );
}

function EditarProducto({ producto, onCerrar }) {
  const { guardar, guardando } = useGuardar();
  const [f, setF] = useState({
    nombre: producto.nombre,
    precio: aCentavos(producto.precio_venta),
    costo: aCentavos(producto.costo),
  });
  const [nuevos, setNuevos] = useState({ colores: '', talles: '' });

  const guardarDatos = () =>
    guardar(
      () =>
        editarProducto(producto.id, {
          nombre: f.nombre.trim(),
          precio_venta: desdeCentavos(f.precio),
          costo: desdeCentavos(f.costo),
        }),
      'Producto actualizado. El precio nuevo no cambia las ventas ya hechas.',
    );

  return (
    <Modal abierto ancho="ancho" titulo={producto.nombre} onCerrar={onCerrar}>
      <div className="panel">
        <Input
          etiqueta="Nombre"
          value={f.nombre}
          onChange={(e) => setF((x) => ({ ...x, nombre: e.target.value }))}
        />
        <InputDinero
          etiqueta="Precio de venta"
          valor={f.precio}
          onChange={(precio) => setF((x) => ({ ...x, precio }))}
        />
        <InputDinero
          etiqueta="Costo (rige para las compras y ventas siguientes)"
          valor={f.costo}
          onChange={(costo) => setF((x) => ({ ...x, costo }))}
        />
        <div className="acciones">
          <Boton
            onClick={guardarDatos}
            cargando={guardando}
            disabled={!f.nombre.trim() || f.precio === null || f.costo === null}
          >
            Guardar cambios
          </Boton>
          <Boton
            variante={producto.activo ? 'peligro' : 'secundario'}
            onClick={() =>
              guardar(
                () => editarProducto(producto.id, { activo: !producto.activo }),
                producto.activo ? 'Producto desactivado.' : 'Producto activado.',
              )
            }
          >
            {producto.activo ? 'Desactivar producto' : 'Activar producto'}
          </Boton>
        </div>
      </div>

      <h3>Variantes</h3>
      <Tabla
        filas={producto.variantes}
        columnas={[
          { clave: 'color', titulo: 'Color' },
          { clave: 'talle', titulo: 'Talle' },
          { clave: 'stock', titulo: 'Stock', alinear: 'derecha' },
          {
            clave: 'activo',
            titulo: '',
            render: (v) => (
              <Boton
                variante="texto"
                onClick={() =>
                  guardar(
                    () => editarVariante(producto.id, v.id, { activo: !v.activo }),
                    v.activo ? 'Variante desactivada.' : 'Variante activada.',
                  )
                }
              >
                {v.activo ? 'Desactivar' : 'Activar'}
              </Boton>
            ),
          },
        ]}
      />

      <h3>Agregar colores o talles</h3>
      <Input
        etiqueta="Colores nuevos (separados por coma)"
        value={nuevos.colores}
        onChange={(e) => setNuevos((x) => ({ ...x, colores: e.target.value }))}
      />
      <Input
        etiqueta="Talles nuevos (separados por coma)"
        value={nuevos.talles}
        onChange={(e) => setNuevos((x) => ({ ...x, talles: e.target.value }))}
      />
      <Boton
        variante="secundario"
        disabled={!lista(nuevos.colores).length && !lista(nuevos.talles).length}
        onClick={async () => {
          const res = await guardar(
            () =>
              agregarVariantes(producto.id, {
                colores: lista(nuevos.colores),
                talles: lista(nuevos.talles),
              }),
            'Variantes agregadas.',
          );
          if (res) setNuevos({ colores: '', talles: '' });
        }}
      >
        Agregar variantes
      </Boton>
    </Modal>
  );
}
