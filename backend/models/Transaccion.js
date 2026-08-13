const mongoose = require('mongoose');
const { MEDIOS_PAGO } = require('../utils/mediosPago');

const TransaccionSchema = new mongoose.Schema({
  tipo: { 
    type: String, 
    enum: ['ingreso', 'salida'], 
    required: true 
  },
  usuario: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    required: false // No requerido para permitir migración
  },
  vehiculo: { 
    dominio: {
      type: String,
      required: true
    },
    // Opcionales, igual que en Vehiculo: el mostrador no conoce marca ni modelo de un
    // ocasional y no se los va a inventar (ver la nota en models/Vehiculo.js).
    marca: {
      type: String,
      default: null
    },
    modelo: {
      type: String,
      default: null
    },
    tipo: {
      type: String,
      enum: ['auto', 'moto'],
      required: true
    }
  },
  // Opcional desde Etapa 2: una transacción de cliente ocasional no tiene propietario
  // registrado, solo clienteOcasional (ver docs/analisis-gap-cgas/07/08).
  propietario: {
    dni: {
      type: String,
      required: false
    },
    nombre: {
      type: String,
      required: false
    },
    apellido: {
      type: String,
      required: false
    }
  },
  clienteOcasional: {
    nombre: { type: String, required: false },
    telefono: { type: String, required: false },
    documento: { type: String, required: false }
  },
  // 'excepcion': ticket perdido. Ver la nota en models/Estacionamiento.js.
  origen: {
    type: String,
    enum: ['app', 'caja', 'manual', 'api', 'excepcion'],
    default: 'app'
  },
  operadorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: false, default: null },
  sucursalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Sucursal', required: false, default: null },
  // Ver la nota de Estacionamiento.porton: campo conservado por compatibilidad histórica,
  // ya no se pide en ningún flujo.
  porton: {
    type: String,
    enum: ['Norte', 'Sur', 'Este', 'Oeste'],
    required: false,
    default: null
  },
  fechaHora: { 
    type: Date,
    required: true,
    default: Date.now
  },
  duracionHorasReal: {
    type: Number
  },
  duracionHoras: {
    type: Number
  },
  duracion: {
    type: String
  },
  tarifa: {
    type: Number,
    required: true // Tarifa por hora aplicada (250 asociados, 500 no asociados)
  },
  montoTotal: {
    type: Number,
    required: true,
    default: 0
  },
  // Solo se completa en transacciones de tipo 'salida' (ver docs/analisis-gap-cgas/08 Etapa 3).
  // Sin `default`: Mongoose valida el enum incluso contra un default explícito, así que
  // un default de null rechazaría la validación en toda Transaccion de tipo 'ingreso'.
  medioPago: {
    type: String,
    enum: MEDIOS_PAGO,
    required: false
  },
  estado: {
    type: String,
    enum: ['activo', 'finalizado'],
    default: 'activo'
  }
}, {
  timestamps: true
});

TransaccionSchema.index({ 'vehiculo.dominio': 1, tipo: 1, estado: 1 });
// Los listados de ingresos y egresos del panel filtran por tipo y ordenan por fecha; el
// historial del cliente filtra por usuario. Sin estos índices los tres escanean la colección
// que más crece después de la auditoría.
TransaccionSchema.index({ tipo: 1, fechaHora: -1 });
TransaccionSchema.index({ usuario: 1, fechaHora: -1 });

// Validaciones. Mongoose 9 dejó de pasar el callback `next` a los hooks de documento: se
// declaran async y se lanza el error, en vez de invocarlo.
TransaccionSchema.pre('save', async function () {
  // Si es una transacción de salida, asegurarse que tenga duración
  if (this.tipo === 'salida' && !this.duracion) {
    throw new Error('Las transacciones de salida deben incluir la duración');
  }
});

module.exports = mongoose.model('Transaccion', TransaccionSchema);
