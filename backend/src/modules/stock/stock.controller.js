import * as consulta from './stock.consulta.js';

export async function consultar(req, res) {
  res.json(await consulta.consultar(req.validated.query));
}
