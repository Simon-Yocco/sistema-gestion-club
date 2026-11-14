/**
 * Error de negocio o de request con código HTTP y código de negocio estable
 * (ej.: STOCK_INSUFICIENTE). El middleware de errores lo traduce a
 * { error: { code, message, details } }.
 */
export class AppError extends Error {
  /**
   * @param {number} status   código HTTP (400, 404, 409, ...)
   * @param {string} code     código de negocio en MAYÚSCULAS_CON_GUIONES
   * @param {string} message  mensaje legible para mostrar al usuario
   * @param {unknown} [details] datos extra (campos inválidos, variante sin stock, etc.)
   */
  constructor(status, code, message, details = null) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static badRequest(code, message, details) {
    return new AppError(400, code, message, details);
  }

  static unauthorized(message = 'Tenés que iniciar sesión.', code = 'NO_AUTENTICADO') {
    return new AppError(401, code, message);
  }

  static forbidden(message = 'No tenés permiso para esta operación.', code = 'SIN_PERMISO') {
    return new AppError(403, code, message);
  }

  static notFound(message = 'No encontrado.', code = 'NO_ENCONTRADO') {
    return new AppError(404, code, message);
  }

  static conflict(code, message, details) {
    return new AppError(409, code, message, details);
  }
}
