// Normaliza los emails existentes a minúsculas.
//
// `Juan@Gmail.com` y `juan@gmail.com` son la misma casilla para cualquier persona, pero eran
// dos cuentas distintas para el sistema: alguien se registraba dos veces sin darse cuenta, o
// pedía recuperar su contraseña escribiendo el mail con otra combinación de mayúsculas y el
// sistema le contestaba que esa cuenta no existe.
//
// El modelo ya guarda en minúsculas desde el cambio; esto arregla lo que quedó de antes.
//
// Uso:
//   node scripts/migrar-emails-minuscula.js            (informe, no escribe nada)
//   node scripts/migrar-emails-minuscula.js aplicar    (escribe)
//
// Si dos cuentas colisionan al normalizar, NO se toca ninguna de las dos y se listan para que
// alguien decida cuál sobrevive: fusionarlas automáticamente significaría elegir a ciegas qué
// estadías, comprobantes y saldo se quedan, y eso no lo puede decidir un script.

require('dotenv').config();
const mongoose = require('mongoose');
const Usuario = require('../models/Usuario');

const aplicar = process.argv[2] === 'aplicar';

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  const usuarios = await Usuario.find({}, 'email dni activo').lean();
  const aCambiar = usuarios.filter((u) => u.email && u.email !== u.email.trim().toLowerCase());

  // Choques: dos cuentas que, normalizadas, quedarían con el mismo email.
  const porNormalizado = new Map();
  for (const usuario of usuarios) {
    const clave = (usuario.email || '').trim().toLowerCase();
    porNormalizado.set(clave, [...(porNormalizado.get(clave) ?? []), usuario]);
  }
  const choques = [...porNormalizado.entries()].filter(([, lista]) => lista.length > 1);
  const dnisEnChoque = new Set(choques.flatMap(([, lista]) => lista.map((u) => u.dni)));

  console.log(`Usuarios: ${usuarios.length}`);
  console.log(`Con mayúsculas o espacios en el email: ${aCambiar.length}`);
  console.log(`Choques al normalizar: ${choques.length}`);

  for (const [normalizado, lista] of choques) {
    console.warn(`  ⚠️  ${normalizado} ← ${lista.map((u) => `${u.email} (DNI ${u.dni}${u.activo ? '' : ', inactivo'})`).join(' + ')}`);
  }

  if (!aplicar) {
    console.log('\nInforme solamente. Para escribir: node scripts/migrar-emails-minuscula.js aplicar');
    await mongoose.disconnect();
    return;
  }

  let cambiados = 0;
  let omitidos = 0;
  for (const usuario of aCambiar) {
    if (dnisEnChoque.has(usuario.dni)) {
      omitidos += 1;
      continue;
    }
    await Usuario.updateOne({ _id: usuario._id }, { $set: { email: usuario.email.trim().toLowerCase() } });
    cambiados += 1;
  }

  console.log(`\nNormalizados: ${cambiados}. Omitidos por choque: ${omitidos}.`);
  if (omitidos > 0) {
    console.log('Los omitidos necesitan una decisión humana: qué cuenta se queda y qué pasa con la otra.');
  }
  await mongoose.disconnect();
})().catch(async (error) => {
  console.error('Error:', error.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
