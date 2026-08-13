const mongoose = require('mongoose');

// Sesión de trabajo de un operador sobre una Caja, con apertura y cierre EXPLÍCITOS
// (a diferencia de CGAS, donde la apertura es implícita en la creación del CierreTurno —
// ver docs/analisis-gap-cgas/06). Estado explícito en vez de flags booleanas (más simple
// de auditar y validar transiciones que el FaltaEmitirPlanilla de CGAS).
const TurnoSchema = new mongoose.Schema({
  cajaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Caja', required: true },
  numero: { type: Number, required: true },
  operadorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  fechaApertura: { type: Date, default: Date.now },
  montoInicial: { type: Number, required: true },
  fechaCierre: { type: Date, default: null },
  montoDeclaradoCierre: { type: Number, default: null },
  montoEsperadoCierre: { type: Number, default: null },
  diferencia: { type: Number, default: null },
  estado: { type: String, enum: ['abierto', 'cerrado', 'anulado'], default: 'abierto' },
  observacionCierre: { type: String, default: '' },
  cerradoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', default: null }
}, { timestamps: true });

// Anti-doble-apertura: como máximo un Turno 'abierto' por Caja a la vez (índice parcial
// único, no solo una validación aplicativa — ver el patrón del flujo "Gas" de CGAS citado
// en doc 06, que sí lo resuelve bien, a diferencia del flujo legado "Estación").
TurnoSchema.index(
  { cajaId: 1 },
  { unique: true, partialFilterExpression: { estado: 'abierto' } }
);
TurnoSchema.index({ cajaId: 1, numero: 1 }, { unique: true });

// Histórico de cierres y reporte de diferencias (Etapa 7.1): las dos pantallas filtran por
// operador o por caja y ordenan por fecha de apertura.
TurnoSchema.index({ estado: 1, fechaApertura: -1 });
TurnoSchema.index({ operadorId: 1, fechaApertura: -1 });

module.exports = mongoose.model('Turno', TurnoSchema);
