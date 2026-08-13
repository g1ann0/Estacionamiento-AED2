const mongoose = require('mongoose');
const { MEDIOS_PAGO } = require('../utils/mediosPago');

// Todo movimiento de dinero de un turno — cobros automáticos de estadía e
// ingresos/egresos manuales unificados en una sola entidad (ver docs/analisis-gap-cgas/06),
// a diferencia de CGAS que separa MovimientoTesoreria / CierreDetalleOtroIngreso /
// CierreDetallePagoGasto.
const MovimientoCajaSchema = new mongoose.Schema({
  turnoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Turno', required: true },
  tipo: { type: String, enum: ['ingreso', 'egreso'], required: true },
  origen: { type: String, enum: ['cobro_estadia', 'manual', 'ajuste', 'devolucion'], required: true },
  medioPago: { type: String, enum: MEDIOS_PAGO, required: true },
  monto: { type: Number, required: true },
  motivo: { type: String, default: '' },
  estadiaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Estacionamiento', default: null },
  comprobanteId: { type: mongoose.Schema.Types.ObjectId, ref: 'ComprobanteEstadia', default: null },
  usuarioId: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  fecha: { type: Date, default: Date.now },
  anulado: { type: Boolean, default: false },
  anuladoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', default: null },
  motivoAnulacion: { type: String, default: null },
  fechaAnulacion: { type: Date, default: null }
}, { timestamps: true });

MovimientoCajaSchema.pre('validate', async function () {
  if (this.origen !== 'cobro_estadia' && !this.motivo) {
    throw new Error('motivo es obligatorio para movimientos de caja que no son cobro de estadía');
  }
});

MovimientoCajaSchema.index({ turnoId: 1, tipo: 1 });
// El resumen de cierre lee los movimientos vivos del turno; el reporte de recaudación agrupa
// por fecha. Los dos filtran por `anulado`, que sin índice obliga a leer todos los movimientos
// del período para descartar unos pocos.
MovimientoCajaSchema.index({ turnoId: 1, anulado: 1 });
MovimientoCajaSchema.index({ fecha: -1, anulado: 1 });

module.exports = mongoose.model('MovimientoCaja', MovimientoCajaSchema);
