// Compradores (reglas, sección 5): nombre, número de socio y teléfono.
// Para fiado tiene que ser identificable (socio o teléfono): ver esIdentificable().
import { UniqueConstraintError } from 'sequelize';
import { Comprador } from '../../models/index.js';
import { AppError } from '../../utils/AppError.js';

export function serializar(c) {
  return {
    id: c.id,
    nombre: c.nombre,
    numero_socio: c.numero_socio,
    telefono: c.telefono,
    identificable: esIdentificable(c),
  };
}

/** Regla 5: para fiado, el comprador debe tener número de socio o teléfono. */
export function esIdentificable(c) {
  return Boolean(c?.numero_socio || c?.telefono);
}

async function guardando(operacion) {
  try {
    return await operacion();
  } catch (err) {
    if (err instanceof UniqueConstraintError) {
      throw AppError.conflict('SOCIO_DUPLICADO', 'Ya hay un comprador con ese número de socio.');
    }
    throw err;
  }
}

export async function buscar(id, opciones = {}) {
  const comprador = await Comprador.findByPk(id, opciones);
  if (!comprador) throw AppError.notFound('El comprador no existe.', 'COMPRADOR_NO_ENCONTRADO');
  return comprador;
}

export async function crear(datos, opciones = {}) {
  return guardando(() => Comprador.create(datos, opciones));
}

export async function obtener(id) {
  return serializar(await buscar(id));
}

export async function editar(id, cambios) {
  const comprador = await buscar(id);
  await guardando(() => comprador.update(cambios));
  return serializar(comprador);
}

/** Listado alfabético (la búsqueda por texto se agrega en 6.2). */
export async function listar({ limite }) {
  const compradores = await Comprador.findAll({ order: [['nombre', 'ASC']], limit: limite });
  return compradores.map(serializar);
}
