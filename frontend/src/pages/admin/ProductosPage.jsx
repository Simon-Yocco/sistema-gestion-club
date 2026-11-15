// 14.1 + 14.2 Productos y mercadería en una sola pantalla.
//  - Lista de productos con "+ Nuevo producto" (nombre, descripción, marca, precio y costo;
//    sin talles ni colores: aparecen al ingresar mercadería, reglas v1.4).
//  - Al tocar un producto (o al crearlo) se abre su ficha: datos editables, stock por color
//    y talle, e "Ingresar mercadería" con color, talle y cantidad como ítems.
//  - Debajo de la lista, los ingresos registrados con su estado de pago.
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
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
import { ordenarTalles } from '../../features/ventas/SelectorPrenda.jsx';
import { NuevoIngreso, ListadoIngresos } from '../../features/mercaderia/Mercaderia.jsx';
import { aCentavos, desdeCentavos, formatearPesos } from '../../utils/formato.js';

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
  const [abiertoId, setAbiertoId] = useState(null);
  const { data, isPending } = useQuery({
    queryKey: ['productos', 'admin', texto],
    queryFn: () => listarProductosAdmin({ q: texto.trim() }),
  });
  // Ficha abierta: se busca en la lista sin filtro para que no desaparezca al buscar.
  const todos = useQuery({
    queryKey: ['productos', 'admin', ''],
    queryFn: () => listarProductosAdmin({}),
    enabled: abiertoId !== null,
  });
  const abierto = todos.data?.productos.find((p) => p.id === abiertoId);

  if (abiertoId !== null) {
    return abierto ? (
      <FichaProducto key={abierto.id} producto={abierto} onVolver={() => setAbiertoId(null)} />
    ) : (
      <Cargando />
    );
  }

  return (
    <section>
      <h1>Productos y mercadería</h1>
      <div className="filtros">
        <Input
          etiqueta="Buscar (nombre o marca)"
          type="search"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />
        <Boton onClick={() => setNuevo(true)}>+ Nuevo producto</Boton>
      </div>
      <p className="centrado ayuda">
        Tocá un producto para ver su stock, editarlo o ingresar mercadería.
      </p>
      {isPending ? (
        <Cargando />
      ) : (
        <Tabla
          filas={data.productos}
          vacio="No hay productos."
          onFila={(p) => setAbiertoId(p.id)}
          columnas={[
            { clave: 'nombre', titulo: 'Producto' },
            { clave: 'marca', titulo: 'Marca', render: (p) => p.marca ?? '' },
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

      <ListadoIngresos />

      {nuevo && (
        <NuevoProducto
          onCerrar={() => setNuevo(false)}
          onCreado={(id) => {
            setNuevo(false);
            setAbiertoId(id);
          }}
        />
      )}
    </section>
  );
}

function NuevoProducto({ onCerrar, onCreado }) {
  const { guardar, guardando } = useGuardar();
  const [f, setF] = useState({ nombre: '', descripcion: '', marca: '', precio: null, costo: null });
  const set = (campo) => (e) => setF((x) => ({ ...x, [campo]: e.target.value }));
  const valido = f.nombre.trim() && f.precio !== null && f.costo !== null;

  const crear = async () => {
    const res = await guardar(
      () =>
        crearProducto({
          nombre: f.nombre.trim(),
          descripcion: f.descripcion,
          marca: f.marca,
          precio_venta: desdeCentavos(f.precio),
          costo: desdeCentavos(f.costo),
        }),
      'Producto creado. Ahora cargá la mercadería que trajiste.',
    );
    if (res) onCreado(res.producto.id);
  };

  return (
    <Modal
      abierto
      titulo="Nuevo producto"
      onCerrar={onCerrar}
      pie={
        <Boton onClick={crear} disabled={!valido} cargando={guardando}>
          Crear y cargar mercadería
        </Boton>
      }
    >
      <Input etiqueta="Nombre" value={f.nombre} onChange={set('nombre')} />
      <Input
        etiqueta="Descripción (opcional)"
        value={f.descripcion}
        onChange={set('descripcion')}
      />
      <Input etiqueta="Marca (opcional)" value={f.marca} onChange={set('marca')} />
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
      <p className="ayuda">
        Los talles y colores se cargan al ingresar la mercadería, en el paso siguiente.
      </p>
    </Modal>
  );
}

function FichaProducto({ producto, onVolver }) {
  const { guardar, guardando } = useGuardar();
  const [f, setF] = useState({
    nombre: producto.nombre,
    descripcion: producto.descripcion ?? '',
    marca: producto.marca ?? '',
    precio: aCentavos(producto.precio_venta),
    costo: aCentavos(producto.costo),
  });
  const set = (campo) => (e) => setF((x) => ({ ...x, [campo]: e.target.value }));

  const guardarDatos = () =>
    guardar(
      () =>
        editarProducto(producto.id, {
          nombre: f.nombre.trim(),
          descripcion: f.descripcion,
          marca: f.marca,
          precio_venta: desdeCentavos(f.precio),
          costo: desdeCentavos(f.costo),
        }),
      'Producto actualizado. El precio nuevo no cambia las ventas ya hechas.',
    );

  const colores = [...new Set(producto.variantes.map((v) => v.color))];
  const talles = ordenarTalles([...new Set(producto.variantes.map((v) => v.talle))]);
  const variante = (color, talle) =>
    producto.variantes.find((v) => v.color === color && v.talle === talle);

  return (
    <section>
      <p>
        <Boton variante="texto" onClick={onVolver}>
          ← Todos los productos
        </Boton>
      </p>
      <h1>
        {producto.nombre}
        {producto.marca && <small className="ayuda"> · {producto.marca}</small>}
      </h1>
      <p className="centrado">
        Precio <strong>{formatearPesos(producto.precio_venta)}</strong> · Costo{' '}
        {formatearPesos(producto.costo)} · Stock <strong>{producto.stock_total}</strong>
        {!producto.activo && <span className="etiqueta etiqueta--gris"> Inactivo</span>}
      </p>

      <NuevoIngreso producto={producto} />

      <div className="panel">
        <h2>Stock por color y talle</h2>
        {producto.variantes.length === 0 ? (
          <p className="tabla__vacia">Todavía no ingresó mercadería.</p>
        ) : (
          <>
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
                        const v = variante(color, talle);
                        if (!v) return <td key={talle} />;
                        return (
                          <td
                            key={talle}
                            className={v.activo ? undefined : 'variante--inactiva'}
                            title={v.activo ? undefined : 'Desactivada: no aparece para vender'}
                          >
                            <strong>{v.stock}</strong>
                            <Boton
                              variante="texto"
                              className="variante__boton"
                              aria-label={`${v.activo ? 'Desactivar' : 'Activar'} ${color} ${talle}`}
                              onClick={() =>
                                guardar(
                                  () => editarVariante(producto.id, v.id, { activo: !v.activo }),
                                  v.activo ? 'Talle desactivado.' : 'Talle activado.',
                                )
                              }
                            >
                              {v.activo ? 'desactivar' : 'activar'}
                            </Boton>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="ayuda">
              Un talle desactivado no aparece para vender, pero conserva su historial.
            </p>
          </>
        )}
      </div>

      <div className="panel formulario">
        <h2>Datos del producto</h2>
        <Input etiqueta="Nombre" value={f.nombre} onChange={set('nombre')} />
        <Input etiqueta="Descripción" value={f.descripcion} onChange={set('descripcion')} />
        <Input etiqueta="Marca" value={f.marca} onChange={set('marca')} />
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
    </section>
  );
}
