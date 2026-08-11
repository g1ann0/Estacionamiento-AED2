const mongoose = require('mongoose');

const EstacionamientoSchema = new mongoose.Schema({
  // Opcional desde Etapa 2: una estadía de cliente ocasional no tiene usuarioDNI,
  // solo clienteOcasional (ver docs/analisis-gap-cgas/07/08).
  usuarioDNI: {
    type: String,
    required: false,
    default: null
  },
  vehiculoDominio: {
    type: String,
    required: true
  },
  // Opcional desde la poda del panel: era obligatorio y no lo leía nada — ni la tarifa, ni un
  // reporte, ni un filtro, ni una pantalla. Costaba una interacción por ingreso para escribir
  // un dato que nunca se consultaba. Se conserva el campo (los registros históricos lo tienen)
  // pero deja de pedirse. Si más adelante la playa se divide de verdad, el reemplazo es un
  // Sector con capacidad, no este enum de puntos cardinales.
  porton: {
    type: String,
    enum: ['Norte', 'Sur', 'Este', 'Oeste'],
    required: false,
    default: null
  },
  // `tipoRegistro` se eliminó: se escribía en cada ingreso y ninguna consulta lo leía. Además
  // era una copia congelada de `usuario.asociado` —que puede cambiar después—, así que a los
  // dos meses el dato mentía. La condición de asociado se resuelve al calcular la tarifa,
  // que es donde importa y donde se lee del usuario real.

  horaInicio: {
    type: Date,
    required: true,
    default: Date.now
  },
  horaFin: {
    type: Date
  },
  duracionHorasReal: {
    type: Number
  },
  duracionHoras: {
    type: Number
  },
  montoTotal: {
    type: Number
  },
  estado: {
    type: String,
    enum: ['activo', 'finalizado'],
    default: 'activo'
  },
  // Datos opcionales del conductor sin cuenta — ninguno es obligatorio (ver doc 07 sección 2).
  clienteOcasional: {
    nombre: { type: String, required: false },
    telefono: { type: String, required: false },
    documento: { type: String, required: false }
  },
  // 'excepcion': el vehículo salió sin registro de ingreso (ticket perdido). Se guarda como
  // estadía finalizada para que el cobro, el comprobante y el movimiento de caja sigan el
  // mismo camino que cualquier otro egreso — pero queda marcada y separable en los reportes
  // y en el cierre, que es donde un dueño quiere revisarla sin tener que buscarla.
  origen: {
    type: String,
    enum: ['app', 'caja', 'manual', 'api', 'excepcion'],
    default: 'app'
  },
  motivoExcepcion: { type: String, default: null },
  operadorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: false, default: null },
  sucursalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Sucursal', required: false, default: null }
}, { timestamps: true });

EstacionamientoSchema.index({ vehiculoDominio: 1, estado: 1 });

module.exports = mongoose.model('Estacionamiento', EstacionamientoSchema);
