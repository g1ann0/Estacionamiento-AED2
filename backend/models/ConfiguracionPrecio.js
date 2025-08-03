const mongoose = require('mongoose');

const ConfiguracionPrecioSchema = new mongoose.Schema({
  tipoUsuario: { 
    type: String,
    required: true,
    unique: true 
  },
  precioPorHora: { 
    type: Number, 
    required: true,
    min: 0 
  },
  descripcion: { 
    type: String, 
    default: '' 
  },
  fechaCreacion: {
    type: Date,
    default: Date.now
  },
  fechaActualizacion: { 
    type: Date, 
    default: Date.now 
  },
  actualizadoPor: { 
    type: String, 
    required: true 
  },
  activo: {
    type: Boolean,
    default: true
  }
});

module.exports = mongoose.model('ConfiguracionPrecio', ConfiguracionPrecioSchema);
