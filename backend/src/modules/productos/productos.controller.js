import * as service from './productos.service.js';
import { puede } from '../../config/permisos.js';

/** El admin (productos.gestionar) ve inactivos y costos; secretaría solo lo vendible. */
const opciones = (req) => ({ gestion: puede(req.user.rol, 'productos.gestionar') });

export async function listar(req, res) {
  res.json({ productos: await service.listar(req.validated.query, opciones(req)) });
}

export async function obtener(req, res) {
  res.json({ producto: await service.obtener(req.validated.params.id, opciones(req)) });
}

export async function crear(req, res) {
  res.status(201).json({ producto: await service.crear(req.body) });
}

export async function editar(req, res) {
  res.json({ producto: await service.editar(req.validated.params.id, req.body) });
}
