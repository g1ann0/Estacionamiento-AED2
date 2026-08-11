// Migración: el array embebido `Usuario.vehiculos[]` desaparece; la colección Vehiculo queda
// como única fuente del catálogo.
//
// Uso:
//   node scripts/migrar-vehiculos-embebidos.js --dry-run  → informa qué haría
//   node scripts/migrar-vehiculos-embebidos.js            → copia los faltantes
//   node scripts/migrar-vehiculos-embebidos.js --limpiar  → borra el campo del documento
//                                                            (solo después de verificar)
//
// Es idempotente: si el dominio ya está en la colección, no lo toca.
require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');

(async () => {
  const dryRun = process.argv.includes('--dry-run');
  const limpiar = process.argv.includes('--limpiar');

  await mongoose.connect(process.env.MONGODB_URI);
  const Vehiculo = require('../models/Vehiculo');
  const db = mongoose.connection.db;
  const usuarios = db.collection('usuarios');

  if (limpiar) {
    const { modifiedCount } = await usuarios.updateMany(
      { vehiculos: { $exists: true } },
      { $unset: { vehiculos: '' } }
    );
    console.log(`Campo 'vehiculos' eliminado de ${modifiedCount} usuario(s).`);
    await mongoose.disconnect();
    return;
  }

  const conArray = await usuarios.find({ vehiculos: { $exists: true, $ne: [] } }).toArray();
  console.log(`Usuarios con vehículos embebidos: ${conArray.length}`);

  let copiados = 0;
  let yaExistian = 0;
  let conflictos = 0;

  for (const usuario of conArray) {
    for (const embebido of usuario.vehiculos) {
      if (!embebido?.dominio) continue;
      const dominio = String(embebido.dominio).toUpperCase();

      const existente = await Vehiculo.findOne({ dominio }).lean();

      if (existente) {
        // Si el de la colección no tiene dueño y el embebido dice de quién es, se completa:
        // ese es exactamente el caso de un vehículo que entró como ocasional por caja.
        if (!existente.usuario) {
          if (!dryRun) {
            await Vehiculo.updateOne({ _id: existente._id }, { $set: { usuario: usuario._id } });
          }
          copiados++;
        } else if (String(existente.usuario) !== String(usuario._id)) {
          console.warn(`  ⚠ ${dominio}: la colección lo asigna a otro usuario. Gana la colección, se ignora el embebido.`);
          conflictos++;
        } else {
          yaExistian++;
        }
        continue;
      }

      if (!dryRun) {
        await Vehiculo.create({
          dominio,
          tipo: embebido.tipo || 'auto',
          marca: embebido.marca || null,
          modelo: embebido.modelo || null,
          año: embebido.año || null,
          usuario: usuario._id
        });
      }
      copiados++;
    }
  }

  console.log(`\n${dryRun ? '[dry-run] ' : ''}copiados: ${copiados} · ya estaban: ${yaExistian} · conflictos: ${conflictos}`);
  if (!dryRun) {
    console.log('Verificá la pantalla de vehículos y después corré con --limpiar para eliminar el campo.');
  }

  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
