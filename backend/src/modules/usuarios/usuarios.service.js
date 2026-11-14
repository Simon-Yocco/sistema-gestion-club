// 3.7 ABM de usuarios (solo admin). Los usuarios no se borran: se desactivan.
import { UniqueConstraintError } from 'sequelize';
import { Usuario } from '../../models/index.js';
import { AppError } from '../../utils/AppError.js';
import { hashPassword } from '../auth/password.js';
import { usuarioPublico } from '../auth/auth.service.js';

const conFechas = (u) => ({
  ...usuarioPublico(u),
  // Con underscored, Sequelize expone las columnas created_at/updated_at como createdAt/updatedAt.
  created_at: u.createdAt,
  updated_at: u.updatedAt,
});

async function buscar(id) {
  const usuario = await Usuario.findByPk(id);
  if (!usuario) throw AppError.notFound('El usuario no existe.', 'USUARIO_NO_ENCONTRADO');
  return usuario;
}

/** Traduce el error de username duplicado a un 409 legible. */
async function guardando(operacion) {
  try {
    return await operacion();
  } catch (err) {
    if (err instanceof UniqueConstraintError) {
      throw AppError.conflict('USERNAME_EN_USO', 'Ya existe un usuario con ese nombre de usuario.');
    }
    throw err;
  }
}

export async function listar({ activo } = {}) {
  const where = activo === undefined ? {} : { activo };
  const usuarios = await Usuario.findAll({ where, order: [['nombre', 'ASC']] });
  return usuarios.map(conFechas);
}

export async function obtener(id) {
  return conFechas(await buscar(id));
}

export async function crear({ password, ...datos }) {
  const password_hash = await hashPassword(password);
  const usuario = await guardando(() => Usuario.create({ ...datos, password_hash }));
  return conFechas(usuario);
}

/**
 * Edita nombre, username, rol o activo. Un admin no puede desactivarse ni quitarse el rol
 * a sí mismo: así siempre queda al menos un administrador activo (el que está operando).
 */
export async function editar(id, cambios, actor) {
  const usuario = await buscar(id);

  if (usuario.id === actor.id) {
    if (cambios.activo === false) {
      throw AppError.conflict('OPERACION_SOBRE_SI_MISMO', 'No podés desactivar tu propio usuario.');
    }
    if (cambios.rol !== undefined && cambios.rol !== usuario.rol) {
      throw AppError.conflict('OPERACION_SOBRE_SI_MISMO', 'No podés cambiar tu propio rol.');
    }
  }

  await guardando(() => usuario.update(cambios));
  return conFechas(usuario);
}

export async function resetearPassword(id, password) {
  const usuario = await buscar(id);
  await usuario.update({ password_hash: await hashPassword(password) });
}
