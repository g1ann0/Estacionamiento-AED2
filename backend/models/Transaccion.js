const mongoose = require('mongoose');

const TransaccionSchema = new mongoose.Schema({
  usuarioDNI: { type: String, required: true },
  fecha: { type: Date, default: Date.now },
  montoAcreditado: { type: Number, required: true },
  montoResultante: { type: Number, required: true },
  tipo: { type: String, enum: ['recarga', 'ingreso'], required: true },
  comprobanteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Comprobante' }
});

module.exports = mongoose.model('Transaccion', TransaccionSchema);
