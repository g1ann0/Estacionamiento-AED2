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
  tipoComprobante: { type: String, enum: ['ticket', 'factura_b', 'factura_c', 'nota_credito'], default: 'ticket' },
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

  // Integración ARCA (Etapa 6).
  //
  // La numeración fiscal es SEPARADA de la del ticket. El cliente se llevó un ticket con el
  // número del talonario local; cuando ARCA autoriza —después, porque la emisión es diferida—
  // asigna su propio número, que es el que ARCA considera fuente de verdad. Pisar el número
  // del ticket con el fiscal haría que el comprobante que el cliente tiene en la mano no
  // coincida con el que figura en el sistema.
  cae: { type: String, default: null },
  caeFchVto: { type: Date, default: null },
  numeroFiscal: { type: Number, default: null },
  tipoComprobanteFiscal: { type: Number, default: null }, // código de ARCA: 6 = factura B, 11 = C
  fechaAutorizacion: { type: Date, default: null },
  // Un CAE de mock nunca se puede confundir con uno real: queda marcado en la base.
  simulado: { type: Boolean, default: false },
  intentosArca: { type: Number, default: 0 },
  observacionesArca: { type: [mongoose.Schema.Types.Mixed], default: [] },
  erroresArca: { type: [mongoose.Schema.Types.Mixed], default: [] },

  motivoAnulacion: { type: String, default: null },
  fechaAnulacion: { type: Date, default: null },

  // ANULACIÓN FISCAL — un comprobante con CAE no se borra ni se marca de baja: se compensa
  // con una NOTA DE CRÉDITO, que es otro comprobante electrónico con su propio CAE y su
  // propia numeración. ARCA no tiene forma de "deshacer" una autorización.
  //
  // Por eso la nota de crédito es un ComprobanteEstadia más, y estos dos campos son las dos
  // puntas del vínculo:
  //   anulaA        en la nota de crédito, apunta al comprobante que compensa
  //   anuladoPorId  en el comprobante original, apunta a la nota de crédito
  anulaA: { type: mongoose.Schema.Types.ObjectId, ref: 'ComprobanteEstadia', default: null },
  anuladoPorId: { type: mongoose.Schema.Types.ObjectId, ref: 'ComprobanteEstadia', default: null },
  fechaEmision: { type: Date, default: Date.now }
}, { timestamps: true });

// Mejora respecto a CGAS (ver doc 05): constraint de unicidad real en base de datos,
// no solo aplicativa.
ComprobanteEstadiaSchema.index({ puntoVenta: 1, tipoComprobante: 1, numero: 1 }, { unique: true });
ComprobanteEstadiaSchema.index({ estadiaId: 1 });

// La numeración fiscal también es única, y por el mismo motivo que la del ticket: dos
// comprobantes con el mismo número fiscal es una inconsistencia que ARCA no perdona. El índice
// es parcial porque la mayoría de los comprobantes todavía no tiene número fiscal, y `null`
// se repetiría en todos.
ComprobanteEstadiaSchema.index(
  { puntoVenta: 1, tipoComprobanteFiscal: 1, numeroFiscal: 1 },
  { unique: true, partialFilterExpression: { numeroFiscal: { $type: 'number' } } }
);

// El worker de emisión diferida busca por acá: los que esperan CAE, más viejos primero.
ComprobanteEstadiaSchema.index({ estado: 1, fechaEmision: 1 });

module.exports = mongoose.model('ComprobanteEstadia', ComprobanteEstadiaSchema);
