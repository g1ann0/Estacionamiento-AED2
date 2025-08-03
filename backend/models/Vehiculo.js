const mongoose = require('mongoose');

const VehiculoSchema = new mongoose.Schema({
  usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  marca: { type: String, required: true },
  modelo: { type: String, required: true },
  dominio: { type: String, required: true, unique: true },
  tipo: { type: String, enum: ['auto', 'moto'], required: true },
  año: { type: String, required: true },
  activo: { type: Boolean, default: true },
  estActivo: { type: Boolean, default: false },
  ultimoIngreso: { type: Date, default: null }
}, {
  timestamps: true
});

// Índices para mejorar las búsquedas
VehiculoSchema.index({ usuario: 1, dominio: 1 });
VehiculoSchema.index({ dominio: 1 }, { unique: true });

module.exports = mongoose.model('Vehiculo', VehiculoSchema);
