const mongoose = require('mongoose');

// Numeración por sucursal + tipo de comprobante (ver docs/analisis-gap-cgas/04/05/08).
// A diferencia del ProximoNumero de ConfiguracionEmpresa (global, read-increment-save
// no atómico), este modelo se incrementa siempre con findOneAndUpdate + $inc (un solo
// round-trip, sin ventana de carrera) — ver la nota de concurrencia en la Etapa 0.
//
// Los documentos de Talonario se siembran explícitamente (ver utils/seedData.js), nunca
// por upsert lazy: un upsert combinado con $inc es ambiguo para distinguir "primer
// número asignado" de "conteo posterior a crear el documento", así que un talonario
// faltante es un error de configuración a corregir, no algo a auto-crear en caliente.
const TalonarioSchema = new mongoose.Schema({
  sucursalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Sucursal', required: true },
  puntoVenta: { type: String, required: true },
  // 'nota_credito' tiene su propio talonario: una nota de crédito no consume números del
  // talonario de tickets, igual que en ARCA lleva su propia numeración por tipo.
  tipoComprobante: { type: String, enum: ['ticket', 'factura_b', 'factura_c', 'nota_credito'], required: true },
  proximoNumero: { type: Number, required: true, default: 1 }
}, { timestamps: true });

TalonarioSchema.index({ sucursalId: 1, puntoVenta: 1, tipoComprobante: 1 }, { unique: true });

module.exports = mongoose.model('Talonario', TalonarioSchema);
