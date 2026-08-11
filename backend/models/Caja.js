const mongoose = require('mongoose');

// Recurso lógico/físico de cobro (ver docs/analisis-gap-cgas/06/08 Etapa 4). Separado de
// Turno (la sesión de trabajo de un operador sobre esta caja) — misma separación
// conceptual que CGAS (Caja vs CierreTurno), sin la agrupación en "Caja de Tesorería"
// que ahí existe para depósitos bancarios multi-caja (innecesaria acá).
const CajaSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  sucursalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Sucursal', required: false, default: null },
  activa: { type: Boolean, default: true },
  proximoNumeroTurno: { type: Number, default: 1 }
}, { timestamps: true });

module.exports = mongoose.model('Caja', CajaSchema);
