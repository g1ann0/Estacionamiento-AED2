const mongoose = require('mongoose');
const { obtenerFechaArgentina } = require('../utils/fechaArgentina');

const ComprobanteSchema = new mongoose.Schema({
  fecha: { 
    type: Date, 
    default: obtenerFechaArgentina // Usar hora de Argentina
  },
  usuario: {
    dni: String,
    nombre: String,
    apellido: String
  },
  montoAcreditado: Number,
  montoDisponible: Number,
  vehiculos: [String], // lista de dominios
  nroComprobante: { type: String, unique: true },
  estado: {
    type: String,
    enum: ['pendiente', 'aprobado', 'rechazado', 'facturado'],
    default: 'pendiente'
  },
  // Referencia a la factura electrónica generada (si fue aprobado y facturado)
  facturaGenerada: {
    nroFactura: String,
    cae: String,
    fechaEmision: Date,
    tipoComprobante: Number,
    tipoComprobanteDescripcion: String
  },
  // Datos del admin que aprobó/rechazó
  aprobadoPor: {
    dni: String,
    nombre: String,
    apellido: String,
    fecha: Date
  },
  observaciones: String // Observaciones del admin al aprobar/rechazar
});

module.exports = mongoose.model('Comprobante', ComprobanteSchema);
