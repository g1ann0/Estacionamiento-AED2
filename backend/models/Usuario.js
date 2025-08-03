const mongoose = require('mongoose');

const UsuarioSchema = new mongoose.Schema({
  dni: { type: String, required: true, unique: true },
  nombre: String,
  apellido: String,
  email: { type: String, required: true, unique: true },
  password: { type: String }, // se setea luego de verificación
  verificado: { type: Boolean, default: false },
  activo: { type: Boolean, default: true }, // Para control de activación/desactivación
  tokenVerificacion: { type: String },
  tokenRecuperacion: { type: String }, // Token para recuperar contraseña
  fechaTokenRecuperacion: { type: Date }, // Fecha del token de recuperación
  rol: { type: String, enum: ['cliente', 'admin'], default: 'cliente' },
  asociado: { type: Boolean, default: false },
  montoDisponible: { type: Number, default: 0 },
  fechaRegistro: { type: Date, default: Date.now },
  fechaDesactivacion: { type: Date }, // Fecha cuando se desactivó el usuario
  vehiculos: [{
    dominio: { type: String, required: true },
    tipo: { type: String, enum: ['auto', 'moto'], required: true },
    marca: { type: String, required: true },
    modelo: { type: String, required: true },
    año: { type: String, required: true }
  }]
});

module.exports = mongoose.model('Usuario', UsuarioSchema);
