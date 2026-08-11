const mongoose = require('mongoose');

const VehiculoSchema = new mongoose.Schema({
  // Opcional desde Etapa 2 (ver docs/analisis-gap-cgas/07/08) — un vehículo puede
  // existir sin propietario registrado (cliente ocasional / caja).
  usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: false, default: null },
  // marca/modelo/año son opcionales desde la poda: eran `required` y el mostrador no los
  // tiene cuando entra un ocasional, así que el servicio los rellenaba con 'Sin datos' y
  // 'S/D'. Un required que se satisface con un placeholder no valida nada — solo obliga a
  // inventar, y después ese "Sin datos" se muestra en pantalla como si fuera un dato.
  marca: { type: String, default: null },
  modelo: { type: String, default: null },
  dominio: { type: String, required: true, unique: true },
  tipo: { type: String, enum: ['auto', 'moto'], required: true },
  // Sigue siendo String por los datos históricos ('S/D' y años sueltos). Pasarlo a Number
  // necesita una migración aparte; anotado en docs/rediseno-admin/02.
  año: { type: String, default: null },
  activo: { type: Boolean, default: true },
  estActivo: { type: Boolean, default: false },
  ultimoIngreso: { type: Date, default: null },
  sucursalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Sucursal', required: false, default: null }
}, {
  timestamps: true
});

// El índice único de `dominio` ya lo declara el campo con `unique: true`; repetirlo acá
// creaba una definición duplicada que Mongoose 9 reporta como warning en cada arranque.
VehiculoSchema.index({ usuario: 1, dominio: 1 });

module.exports = mongoose.model('Vehiculo', VehiculoSchema);
