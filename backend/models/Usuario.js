const mongoose = require('mongoose');

const VehiculoSchema = new mongoose.Schema({
  marca: { type: String, required: true },
  modelo: { type: String, required: true },
  dominio: { type: String, required: true, unique: true }, // patente única
  tipo: { type: String, enum: ['auto', 'moto'], required: true }
});

const UsuarioSchema = new mongoose.Schema({
  dni: { type: String, required: true, unique: true },
  nombre: String,
  apellido: String,
  abono: { type: Boolean, default: false },
  montoDisponible: { type: Number, default: 0 },
  vehiculos: [VehiculoSchema]
});

module.exports = mongoose.model('Usuario', UsuarioSchema);
