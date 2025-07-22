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
  nroComprobante: { type: String, unique: true }
});

module.exports = mongoose.model('Comprobante', ComprobanteSchema);
