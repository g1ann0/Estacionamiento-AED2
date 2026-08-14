// Verificación manual de Etapa 1 — rol operador + AuditLog genérico.
// Uso: BASE_URL=http://localhost:3999 node scripts/verify-etapa1.js
require('dotenv').config();
const mongoose = require('mongoose');
const { TEST_ADMIN, TEST_CLIENTE, TEST_DOMINIO, PASSWORD } = require('../seed-test-users');

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
  const Usuario = require('../../models/Usuario');
  const AuditLog = require('../../models/AuditLog');
  const Estacionamiento = require('../../models/Estacionamiento');
  const Transaccion = require('../../models/Transaccion');
  const Vehiculo = require('../../models/Vehiculo');

  let fallos = 0;
  const tokenAdmin = await login(TEST_ADMIN.email, PASSWORD);

  // --- Tarea 1.1: admin puede asignar rol 'operador' ---
  const rOperador = await llamar('PUT', `/api/usuarios/${TEST_CLIENTE.dni}`, tokenAdmin, { rol: 'operador' });
  if (rOperador.status !== 200 || rOperador.body?.usuario?.rol !== 'operador') {
    console.error(`FAIL asignar rol operador -> ${rOperador.status} ${JSON.stringify(rOperador.body)}`);
    fallos++;
  } else {
    console.log('OK   admin asigna rol operador a TEST_CLIENTE');
  }

  const rolInvalido = await llamar('PUT', `/api/usuarios/${TEST_CLIENTE.dni}`, tokenAdmin, { rol: 'superadmin' });
  if (rolInvalido.status !== 400) {
    console.error(`FAIL rol inválido debería dar 400 -> ${rolInvalido.status}`);
    fallos++;
  } else {
    console.log('OK   rol inválido rechazado con 400');
  }

  // Revertir a 'cliente' para no afectar otros scripts de verificación
  await llamar('PUT', `/api/usuarios/${TEST_CLIENTE.dni}`, tokenAdmin, { rol: 'cliente' });

  // --- Tarea 1.2: AuditLog se genera en cambio de rol ---
  const usuarioCliente = await Usuario.findOne({ dni: TEST_CLIENTE.dni });
  const logsRol = await AuditLog.find({ entidad: 'Usuario', entidadId: String(usuarioCliente._id), accion: 'cambio_rol' }).sort({ fecha: -1 }).lean();
  if (logsRol.length < 2) { // al menos el cambio a operador y la reversión a cliente
    console.error(`FAIL se esperaban al menos 2 AuditLog de cambio_rol, hay ${logsRol.length}`);
    fallos++;
  } else {
    console.log(`OK   AuditLog de cambio_rol registrado (${logsRol.length} entradas)`);
  }

  // --- Tarea 1.2: AuditLog se genera en ingreso/egreso ---
  await Estacionamiento.deleteMany({ vehiculoDominio: TEST_DOMINIO });
  await Transaccion.deleteMany({ 'vehiculo.dominio': TEST_DOMINIO });
  await Vehiculo.updateOne({ dominio: TEST_DOMINIO }, { $set: { estActivo: false } });
  await Usuario.updateOne({ dni: TEST_CLIENTE.dni }, { $set: { montoDisponible: 100000 } });

  const tokenCliente = await login(TEST_CLIENTE.email, PASSWORD);
  const ingreso = await llamar('POST', '/api/estacionamiento/iniciar', tokenCliente, { dni: TEST_CLIENTE.dni, dominio: TEST_DOMINIO, porton: 'Norte' });
  if (ingreso.status !== 200) throw new Error(`Ingreso falló: ${JSON.stringify(ingreso.body)}`);
  const egreso = await llamar('POST', '/api/estacionamiento/finalizar', tokenCliente, { dni: TEST_CLIENTE.dni, dominio: TEST_DOMINIO });
  if (egreso.status !== 200) throw new Error(`Egreso falló: ${JSON.stringify(egreso.body)}`);

  const logIngreso = await AuditLog.findOne({ entidad: 'Estacionamiento', accion: 'ingreso', 'datosNuevos.dominio': TEST_DOMINIO }).sort({ fecha: -1 }).lean();
  const logEgreso = await AuditLog.findOne({ entidad: 'Estacionamiento', accion: 'egreso', 'datosNuevos.dominio': TEST_DOMINIO }).sort({ fecha: -1 }).lean();

  if (!logIngreso) { console.error('FAIL no se registró AuditLog de ingreso'); fallos++; }
  else console.log('OK   AuditLog de ingreso registrado');

  if (!logEgreso) { console.error('FAIL no se registró AuditLog de egreso'); fallos++; }
  else console.log('OK   AuditLog de egreso registrado');

  // --- endpoint /api/admin/auditoria expone tipoLog=general ---
  const rAuditoria = await llamar('GET', '/api/admin/auditoria?tipoLog=general&limite=5', tokenAdmin);
  if (rAuditoria.status !== 200 || !Array.isArray(rAuditoria.body?.logs)) {
    console.error(`FAIL GET /api/admin/auditoria?tipoLog=general -> ${rAuditoria.status} ${JSON.stringify(rAuditoria.body)}`);
    fallos++;
  } else {
    console.log(`OK   GET /api/admin/auditoria?tipoLog=general devuelve ${rAuditoria.body.logs.length} entradas`);
  }

  await Estacionamiento.deleteMany({ vehiculoDominio: TEST_DOMINIO });
  await Transaccion.deleteMany({ 'vehiculo.dominio': TEST_DOMINIO });
  await Vehiculo.updateOne({ dominio: TEST_DOMINIO }, { $set: { estActivo: false } });
  await mongoose.disconnect();

  console.log(`\n${fallos === 0 ? '✅ TODO OK' : `❌ ${fallos} fallo(s)`}`);
  process.exit(fallos === 0 ? 0 : 1);
})().catch(err => {
  console.error('Error ejecutando verify-etapa1:', err);
  process.exit(1);
});
