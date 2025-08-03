const mongoose = require('mongoose');

const LogVehiculoSchema = new mongoose.Schema({
  vehiculo: {
    dominio: { type: String, required: true },
    tipo: { type: String, required: true },
    marca: { type: String, required: true },
    modelo: { type: String, required: true },
    año: { type: String, required: true }
  },
  tipoOperacion: {
    type: String,
    enum: ['crear', 'modificar', 'eliminar', 'cambio_propietario'],
    required: true
  },
  propietarioAnterior: {
    dni: { type: String },
    nombre: { type: String },
    apellido: { type: String },
    email: { type: String }
  },
  propietarioNuevo: {
    dni: { type: String },
    nombre: { type: String },
    apellido: { type: String },
    email: { type: String }
  },
  cambiosRealizados: {
    dominioAnterior: { type: String },
    tipoAnterior: { type: String },
    marcaAnterior: { type: String },
    modeloAnterior: { type: String },
    añoAnterior: { type: String }
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
LogVehiculoSchema.index({ 'vehiculo.dominio': 1, fechaModificacion: -1 });
LogVehiculoSchema.index({ 'propietarioAnterior.dni': 1, fechaModificacion: -1 });
LogVehiculoSchema.index({ 'propietarioNuevo.dni': 1, fechaModificacion: -1 });
LogVehiculoSchema.index({ 'modificadoPor.dni': 1, fechaModificacion: -1 });
LogVehiculoSchema.index({ tipoOperacion: 1, fechaModificacion: -1 });
LogVehiculoSchema.index({ fechaModificacion: -1 });

module.exports = mongoose.model('LogVehiculo', LogVehiculoSchema);
