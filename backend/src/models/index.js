// Modelos Sequelize y sus asociaciones. Importar siempre desde acá:
//   import { Producto, Variante, sequelize } from '../models/index.js';
//
// Convenciones (ver src/config/db.js): tablas en singular y columnas en snake_case.
// Los DECIMAL llegan como string: convertir con utils/money.js (toCents).
import { DataTypes } from 'sequelize';
import { sequelize } from '../config/db.js';
import {
  ROLES,
  MEDIOS_PAGO,
  ESTADOS_VENTA,
  ORIGENES_VENTA_ITEM,
  TIPOS_PAGO,
  TIPOS_DEVOLUCION,
  RESOLUCIONES_CAMBIO,
  CONCEPTOS_EGRESO,
  TIPOS_TRANSFERENCIA_MEDIOS,
  TIPOS_MOVIMIENTO,
} from '../config/constantes.js';

const { INTEGER, STRING, TEXT, BOOLEAN, DATE, DATEONLY, DECIMAL, ENUM } = DataTypes;

// Funciones (no objetos compartidos): Sequelize modifica la definición de cada atributo al usarla.
const id = () => ({ type: INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true });
const fk = (allowNull = false) => ({ type: INTEGER.UNSIGNED, allowNull });
const dinero = () => ({ type: DECIMAL(12, 2), allowNull: false });
const ahora = () => ({ type: DATE, allowNull: false, defaultValue: DataTypes.NOW });

/** Tablas de catálogo: created_at + updated_at. */
const conUpdatedAt = (tableName) => ({ tableName });
/** Tablas operativas: solo created_at (no se editan; se corrigen con movimientos inversos). */
const soloCreatedAt = (tableName) => ({ tableName, updatedAt: false });

// ---------------------------------------------------------------- Catálogo

export const Usuario = sequelize.define(
  'Usuario',
  {
    id: id(),
    nombre: { type: STRING(100), allowNull: false },
    username: { type: STRING(50), allowNull: false, unique: true },
    password_hash: { type: STRING(100), allowNull: false },
    rol: { type: ENUM(...ROLES), allowNull: false },
    activo: { type: BOOLEAN, allowNull: false, defaultValue: true },
  },
  {
    ...conUpdatedAt('usuario'),
    // Nunca devolver el hash por accidente: hay que pedirlo con Usuario.scope('conPassword').
    defaultScope: { attributes: { exclude: ['password_hash'] } },
    scopes: { conPassword: { attributes: { include: ['password_hash'] } } },
  },
);

export const Producto = sequelize.define(
  'Producto',
  {
    id: id(),
    nombre: { type: STRING(100), allowNull: false, unique: true },
    descripcion: { type: TEXT, allowNull: true },
    precio_venta: dinero(),
    costo: dinero(),
    activo: { type: BOOLEAN, allowNull: false, defaultValue: true },
  },
  conUpdatedAt('producto'),
);

