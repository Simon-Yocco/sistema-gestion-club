import { Op } from 'sequelize';

/** Escapa los comodines de LIKE (\, % y _) para buscar el texto tal cual. */
export function escaparLike(texto) {
  return String(texto).replace(/[\\%_]/g, (c) => `\\${c}`);
}

/** Condición "contiene" para un where de Sequelize: { nombre: contiene(q) }. */
export function contiene(texto) {
  return { [Op.like]: `%${escaparLike(texto)}%` };
}
