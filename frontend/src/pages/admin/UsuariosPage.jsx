// 14.3 Usuarios: alta, edición (nombre, rol, activo) y reseteo de contraseña. No se borran.
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { crearUsuario, editarUsuario, listarUsuarios, resetearPassword } from '../../api/admin.js';
import { useAuth } from '../../features/auth/AuthContext.jsx';
import { useToast } from '../../components/Toast.jsx';
import { Boton } from '../../components/Boton.jsx';
import { Input, Select } from '../../components/Campo.jsx';
import { Modal } from '../../components/Modal.jsx';
import { Tabla } from '../../components/Tabla.jsx';

const ROLES = [
  { valor: 'secretaria', texto: 'Secretaría' },
  { valor: 'admin', texto: 'Administración' },
];

export function UsuariosPage() {
  const { usuario: yo } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ['usuarios'], queryFn: listarUsuarios });
  const [modal, setModal] = useState(null); // { tipo: 'nuevo' | 'editar' | 'clave', usuario? }

  const ejecutar = async (accion, exito) => {
    try {
      await accion();
      await queryClient.invalidateQueries({ queryKey: ['usuarios'] });
      toast.exito(exito);
      setModal(null);
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <section>
      <h1>Usuarios</h1>
      <Boton onClick={() => setModal({ tipo: 'nuevo' })}>+ Nuevo usuario</Boton>
      <Tabla
        filas={data?.usuarios}
        columnas={[
          { clave: 'nombre', titulo: 'Nombre' },
          { clave: 'username', titulo: 'Usuario' },
          {
            clave: 'rol',
            titulo: 'Rol',
            render: (u) => ROLES.find((r) => r.valor === u.rol)?.texto,
          },
          {
            clave: 'activo',
            titulo: 'Estado',
            render: (u) =>
              u.activo ? 'Activo' : <span className="etiqueta etiqueta--gris">Inactivo</span>,
          },
          {
            clave: 'acciones',
            titulo: '',
            render: (u) => (
              <span className="acciones acciones--tabla">
                <Boton variante="texto" onClick={() => setModal({ tipo: 'editar', usuario: u })}>
                  Editar
                </Boton>
                <Boton variante="texto" onClick={() => setModal({ tipo: 'clave', usuario: u })}>
                  Cambiar contraseña
                </Boton>
                {u.id !== yo.id && (
                  <Boton
                    variante="texto"
                    onClick={() =>
                      ejecutar(
                        () => editarUsuario(u.id, { activo: !u.activo }),
                        u.activo ? `${u.nombre} desactivado.` : `${u.nombre} activado.`,
                      )
                    }
                  >
                    {u.activo ? 'Desactivar' : 'Activar'}
                  </Boton>
                )}
              </span>
            ),
          },
        ]}
      />
      {modal?.tipo === 'nuevo' && (
        <FormUsuario
          titulo="Nuevo usuario"
          inicial={{ nombre: '', username: '', rol: 'secretaria', password: '' }}
          conPassword
          onGuardar={(d) => ejecutar(() => crearUsuario(d), `Usuario ${d.username} creado.`)}
          onCerrar={() => setModal(null)}
        />
      )}
      {modal?.tipo === 'editar' && (
        <FormUsuario
          titulo={`Editar ${modal.usuario.nombre}`}
          inicial={modal.usuario}
          propio={modal.usuario.id === yo.id}
          onGuardar={({ nombre, username, rol }) =>
            ejecutar(
              () => editarUsuario(modal.usuario.id, { nombre, username, rol }),
              'Usuario actualizado.',
            )
          }
          onCerrar={() => setModal(null)}
        />
      )}
      {modal?.tipo === 'clave' && (
        <CambiarClave
          usuario={modal.usuario}
          onGuardar={(password) =>
            ejecutar(() => resetearPassword(modal.usuario.id, password), 'Contraseña cambiada.')
          }
          onCerrar={() => setModal(null)}
        />
      )}
    </section>
  );
}

function FormUsuario({ titulo, inicial, conPassword, propio, onGuardar, onCerrar }) {
  const [f, setF] = useState({
    nombre: inicial.nombre,
    username: inicial.username,
    rol: inicial.rol,
    password: '',
  });
  const set = (campo) => (e) => setF((x) => ({ ...x, [campo]: e.target.value }));
  const valido =
    f.nombre.trim() && f.username.trim().length >= 3 && (!conPassword || f.password.length >= 8);
  return (
    <Modal
      abierto
      titulo={titulo}
      onCerrar={onCerrar}
      pie={
        <Boton
          disabled={!valido}
          onClick={() => onGuardar(conPassword ? f : { ...f, password: undefined })}
        >
          Guardar
        </Boton>
      }
    >
      <Input etiqueta="Nombre" value={f.nombre} onChange={set('nombre')} />
      <Input
        etiqueta="Usuario (para entrar)"
        value={f.username}
        onChange={set('username')}
        ayuda="Mínimo 3 caracteres, sin espacios."
      />
      <Select
        etiqueta="Rol"
        value={f.rol}
        onChange={set('rol')}
        opciones={ROLES}
        disabled={propio}
        ayuda={propio ? 'No podés cambiar tu propio rol.' : undefined}
      />
      {conPassword && (
        <Input
          etiqueta="Contraseña"
          type="password"
          value={f.password}
          onChange={set('password')}
          ayuda="Mínimo 8 caracteres."
          autoComplete="new-password"
        />
      )}
    </Modal>
  );
}

function CambiarClave({ usuario, onGuardar, onCerrar }) {
  const [password, setPassword] = useState('');
  return (
    <Modal
      abierto
      titulo={`Nueva contraseña para ${usuario.nombre}`}
      onCerrar={onCerrar}
      pie={
        <Boton disabled={password.length < 8} onClick={() => onGuardar(password)}>
          Cambiar contraseña
        </Boton>
      }
    >
      <Input
        etiqueta="Contraseña nueva"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        ayuda="Mínimo 8 caracteres."
        autoComplete="new-password"
      />
    </Modal>
  );
}
