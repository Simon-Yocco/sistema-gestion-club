// Compradores (reglas v1.2, sección 5): en el club se conocen por nombre o apodo.
// Para fiado hace falta además el teléfono, para poder cobrarle: ver puedeFiar().
// El número de socio es opcional y hoy no se usa para identificar.
import { Op, UniqueConstraintError } from 'sequelize';
import { sequelize, Comprador } from '../../models/index.js';
import { AppError } from '../../utils/AppError.js';
import { contiene, escaparLike } from '../../utils/sql.js';

/** Cómo se muestra: 'Juan Pérez ("el Turco")', o solo el nombre si no tiene apodo. */
export function etiqueta(c) {
  return c.apodo ? `${c.nombre} ("${c.apodo}")` : c.nombre;
}

export function serializar(c) {
  return {
    id: c.id,
    nombre: c.nombre,
    apodo: c.apodo ?? null,
    etiqueta: etiqueta(c),
    numero_socio: c.numero_socio,
    telefono: c.telefono,
    puede_fiar: puedeFiar(c),
  };
}

/** Regla 5 (v1.2): para fiado, el comprador debe tener nombre y teléfono. */
export function puedeFiar(c) {
  return Boolean(c?.telefono);
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
 * `q` busca en nombre, apodo, número de socio y teléfono (este último comparando solo
 * dígitos, así "11 5555-1234" encuentra "1155551234"). Sin `q`, listado alfabético.
 * Orden: primero los que tienen alguna palabra del nombre o del apodo que empieza con `q`
 * ("tur" encuentra primero a "el Turco"), después el resto, alfabético.
 */
export async function listar({ q, limite }) {
  if (!q) {
    const compradores = await Comprador.findAll({ order: [['nombre', 'ASC']], limit: limite });
    return compradores.map(serializar);
  }

  const condiciones = [
    { nombre: contiene(q) },
    { apodo: contiene(q) },
    { numero_socio: contiene(q) },
  ];
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
      [
        sequelize.literal(
          `CONCAT(' ', nombre, ' ', COALESCE(apodo, '')) LIKE ${escaparTexto(`% ${escaparLike(q)}%`)}`,
        ),
        'DESC',
      ],
      ['nombre', 'ASC'],
    ],
    limit: limite,
  });
  return compradores.map(serializar);
}
