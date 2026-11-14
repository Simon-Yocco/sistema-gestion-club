// 3.1 Hash de contraseñas con bcrypt (implementación bcryptjs: no necesita compilar en Windows).
import bcrypt from 'bcryptjs';
import { env } from '../../config/env.js';

// En tests se usa un costo bajo para que la suite sea rápida; en el resto, 10 (≈ 70 ms por hash).
const ROUNDS = env.isTest ? 4 : 10;

export const PASSWORD_MIN = 8;

export function hashPassword(password) {
  return bcrypt.hash(password, ROUNDS);
}

export function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

// Hash válido de una contraseña al azar: se compara contra él cuando el usuario no existe,
// para que la respuesta tarde lo mismo y no revele qué usuarios existen.
const HASH_DE_RELLENO = bcrypt.hashSync(`relleno-${Math.random()}`, ROUNDS);

export function verifyPasswordDeRelleno(password) {
  return bcrypt.compare(password, HASH_DE_RELLENO);
}
