// Verificación manual de Etapa 5 — Operación de caja sin cuenta (integración completa).
// Uso: BASE_URL=http://localhost:3999 node scripts/verify-etapa5.js
require('dotenv').config();
const mongoose = require('mongoose');
const { TEST_ADMIN, TEST_CLIENTE, PASSWORD } = require('../seed-test-users');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3999';
const DOM_MANUAL = 'TESTETAPA5';

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
  const Caja = require('../../models/Caja');
  const Turno = require('../../models/Turno');
  const MovimientoCaja = require('../../models/MovimientoCaja');
  const Estacionamiento = require('../../models/Estacionamiento');
  const Transaccion = require('../../models/Transaccion');
  const Vehiculo = require('../../models/Vehiculo');

  let fallos = 0;
  const check = (cond, msg) => {
    if (cond) console.log(`OK   ${msg}`);
    else { console.error(`FAIL ${msg}`); fallos++; }
  };

  const reset = async () => {
    await Estacionamiento.deleteMany({ vehiculoDominio: DOM_MANUAL });
    await Transaccion.deleteMany({ 'vehiculo.dominio': DOM_MANUAL });
    await Vehiculo.deleteMany({ dominio: DOM_MANUAL });
  };
  await reset();

  const tokenAdmin = await login(TEST_ADMIN.email, PASSWORD);
  const tokenCliente = await login(TEST_CLIENTE.email, PASSWORD);
  const caja = await Caja.findOne({ nombre: 'Caja Principal' });
  await Turno.deleteMany({ cajaId: caja._id });
  await MovimientoCaja.deleteMany({});

  // --- 0. rol cliente no puede usar estos endpoints ---
  let r = await llamar('POST', '/api/estadias/ingreso-manual', tokenCliente, { dominio: DOM_MANUAL, porton: 'Norte' });
  check(r.status === 403, `cliente -> 403 en ingreso-manual (${r.status})`);

  // --- 1. Ingreso manual sin dni (cliente ocasional), 1 sola acción de UI/API ---
  r = await llamar('POST', '/api/estadias/ingreso-manual', tokenAdmin, {
    dominio: DOM_MANUAL, porton: 'Norte', clienteOcasional: { nombre: 'Cliente Caja' }
  });
  check(r.status === 200, `ingreso-manual sin dni -> 200 (${r.status})`);
  check(r.body?.estacionamiento?.origen === 'caja', 'estacionamiento.origen === "caja"');
  check(!r.body?.estacionamiento?.usuarioDNI, 'estacionamiento sin usuarioDNI (cliente ocasional)');

  // --- 2. Doble ingreso del mismo dominio -> 409 ---
  r = await llamar('POST', '/api/estadias/ingreso-manual', tokenAdmin, { dominio: DOM_MANUAL, porton: 'Sur' });
  check(r.status === 409, `doble ingreso manual -> 409 (${r.status})`);

  // --- 3. GET /api/estadias/activas incluye el vehículo con sus datos ---
  r = await llamar('GET', '/api/estadias/activas', tokenAdmin);
  const encontrada = r.body?.activas?.find((e) => e.vehiculoDominio === DOM_MANUAL);
  check(r.status === 200 && !!encontrada, 'GET /api/estadias/activas incluye la estadía recién creada');
  check(!!encontrada?.vehiculo, 'la estadía activa trae el detalle del Vehiculo resuelto');

  // --- 4. Egreso manual SIN turno abierto -> 409 (regla de Etapa 4 se respeta) ---
  r = await llamar('POST', '/api/estadias/egreso-manual', tokenAdmin, { dominio: DOM_MANUAL, medioPago: 'efectivo' });
  check(r.status === 409, `egreso-manual sin turno abierto -> 409 (${r.status})`);

  // --- 5. Abrir turno y cobrar ---
  r = await llamar('POST', '/api/turnos/abrir', tokenAdmin, { cajaId: caja._id.toString(), montoInicial: 2000 });
  check(r.status === 201, `abrir turno -> 201 (${r.status})`);

  r = await llamar('POST', '/api/estadias/egreso-manual', tokenAdmin, { dominio: DOM_MANUAL, medioPago: 'efectivo' });
  check(r.status === 200, `egreso-manual con turno abierto -> 200 (${r.status})`);
  check(!!r.body?.comprobante, 'egreso-manual genera comprobante');
  check(!!r.body?.movimientoCaja, 'egreso-manual genera MovimientoCaja');
  check(r.body?.comprobante?.receptor?.tipo === 'clienteOcasional', 'comprobante.receptor.tipo === "clienteOcasional"');

  const vehiculoFinal = await Vehiculo.findOne({ dominio: DOM_MANUAL }).lean();
  check(vehiculoFinal?.estActivo === false, 'Vehiculo.estActivo === false tras el egreso manual');

  // --- 6. Ingreso manual CON dni (operador da de alta a un usuario registrado a mano) ---
  // El canal app/dni sigue exigiendo que el vehículo ya esté registrado a nombre del
  // usuario (misma regla desde Etapa 2) — a diferencia del canal sin dni, que lo crea solo.
  await reset();
  const clienteDoc = await Usuario.findOne({ dni: TEST_CLIENTE.dni });
  await Vehiculo.create({ dominio: DOM_MANUAL, tipo: 'auto', marca: 'Test', modelo: 'Test', año: '2020', usuario: clienteDoc._id });

  r = await llamar('POST', '/api/estadias/ingreso-manual', tokenAdmin, {
    dominio: DOM_MANUAL, porton: 'Este', dni: TEST_CLIENTE.dni, clienteOcasional: { nombre: 'No debería guardarse' }
  });
  check(r.status === 200, `ingreso-manual con dni de usuario registrado -> 200 (${r.status})`);
  check(r.body?.estacionamiento?.usuarioDNI === TEST_CLIENTE.dni, 'estacionamiento.usuarioDNI se guardó correctamente');
  check(!r.body?.estacionamiento?.clienteOcasional?.nombre, 'clienteOcasional NO se guarda cuando hay dni (aunque se haya enviado)');

  // Limpieza: cerrar el egreso de este último caso vía canal app normal para no dejar el vehículo activo.
  await estadiaServiceCierre();
  async function estadiaServiceCierre() {
    const estadiaService = require('../../services/estadiaService');
    try { await estadiaService.finalizarEstadia({ dominio: DOM_MANUAL, medioPago: 'saldo_prepago' }); } catch (e) { /* puede fallar por saldo, no crítico para el test */ }
  }

  await Turno.deleteMany({ cajaId: caja._id });
  await MovimientoCaja.deleteMany({});
  await reset();
  await mongoose.disconnect();

  console.log(`\n${fallos === 0 ? '✅ TODO OK' : `❌ ${fallos} fallo(s)`}`);
  process.exit(fallos === 0 ? 0 : 1);
})().catch(err => {
  console.error('Error ejecutando verify-etapa5:', err);
  process.exit(1);
});
