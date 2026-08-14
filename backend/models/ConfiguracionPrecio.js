const mongoose = require('mongoose');

const ConfiguracionPrecioSchema = new mongoose.Schema({
  tipoUsuario: {
    type: String,
    required: true
  },
  precioPorHora: { 
    type: Number, 
    required: true,
    min: 0 
  },
  descripcion: { 
    type: String, 
    default: '' 
  },
  fechaCreacion: {
    type: Date,
    default: Date.now
  },
  fechaActualizacion: { 
    type: Date, 
    default: Date.now 
  },
  actualizadoPor: { 
    type: String, 
    required: true 
  },
  activo: {
    type: Boolean,
    default: true
  },

  // ------------------------------------------------------------------ Reglas de cobro --
  //
  // Todo lo de acá abajo nace apagado: los valores por defecto reproducen exactamente el
  // comportamiento anterior —hora entera hacia arriba, mismo precio para todos los vehículos,
  // sin recargos ni tope—. Una playa que no configura nada sigue cobrando igual que ayer.
  // Ninguno de estos números se inventó: la única forma de que dejen de ser neutros es que
  // alguien los cargue desde el panel.

  // Auto y moto pagaban lo mismo porque la tarifa solo se resolvía por tipo de cliente.
  // 'todos' es la tarifa general; una tarifa específica de moto le gana a la general.
  tipoVehiculo: {
    type: String,
    enum: ['todos', 'auto', 'moto'],
    default: 'todos'
  },

  // Unidad de cobro en minutos. 60 = hora entera hacia arriba, que es la regla histórica.
  // 30 cobra media hora; 15, el cuarto de hora. Siempre se redondea hacia arriba: es lo que
  // hace el rubro y lo que la pantalla de cobro muestra explícito ("2h 12m → se cobran 2h 15m").
  fraccionMinutos: {
    type: Number,
    default: 60,
    min: 1,
    max: 1440
  },

  // Techo por cada 24 horas de estadía. Sin él, un auto olvidado un fin de semana largo
  // acumula un importe que nadie va a pagar y que termina en una discusión en el mostrador.
  // `null` = sin tope.
  topeDiario: {
    type: Number,
    default: null,
    min: 0
  },

  // Recargos por momento. Se aplica UNO SOLO: el mayor de los que correspondan. Sumarlos
  // haría que un feriado a la madrugada cobre dos veces por el mismo hecho —que es un
  // momento caro—, y ese es el tipo de cuenta que el cajero no puede explicar.
  recargos: {
    nocturno: {
      porcentaje: { type: Number, default: 0, min: 0 },
      desde: { type: String, default: '22:00' }, // HH:MM, hora local
      hasta: { type: String, default: '06:00' }  // puede cruzar la medianoche
    },
    finDeSemana: {
      porcentaje: { type: Number, default: 0, min: 0 }
    },
    feriado: {
      porcentaje: { type: Number, default: 0, min: 0 }
    }
  }
});

// El índice único quedó en `tipoUsuario` solo, de cuando no existía la tarifa por vehículo:
// con él no se puede tener "asociado / moto" y "asociado / auto" a la vez. La unicidad real es
// la combinación de los dos.
ConfiguracionPrecioSchema.index({ tipoUsuario: 1, tipoVehiculo: 1 }, { unique: true });

module.exports = mongoose.model('ConfiguracionPrecio', ConfiguracionPrecioSchema);
