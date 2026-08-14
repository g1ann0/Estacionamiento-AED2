// Verificación manual de Tarea 0.3 — 2 requests concurrentes de egreso para el mismo
// vehículo deben resultar en exactamente un 200 y un 409, un solo débito de saldo,
// y una sola Transaccion de salida. No depende de que Mongo sea replica set: el guard
// es atómico a nivel de un solo documento (findOneAndUpdate por estado).
// Uso: BASE_URL=http://localhost:3999 node scripts/verify-concurrencia.js
require('dotenv').config();
const mongoose = require('mongoose');
const { TEST_CLIENTE, TEST_DOMINIO, PASSWORD, seed } = require('../seed-test-users');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3999';

async function login(email, password) {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Login falló: ${res.status} ${JSON.stringify(data)}`);
  return data.token;
}

async function llamar(method, path, token, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const Vehiculo = require('../../models/Vehiculo');
  const Estacionamiento = require('../../models/Estacionamiento');
  const Transaccion = require('../../models/Transaccion');
  const Usuario = require('../../models/Usuario');

  await Estacionamiento.deleteMany({ vehiculoDominio: TEST_DOMINIO });
  await Transaccion.deleteMany({ 'vehiculo.dominio': TEST_DOMINIO });
  await Vehiculo.updateOne({ dominio: TEST_DOMINIO }, { $set: { estActivo: false } });
  await Usuario.updateOne({ dni: TEST_CLIENTE.dni }, { $set: { montoDisponible: 100000 } });

  const token = await login(TEST_CLIENTE.email, PASSWORD);
  const montoAntes = (await Usuario.findOne({ dni: TEST_CLIENTE.dni }).lean()).montoDisponible;

  const ingreso = await llamar('POST', '/api/estacionamiento/iniciar', token, { dni: TEST_CLIENTE.dni, dominio: TEST_DOMINIO, porton: 'Oeste' });
  if (ingreso.status !== 200) throw new Error(`Ingreso falló: ${ingreso.status} ${JSON.stringify(ingreso.body)}`);

  // 2 requests de egreso disparados en paralelo para el mismo vehículo.
  const [r1, r2] = await Promise.all([
    llamar('POST', '/api/estacionamiento/finalizar', token, { dni: TEST_CLIENTE.dni, dominio: TEST_DOMINIO }),
    llamar('POST', '/api/estacionamiento/finalizar', token, { dni: TEST_CLIENTE.dni, dominio: TEST_DOMINIO })
  ]);

  const statuses = [r1.status, r2.status].sort();
  const transaccionesSalida = await Transaccion.find({ 'vehiculo.dominio': TEST_DOMINIO, tipo: 'salida' }).lean();
  const montoDespues = (await Usuario.findOne({ dni: TEST_CLIENTE.dni }).lean()).montoDisponible;
  const debitos = montoAntes - montoDespues;

  let fallos = 0;

  if (JSON.stringify(statuses) !== JSON.stringify([200, 409])) {
    console.error(`FAIL statuses esperados [200,409], obtenidos ${JSON.stringify(statuses)} (r1=${r1.status} r2=${r2.status})`);
    fallos++;
  } else {
    console.log(`OK   statuses [200,409] -> ${JSON.stringify(statuses)}`);
  }

  if (transaccionesSalida.length !== 1) {
    console.error(`FAIL se esperaba 1 Transaccion de salida, hay ${transaccionesSalida.length}`);
    fallos++;
  } else {
    console.log(`OK   exactamente 1 Transaccion de salida`);
  }

  if (debitos !== transaccionesSalida[0]?.montoTotal) {
    console.error(`FAIL débito de saldo (${debitos}) no coincide con montoTotal de la transacción (${transaccionesSalida[0]?.montoTotal}) -> posible doble/cero débito`);
    fallos++;
  } else {
    console.log(`OK   saldo debitado exactamente una vez ($${debitos})`);
  }

  await Estacionamiento.deleteMany({ vehiculoDominio: TEST_DOMINIO });
  await Transaccion.deleteMany({ 'vehiculo.dominio': TEST_DOMINIO });
  await Vehiculo.updateOne({ dominio: TEST_DOMINIO }, { $set: { estActivo: false } });
  await mongoose.disconnect();

  console.log(`\n${fallos === 0 ? '✅ TODO OK' : `❌ ${fallos} fallo(s)`}`);
  process.exit(fallos === 0 ? 0 : 1);
})().catch(err => {
  console.error('Error ejecutando verify-concurrencia:', err);
  process.exit(1);
});
