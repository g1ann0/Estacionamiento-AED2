// Crea/borra usuarios de prueba dedicados para los scripts de verificación de Etapa 0.
// No toca al único usuario real existente en la DB de dev (admin@estacionamiento.com).
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const Usuario = require('../models/Usuario');
const Vehiculo = require('../models/Vehiculo');
const Estacionamiento = require('../models/Estacionamiento');
const Transaccion = require('../models/Transaccion');

const TEST_ADMIN = { dni: '90000001', email: 'test-admin@verify.local', nombre: 'Test', apellido: 'Admin', rol: 'admin' };
const TEST_CLIENTE = { dni: '90000002', email: 'test-cliente@verify.local', nombre: 'Test', apellido: 'Cliente', rol: 'cliente' };
const TEST_CLIENTE2 = { dni: '90000003', email: 'test-cliente2@verify.local', nombre: 'Test', apellido: 'Cliente2', rol: 'cliente' };
const TEST_DOMINIO = 'TEST001';
const PASSWORD = 'Test1234!';

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);
  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  for (const datos of [TEST_ADMIN, TEST_CLIENTE, TEST_CLIENTE2]) {
    await Usuario.findOneAndUpdate(
      { dni: datos.dni },
      { ...datos, password: passwordHash, verificado: true, activo: true, montoDisponible: 100000 },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    );
  }

  await Vehiculo.findOneAndUpdate(
    { dominio: TEST_DOMINIO },
    { dominio: TEST_DOMINIO, tipo: 'auto', marca: 'Test', modelo: 'Test', año: '2020', estActivo: false,
      usuario: (await Usuario.findOne({ dni: TEST_CLIENTE.dni }))._id },
    { upsert: true, returnDocument: 'after' }
  );

  console.log('Usuarios/vehículo de prueba listos.');
  console.log(JSON.stringify({ TEST_ADMIN, TEST_CLIENTE, TEST_CLIENTE2, TEST_DOMINIO, PASSWORD }, null, 2));
  await mongoose.disconnect();
}

async function cleanup() {
  await mongoose.connect(process.env.MONGODB_URI);
  const dnis = [TEST_ADMIN.dni, TEST_CLIENTE.dni, TEST_CLIENTE2.dni];
  await Estacionamiento.deleteMany({ vehiculoDominio: TEST_DOMINIO });
  await Transaccion.deleteMany({ 'vehiculo.dominio': TEST_DOMINIO });
  await Vehiculo.deleteMany({ dominio: TEST_DOMINIO });
  await Usuario.deleteMany({ dni: { $in: dnis } });
  console.log('Datos de prueba eliminados.');
  await mongoose.disconnect();
}

if (require.main === module) {
  const modo = process.argv[2];
  if (modo === 'cleanup') {
    cleanup().catch(e => { console.error(e); process.exit(1); });
  } else {
    seed().catch(e => { console.error(e); process.exit(1); });
  }
}

module.exports = { TEST_ADMIN, TEST_CLIENTE, TEST_CLIENTE2, TEST_DOMINIO, PASSWORD, seed, cleanup };
