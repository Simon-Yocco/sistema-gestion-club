import { get, post } from './cliente.js';

/** { usuario, permisos } */
export const login = (username, password) => post('/auth/login', { username, password });
export const logout = () => post('/auth/logout');
/** { usuario, permisos } o ApiError 401 si no hay sesión. */
export const me = () => get('/auth/me');
