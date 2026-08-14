// Alta o promoción del administrador, explícita y a mano.
//
// Reemplaza a las dos formas implícitas que había de terminar siendo admin: la credencial por
// defecto del seed (`admin123`, publicada) y la regla "el primer usuario que se registra en una
// base vacía queda como administrador". Las dos convertían un descuido en un acceso total.
//
// Uso:
//   node scripts/crear-admin.js <email> <dni> <contraseña> [nombre] [apellido]
//
// Si el email ya existe, lo promueve a admin y le cambia la contraseña — que es lo que hace
// falta cuando alguien se quedó afuera.

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Usuario = require('../models/Usuario');

const LARGO_MINIMO = 8; // más exigente que el mínimo de cliente: esta cuenta puede todo

(async () => {
  const [email, dni, password, nombre = 'Administrador', apellido = 'Sistema'] = process.argv.slice(2);

  if (!email || !dni || !password) {
    console.error('Uso: node scripts/crear-admin.js <email> <dni> <contraseña> [nombre] [apellido]');
    process.exit(1);
  }
  if (password.length < LARGO_MINIMO) {
    console.error(`La contraseña del administrador debe tener al menos ${LARGO_MINIMO} caracteres.`);
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);

  const passwordHash = await bcrypt.hash(password, 10);
  const existente = await Usuario.findOne({ $or: [{ email }, { dni }] });

  if (existente) {
    existente.rol = 'admin';
    existente.password = passwordHash;
    existente.verificado = true;
    existente.activo = true;
    await existente.save();
    console.log(`Usuario existente promovido a administrador: ${existente.email} (DNI ${existente.dni})`);
  } else {
    await new Usuario({
      dni, email, nombre, apellido,
      password: passwordHash,
      rol: 'admin',
      verificado: true,
      activo: true,
      montoDisponible: 0
    }).save();
    console.log(`Administrador creado: ${email} (DNI ${dni})`);
  }

  await mongoose.disconnect();
})().catch(async (error) => {
  console.error('Error:', error.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
