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
  rol: { type: String, enum: ['cliente', 'admin', 'operador'], default: 'cliente' },
  asociado: { type: Boolean, default: false },
  tarifaAsignada: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'ConfiguracionPrecio',
    default: null 
  },
  montoDisponible: { type: Number, default: 0 },
  fechaRegistro: { type: Date, default: Date.now },
  fechaDesactivacion: { type: Date } // Fecha cuando se desactivó el usuario

  // `vehiculos[]` se eliminó. Era una copia embebida del catálogo que ya vive en la colección
  // Vehiculo, mantenida a mano en paralelo: cada alta escribía en los dos lados, cada baja
  // borraba en los dos, y cuando se desincronizaban aparecían duplicados. La prueba de que no
  // funcionaba es que existía un endpoint dedicado a limpiar esos duplicados.
  // Los vehículos de un usuario se consultan con: Vehiculo.find({ usuario: usuario._id }).
  // Migración: scripts/migrar-vehiculos-embebidos.js
});

module.exports = mongoose.model('Usuario', UsuarioSchema);
