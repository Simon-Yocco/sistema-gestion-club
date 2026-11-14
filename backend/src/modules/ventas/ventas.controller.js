import * as service from './ventas.service.js';
import { puede } from '../../config/permisos.js';

export async function crear(req, res) {
  res.status(201).json({ venta: await service.crear(req.body, req.user) });
}

export async function listar(req, res) {
  res.json(await service.listar(req.validated.query));
}

export async function obtener(req, res) {
  // Costos y ganancia solo para quien ve reportes (admin).
  const verCostos = puede(req.user.rol, 'reportes.ver');
  res.json({ venta: await service.obtener(req.validated.params.id, { verCostos }) });
}
