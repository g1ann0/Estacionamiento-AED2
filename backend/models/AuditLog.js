const mongoose = require('mongoose');

// Modelo único de auditoría. Reemplazó a los cuatro modelos ad-hoc que existían —LogSaldo,
// LogVehiculo, LogPrecio y LogConfiguracionEmpresa—, cada uno con su propio esquema y su
// propia manera de nombrar lo mismo. Ver services/auditoriaService.js.
//
// `actor` es quién hizo el cambio; `afectado` es sobre quién recayó (pueden ser distintos:
// un admin ajustando el saldo de un cliente). Los cuatro modelos viejos guardaban ese mismo
// par con nombres diferentes en cada uno.
const bloquePersona = {
  dni: { type: String, default: null },
  nombre: { type: String, default: null },
  apellido: { type: String, default: null },
  email: { type: String, default: null }
};

const AuditLogSchema = new mongoose.Schema({
  entidad: { type: String, required: true },      // ej. 'Estacionamiento', 'Usuario', 'Vehiculo'
  entidadId: { type: String, required: true },     // _id del documento afectado (String para admitir ids no-ObjectId, ej. dominio)
  accion: { type: String, required: true },        // ej. 'ingreso', 'egreso', 'cambio_saldo', 'cambio_precio'
  usuarioId: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: false },
  usuarioDni: { type: String, required: false },
  actor: { type: bloquePersona, default: null },
  afectado: { type: bloquePersona, default: null },
  fecha: { type: Date, default: Date.now },
  ip: { type: String, default: '' },
  datosAnteriores: { type: mongoose.Schema.Types.Mixed, default: null },
  datosNuevos: { type: mongoose.Schema.Types.Mixed, default: null },
  motivo: { type: String, default: '' }
});

AuditLogSchema.index({ entidad: 1, entidadId: 1, fecha: -1 });
AuditLogSchema.index({ accion: 1, fecha: -1 });
AuditLogSchema.index({ fecha: -1 });
AuditLogSchema.index({ 'actor.dni': 1, fecha: -1 });
AuditLogSchema.index({ 'afectado.dni': 1, fecha: -1 });

module.exports = mongoose.model('AuditLog', AuditLogSchema);
