// Compradores (reglas, sección 5): nombre, número de socio y teléfono.
// Para fiado tiene que ser identificable (socio o teléfono): ver esIdentificable().
import { Op, UniqueConstraintError } from 'sequelize';
import { sequelize, Comprador } from '../../models/index.js';
import { AppError } from '../../utils/AppError.js';
import { contiene, escaparLike } from '../../utils/sql.js';

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

/**
 * 6.2 Búsqueda rápida para autocompletar en la pantalla de venta.
 * `q` busca en nombre, número de socio y teléfono (este último comparando solo dígitos,
 * así "11 5555-1234" encuentra "1155551234"). Sin `q`, listado alfabético.
 * Orden: socio exacto primero, después nombres que empiezan con `q`, después el resto.
 */
export async function listar({ q, limite }) {
  if (!q) {
    const compradores = await Comprador.findAll({ order: [['nombre', 'ASC']], limit: limite });
    return compradores.map(serializar);
  }

  const condiciones = [{ nombre: contiene(q) }, { numero_socio: contiene(q) }];
  const digitos = q.replace(/\D/g, '');
  if (digitos.length >= 3) {
    condiciones.push(
      sequelize.where(
        sequelize.fn(
          'REGEXP_REPLACE',
          sequelize.fn('COALESCE', sequelize.col('telefono'), ''),
          '[^0-9]',
          '',
        ),
        contiene(digitos),
      ),
    );
  }

  const escaparTexto = (t) => sequelize.escape(t);
  const compradores = await Comprador.findAll({
    where: { [Op.or]: condiciones },
    order: [
      // COALESCE: sin socio la comparación da NULL, que en DESC iría al final.
      [sequelize.literal(`COALESCE(numero_socio = ${escaparTexto(q)}, 0)`), 'DESC'],
      [sequelize.literal(`nombre LIKE ${escaparTexto(`${escaparLike(q)}%`)}`), 'DESC'],
      ['nombre', 'ASC'],
    ],
    limit: limite,
  });
  return compradores.map(serializar);
}
