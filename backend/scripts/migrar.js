// Migraciones versionadas.
//
// Hasta ahora los cambios de datos vivían en `scripts/migracion*.js`: scripts sueltos que
// alguien tenía que acordarse de correr, en el orden correcto, en cada entorno, sin ninguna
// forma de saber después cuáles ya se habían aplicado. Eso funciona una vez y falla la segunda,
// que es cuando el entorno de producción queda con la mitad de los cambios.
//
// Esto es lo mínimo que resuelve el problema, sin dependencias nuevas: los archivos de
// `migraciones/` se aplican en orden alfabético (por eso el prefijo numérico) y cada uno queda
// asentado en la colección `migraciones` con su fecha. Aplicar dos veces no hace nada.
//
// Uso:
//   node scripts/migrar.js            → muestra aplicadas y pendientes, no escribe
//   node scripts/migrar.js aplicar    → corre las pendientes, en orden
//
// Una migración es un archivo en `migraciones/` que exporta:
//   module.exports = { descripcion: '...', async aplicar(db, mongoose) { ... } }

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const CARPETA = path.join(__dirname, '..', 'migraciones');
const COLECCION = 'migraciones';

const listarArchivos = () =>
  (fs.existsSync(CARPETA) ? fs.readdirSync(CARPETA) : [])
    .filter((nombre) => nombre.endsWith('.js'))
    .sort();

(async () => {
  const aplicar = process.argv[2] === 'aplicar';

  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  const registro = db.collection(COLECCION);

  const aplicadas = new Set((await registro.find({}, { projection: { _id: 1 } }).toArray()).map((d) => d._id));
  const archivos = listarArchivos();
  const pendientes = archivos.filter((nombre) => !aplicadas.has(nombre));

  console.log(`Migraciones: ${archivos.length} en total, ${aplicadas.size} aplicadas, ${pendientes.length} pendientes.`);
  for (const nombre of archivos) {
    const { descripcion } = require(path.join(CARPETA, nombre));
    console.log(`  ${aplicadas.has(nombre) ? '✔' : '·'} ${nombre} — ${descripcion}`);
  }

  if (!aplicar) {
    if (pendientes.length > 0) console.log('\nPara aplicarlas: node scripts/migrar.js aplicar');
    await mongoose.disconnect();
    return;
  }

  for (const nombre of pendientes) {
    const migracion = require(path.join(CARPETA, nombre));
    process.stdout.write(`\n→ ${nombre} … `);
    // Sin transacción envolvente a propósito: una migración puede tocar millones de documentos
    // y no entra en una transacción. Cada una tiene que ser idempotente y poder repetirse.
    const resultado = await migracion.aplicar(db, mongoose);
    await registro.insertOne({ _id: nombre, descripcion: migracion.descripcion, fecha: new Date(), resultado: resultado ?? null });
    console.log('aplicada');
    if (resultado) console.log(`   ${JSON.stringify(resultado)}`);
  }

  console.log(pendientes.length ? '\nListo.' : '\nNo había nada pendiente.');
  await mongoose.disconnect();
})().catch(async (error) => {
  console.error('\nError aplicando migraciones:', error.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
