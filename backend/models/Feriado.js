const mongoose = require('mongoose');

// Días con recargo. Se cargan a mano desde el panel: no se importan de ningún lado porque el
// calendario que importa no es solo el nacional —un feriado provincial, una fiesta local o el
// día del evento que llena la playa cambian la tarifa igual—, y una lista automática que dice
// lo contrario que la realidad es peor que no tener lista.
//
// La fecha se guarda como texto AAAA-MM-DD y no como Date a propósito: un feriado es un día del
// calendario, no un instante. Guardado como Date, "el 25 de mayo" pasa a depender de la zona
// horaria del servidor y el recargo se aplica el día equivocado.
const FeriadoSchema = new mongoose.Schema({
  fecha: {
    type: String,
    required: true,
    unique: true,
    match: [/^\d{4}-\d{2}-\d{2}$/, 'La fecha debe tener el formato AAAA-MM-DD']
  },
  descripcion: { type: String, default: '' },
  creadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', default: null }
}, { timestamps: true });

FeriadoSchema.index({ fecha: 1 });

module.exports = mongoose.model('Feriado', FeriadoSchema);
