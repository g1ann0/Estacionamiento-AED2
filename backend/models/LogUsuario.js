const mongoose = require('mongoose');

/**
 * Log de activación/desactivación de usuarios
 * Registra todos los cambios de estado de usuarios con motivos y datos completos
 */
const LogUsuarioSchema = new mongoose.Schema({
  // Usuario afectado
  usuario: {
    id: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario' },
    dni: String,
    nombre: String,
    apellido: String,
    email: String
  },
  
  // Admin que realiza la acción
  admin: {
    id: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario' },
    dni: String,
    nombre: String,
    apellido: String,
    email: String
  },
  
  // Tipo de acción
  accion: {
    type: String,
    enum: ['desactivacion', 'reactivacion'],
    required: true
  },
  
  // Motivo de la acción
  motivo: {
    type: String,
    required: true
  },
  
  // Datos adicionales
  datosAdicionales: {
    vehiculosAfectados: [String], // Dominios de vehículos
    saldoDisponible: Number,
    emailNotificado: String,
    sesionCerrada: Boolean,
    ipOrigen: String
  },
  
  // Fecha de la acción
  fecha: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Índices para búsquedas
LogUsuarioSchema.index({ 'usuario.dni': 1 });
LogUsuarioSchema.index({ 'admin.dni': 1 });
LogUsuarioSchema.index({ accion: 1 });
LogUsuarioSchema.index({ fecha: -1 });

module.exports = mongoose.model('LogUsuario', LogUsuarioSchema);
