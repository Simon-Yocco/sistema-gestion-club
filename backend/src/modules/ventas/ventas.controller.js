import * as service from './ventas.service.js';
import { puede } from '../../config/permisos.js';

export async function crear(req, res) {
  res.status(201).json({ venta: await service.crear(req.body, req.user) });
}

export async function listar(req, res) {
  res.json(await service.listar(req.validated.query));
}

// Costos y ganancia solo para quien ve reportes (admin).
const opciones = (req) => ({ verCostos: puede(req.user.rol, 'reportes.ver') });

export async function obtener(req, res) {
  res.json({ venta: await service.obtener(req.validated.params.id, opciones(req)) });
}

export async function cobrar(req, res) {
  const { id } = req.validated.params;
  await service.cobrar(id, req.body.pagos, req.user);
  res.status(201).json({ venta: await service.obtener(id, opciones(req)) });
}