export const Variante = sequelize.define(
  'Variante',
  {
    id: id(),
    producto_id: fk(),
    talle: { type: STRING(20), allowNull: false },
    color: { type: STRING(40), allowNull: false },
    stock: { type: INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
    activo: { type: BOOLEAN, allowNull: false, defaultValue: true },
  },
  conUpdatedAt('variante'),
);

export const Comprador = sequelize.define(
  'Comprador',
  {
    id: id(),
    nombre: { type: STRING(100), allowNull: false },
    apodo: { type: STRING(60), allowNull: true },
    // Opcional: hoy no se usa para identificar (reglas v1.2), queda por si se implementa.
    numero_socio: { type: STRING(20), allowNull: true, unique: true },
    telefono: { type: STRING(30), allowNull: true },
  },
  conUpdatedAt('comprador'),
);

// ---------------------------------------------------------------- Mercadería

export const IngresoMercaderia = sequelize.define(
  'IngresoMercaderia',
  {
    id: id(),
    fecha: { type: DATEONLY, allowNull: false },
    proveedor: { type: STRING(100), allowNull: true },
    observaciones: { type: TEXT, allowNull: true },
    usuario_id: fk(),
  },
  soloCreatedAt('ingreso_mercaderia'),
);

export const IngresoItem = sequelize.define(
  'IngresoItem',
  {
    id: id(),
    ingreso_id: fk(),
    variante_id: fk(),
    cantidad: { type: INTEGER.UNSIGNED, allowNull: false },
    costo_unitario: dinero(),
  },
  soloCreatedAt('ingreso_item'),
);

// ---------------------------------------------------------------- Ventas

export const Venta = sequelize.define(
  'Venta',
  {
    id: id(),
    fecha: ahora(),
    comprador_id: fk(true),
    usuario_id: fk(),
    estado: { type: ENUM(...ESTADOS_VENTA), allowNull: false, defaultValue: 'activa' },
    motivo_anulacion: { type: TEXT, allowNull: true },
    anulada_por: fk(true),
    anulada_at: { type: DATE, allowNull: true },
  },
  soloCreatedAt('venta'),
);

export const VentaItem = sequelize.define(
  'VentaItem',
  {
    id: id(),
    venta_id: fk(),
    variante_id: fk(),
    cantidad: { type: INTEGER.UNSIGNED, allowNull: false },
    precio_unitario: dinero(),
    costo_unitario: dinero(),
    cantidad_devuelta: { type: INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
    origen: { type: ENUM(...ORIGENES_VENTA_ITEM), allowNull: false, defaultValue: 'venta' },
  },
  soloCreatedAt('venta_item'),
);

export const Pago = sequelize.define(
  'Pago',
  {
    id: id(),
    venta_id: fk(),
    // NULL solo en créditos de cambio sin venta registrada (tipo 'credito_cambio').
    medio: { type: ENUM(...MEDIOS_PAGO), allowNull: true },
    monto: dinero(),
    tipo: { type: ENUM(...TIPOS_PAGO), allowNull: false },
    fecha: ahora(),
    usuario_id: fk(),
  },
  soloCreatedAt('pago'),
);

export const Devolucion = sequelize.define(
  'Devolucion',
  {
    id: id(),
    venta_id: fk(),
    tipo: { type: ENUM(...TIPOS_DEVOLUCION), allowNull: false, defaultValue: 'devolucion' },
    motivo: { type: TEXT, allowNull: false },
    fecha: ahora(),
    usuario_id: fk(),
  },
  soloCreatedAt('devolucion'),
);

export const DevolucionItem = sequelize.define(
  'DevolucionItem',
  {
    id: id(),
    devolucion_id: fk(),
    venta_item_id: fk(),
    cantidad: { type: INTEGER.UNSIGNED, allowNull: false },
  },
  soloCreatedAt('devolucion_item'),
);

export const Cambio = sequelize.define(
  'Cambio',
  {
    id: id(),
    venta_id: fk(true),
    venta_item_devuelto_id: fk(true),
    variante_devuelta_id: fk(),
    cantidad_devuelta: { type: INTEGER.UNSIGNED, allowNull: false },
    valor_devuelto: dinero(),
    venta_item_nuevo_id: fk(),
    cantidad_nueva: { type: INTEGER.UNSIGNED, allowNull: false },
    valor_nuevo: dinero(),
    diferencia: dinero(),
    resolucion: { type: ENUM(...RESOLUCIONES_CAMBIO), allowNull: false },
    motivo: { type: TEXT, allowNull: true },
    fecha: ahora(),
    usuario_id: fk(),
  },
  soloCreatedAt('cambio'),
);

// ---------------------------------------------------------------- Fondos

export const Egreso = sequelize.define(
  'Egreso',
  {
    id: id(),
    fecha: { type: DATEONLY, allowNull: false },
    monto: dinero(),
    medio: { type: ENUM(...MEDIOS_PAGO), allowNull: false },
    concepto: { type: ENUM(...CONCEPTOS_EGRESO), allowNull: false },
    descripcion: { type: TEXT, allowNull: true },
    comprobante: { type: STRING(50), allowNull: true },
    ingreso_mercaderia_id: fk(true),
    usuario_id: fk(),
  },
  soloCreatedAt('egreso'),
);

export const TransferenciaMedios = sequelize.define(
  'TransferenciaMedios',
  {
    id: id(),
    fecha: { type: DATEONLY, allowNull: false },
    tipo: { type: ENUM(...TIPOS_TRANSFERENCIA_MEDIOS), allowNull: false },
    monto: dinero(),
    descripcion: { type: TEXT, allowNull: true },
    comprobante: { type: STRING(50), allowNull: true },
    usuario_id: fk(),
  },
  soloCreatedAt('transferencia_medios'),
);

export const MovimientoFondos = sequelize.define(
  'MovimientoFondos',
  {
    id: id(),
    fecha: ahora(),
    medio: { type: ENUM(...MEDIOS_PAGO), allowNull: false },
    monto: dinero(),
    tipo: { type: ENUM(...TIPOS_MOVIMIENTO), allowNull: false },
    referencia_tipo: { type: STRING(40), allowNull: true },
    referencia_id: { type: INTEGER.UNSIGNED, allowNull: true },
    descripcion: { type: STRING(255), allowNull: true },
    usuario_id: fk(),
  },
  soloCreatedAt('movimiento_fondos'),
);

// ---------------------------------------------------------------- Asociaciones

Producto.hasMany(Variante, { foreignKey: 'producto_id', as: 'variantes' });
Variante.belongsTo(Producto, { foreignKey: 'producto_id', as: 'producto' });

IngresoMercaderia.hasMany(IngresoItem, { foreignKey: 'ingreso_id', as: 'items' });
IngresoItem.belongsTo(IngresoMercaderia, { foreignKey: 'ingreso_id', as: 'ingreso' });
IngresoItem.belongsTo(Variante, { foreignKey: 'variante_id', as: 'variante' });
IngresoMercaderia.belongsTo(Usuario, { foreignKey: 'usuario_id', as: 'usuario' });
IngresoMercaderia.hasMany(Egreso, { foreignKey: 'ingreso_mercaderia_id', as: 'egresos' });

Comprador.hasMany(Venta, { foreignKey: 'comprador_id', as: 'ventas' });
Venta.belongsTo(Comprador, { foreignKey: 'comprador_id', as: 'comprador' });
Venta.belongsTo(Usuario, { foreignKey: 'usuario_id', as: 'usuario' });
Venta.belongsTo(Usuario, { foreignKey: 'anulada_por', as: 'anuladaPor' });
Venta.hasMany(VentaItem, { foreignKey: 'venta_id', as: 'items' });
Venta.hasMany(Pago, { foreignKey: 'venta_id', as: 'pagos' });
Venta.hasMany(Devolucion, { foreignKey: 'venta_id', as: 'devoluciones' });
Venta.hasMany(Cambio, { foreignKey: 'venta_id', as: 'cambios' });

VentaItem.belongsTo(Venta, { foreignKey: 'venta_id', as: 'venta' });
VentaItem.belongsTo(Variante, { foreignKey: 'variante_id', as: 'variante' });

Pago.belongsTo(Venta, { foreignKey: 'venta_id', as: 'venta' });
Pago.belongsTo(Usuario, { foreignKey: 'usuario_id', as: 'usuario' });

Devolucion.belongsTo(Venta, { foreignKey: 'venta_id', as: 'venta' });
Devolucion.belongsTo(Usuario, { foreignKey: 'usuario_id', as: 'usuario' });
Devolucion.hasMany(DevolucionItem, { foreignKey: 'devolucion_id', as: 'items' });
DevolucionItem.belongsTo(Devolucion, { foreignKey: 'devolucion_id', as: 'devolucion' });
DevolucionItem.belongsTo(VentaItem, { foreignKey: 'venta_item_id', as: 'ventaItem' });

Cambio.belongsTo(Venta, { foreignKey: 'venta_id', as: 'venta' });
Cambio.belongsTo(VentaItem, { foreignKey: 'venta_item_devuelto_id', as: 'itemDevuelto' });
Cambio.belongsTo(VentaItem, { foreignKey: 'venta_item_nuevo_id', as: 'itemNuevo' });
Cambio.belongsTo(Variante, { foreignKey: 'variante_devuelta_id', as: 'varianteDevuelta' });
Cambio.belongsTo(Usuario, { foreignKey: 'usuario_id', as: 'usuario' });

Egreso.belongsTo(IngresoMercaderia, { foreignKey: 'ingreso_mercaderia_id', as: 'ingreso' });
Egreso.belongsTo(Usuario, { foreignKey: 'usuario_id', as: 'usuario' });
TransferenciaMedios.belongsTo(Usuario, { foreignKey: 'usuario_id', as: 'usuario' });
MovimientoFondos.belongsTo(Usuario, { foreignKey: 'usuario_id', as: 'usuario' });

export { sequelize };
