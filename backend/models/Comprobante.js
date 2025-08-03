const mongoose = require('mongoose');

const ComprobanteSchema = new mongoose.Schema({
  fecha: { type: Date, default: Date.now },
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
    enum: ['pendiente', 'aprobado', 'rechazado'],
    default: 'pendiente'
  }
});

module.exports = mongoose.model('Comprobante', ComprobanteSchema);
