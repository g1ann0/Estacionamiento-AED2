const mongoose = require('mongoose');

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
    marca: {
      type: String,
      required: true
    },
    modelo: {
      type: String,
      required: true
    },
    tipo: {
      type: String,
      enum: ['auto', 'moto'],
      required: true
    }
  },
  propietario: {
    dni: {
      type: String,
      required: true
    },
    nombre: {
      type: String,
      required: true
    },
    apellido: {
      type: String,
      required: true
    }
  },
  porton: {
    type: String,
    enum: ['Norte', 'Sur', 'Este', 'Oeste'],
    required: true
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
  estado: {
    type: String,
    enum: ['activo', 'finalizado'],
    default: 'activo'
  }
}, {
  timestamps: true
});

// Validaciones
TransaccionSchema.pre('save', function(next) {
  // Si es una transacción de salida, asegurarse que tenga duración
  if (this.tipo === 'salida' && !this.duracion) {
    return next(new Error('Las transacciones de salida deben incluir la duración'));
  }
  next();
});

module.exports = mongoose.model('Transaccion', TransaccionSchema);
