const mongoose = require('mongoose');

const EstacionamientoSchema = new mongoose.Schema({
  usuarioDNI: { 
    type: String, 
    required: true 
  },
  vehiculoDominio: {
    type: String,
    required: true
  },
  porton: {
    type: String,
    enum: ['Norte', 'Sur', 'Este', 'Oeste'],
    required: true
  },
  tipoRegistro: {
    type: String,
    enum: ['normal', 'asociado'],
    required: true
  },
  horaInicio: {
    type: Date,
    required: true,
    default: Date.now
  },
  horaFin: {
    type: Date
  },
  duracionHorasReal: {
    type: Number
  },
  duracionHoras: {
    type: Number
  },
  montoTotal: {
    type: Number
  },
  estado: {
    type: String,
    enum: ['activo', 'finalizado'],
    default: 'activo'
  }
}, { timestamps: true });

module.exports = mongoose.model('Estacionamiento', EstacionamientoSchema);
