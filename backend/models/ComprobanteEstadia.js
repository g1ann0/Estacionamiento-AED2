const mongoose = require('mongoose');
const { MEDIOS_PAGO } = require('../utils/mediosPago');

// Comprobante emitido por el COBRO DE UNA ESTADÍA — distinto de Comprobante.js/Factura.js,
// que existen únicamente para la recarga de saldo prepago (ver docs/analisis-gap-cgas/02/03).
//
// Campos de ARCA (cae/caeFchVto/observacionesArca/erroresArca) ya están en el schema desde
// esta etapa aunque no se usan todavía — Etapa 6 los completa con la integración real
// WSAA/WSFE (decisión de alcance: ARCA real, sin modo mock permanente). Hasta entonces,
// todo comprobante se emite como 'ticket' (no fiscal, no requiere CAE) en estado 'emitido'.
const ComprobanteEstadiaSchema = new mongoose.Schema({
  numero: { type: Number, required: true },
  puntoVenta: { type: String, required: true },
  tipoComprobante: { type: String, enum: ['ticket', 'factura_b', 'factura_c'], default: 'ticket' },
  sucursalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Sucursal', required: false, default: null },
  estadiaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Estacionamiento', required: true },
  transaccionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaccion', required: false, default: null },

  receptor: {
    tipo: { type: String, enum: ['usuario', 'clienteOcasional', 'consumidor_final'], required: true },
    dni: { type: String, default: null },
    nombre: { type: String, default: 'Consumidor' },
    apellido: { type: String, default: 'Final' },
    condicionIva: { type: String, default: 'Consumidor Final' }
  },

  medioPago: { type: String, enum: MEDIOS_PAGO, required: true },
  subtotal: { type: Number, required: true },
  iva: {
    porcentaje: { type: Number, default: 0 },
    monto: { type: Number, default: 0 }
  },
  total: { type: Number, required: true },

  // Estado explícito (no inferido de flags — ver docs/analisis-gap-cgas/05, mejora sobre CGAS).
  estado: { type: String, enum: ['emitido', 'pendiente_cae', 'error_arca', 'anulado'], default: 'emitido' },

  // Campos de integración ARCA real — sin uso hasta Etapa 6.
  cae: { type: String, default: null },
  caeFchVto: { type: Date, default: null },
  observacionesArca: { type: [mongoose.Schema.Types.Mixed], default: [] },
  erroresArca: { type: [mongoose.Schema.Types.Mixed], default: [] },

  motivoAnulacion: { type: String, default: null },
  fechaAnulacion: { type: Date, default: null },
  fechaEmision: { type: Date, default: Date.now }
}, { timestamps: true });

// Mejora respecto a CGAS (ver doc 05): constraint de unicidad real en base de datos,
// no solo aplicativa.
ComprobanteEstadiaSchema.index({ puntoVenta: 1, tipoComprobante: 1, numero: 1 }, { unique: true });
ComprobanteEstadiaSchema.index({ estadiaId: 1 });

module.exports = mongoose.model('ComprobanteEstadia', ComprobanteEstadiaSchema);
