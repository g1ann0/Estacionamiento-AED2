const mongoose = require('mongoose');

// Colección real de sucursales (ver docs/analisis-gap-cgas/08 Etapa 2 — decisión de
// alcance: multi-sucursal desde el diseño, no diferido como sugería el doc 05 original
// para alcance de un solo local). Vehiculo/Estacionamiento/Transaccion referencian
// sucursalId como campo opcional; para un despliegue de un solo local alcanza con la
// sucursal "principal" sembrada por defecto (ver utils/seedData.js).
const SucursalSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  direccion: { type: String, default: '' },
  activa: { type: Boolean, default: true },
  esPrincipal: { type: Boolean, default: false }, // única sucursal marcada así en despliegues de un solo local

  // Capacidad de la playa. Sin esto la ocupación no tiene denominador: la terminal solo puede
  // decir "32 adentro", nunca "32 de 40", y "playa completa" es indetectable.
  // `total` es el límite que se controla; el desglose por tipo es informativo hasta que exista
  // un modelo de Sector con capacidad propia (ver docs/rediseno-admin/02).
  // En null, la ocupación se muestra sin denominador en vez de inventar uno.
  capacidad: {
    total: { type: Number, default: null, min: 0 },
    auto: { type: Number, default: null, min: 0 },
    moto: { type: Number, default: null, min: 0 }
  },

  // Importe fijo que se cobra cuando un vehículo sale sin registro de ingreso (ticket
  // perdido). Es un monto, no una tarifa por hora: no hay horas que contar, justamente.
  // El cajero NO lo puede editar — si lo pudiera escribir, la excepción se volvería un
  // acuerdo de mostrador y el control interno desaparecería. En null, el flujo de excepción
  // queda deshabilitado en vez de cobrar cero.
  tarifaExcepcion: { type: Number, default: null, min: 0 }
}, {
  timestamps: true
});

module.exports = mongoose.model('Sucursal', SucursalSchema);
