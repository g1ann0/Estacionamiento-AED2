const mongoose = require('mongoose');

const LogSaldoSchema = new mongoose.Schema({
  usuarioAfectado: {
    dni: { type: String, required: true },
    nombre: { type: String, required: true },
    apellido: { type: String, required: true },
    email: { type: String, required: true }
  },
  saldoAnterior: {
    type: Number,
    required: true
  },
  saldoNuevo: {
    type: Number,
    required: true
  },
  diferencia: {
    type: Number,
    required: true
  },
  tipoOperacion: {
    type: String,
    enum: ['ajuste_admin', 'recarga', 'descuento', 'correccion'],
    default: 'ajuste_admin'
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
    required: true
  },
  ip: {
    type: String,
    default: ''
  },
  observaciones: {
    type: String,
    default: ''
  }
});

// Índices para mejorar las consultas
LogSaldoSchema.index({ 'usuarioAfectado.dni': 1, fechaModificacion: -1 });
LogSaldoSchema.index({ 'modificadoPor.dni': 1, fechaModificacion: -1 });
LogSaldoSchema.index({ fechaModificacion: -1 });
LogSaldoSchema.index({ tipoOperacion: 1, fechaModificacion: -1 });

module.exports = mongoose.model('LogSaldo', LogSaldoSchema);
