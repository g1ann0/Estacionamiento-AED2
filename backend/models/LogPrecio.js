const mongoose = require('mongoose');

const LogPrecioSchema = new mongoose.Schema({
  tipoUsuario: {
    type: String,
    required: true
  },
  precioAnterior: {
    type: Number,
    default: null
  },
  precioNuevo: {
    type: Number,
    default: null
  },
  descripcionAnterior: {
    type: String,
    default: ''
  },
  descripcionNueva: {
    type: String,
    default: ''
  },
  modificadoPor: {
    dni: { type: String, required: true },
    nombre: { type: String, required: true },
    apellido: { type: String, required: true },
    email: { type: String, required: true }
  },
  fechaModificacion: {
    type: Date,
    default: Date.now
  },
  motivo: {
    type: String,
    default: ''
  },
  ip: {
    type: String,
    default: ''
  }
});

// Índices para mejorar las consultas
LogPrecioSchema.index({ tipoUsuario: 1, fechaModificacion: -1 });
LogPrecioSchema.index({ 'modificadoPor.dni': 1, fechaModificacion: -1 });
LogPrecioSchema.index({ fechaModificacion: -1 });

module.exports = mongoose.model('LogPrecio', LogPrecioSchema);
