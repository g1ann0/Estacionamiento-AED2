// Verificación manual de Etapa 3 — medios de pago + comprobante de estadía.
// Uso: BASE_URL=http://localhost:3999 node scripts/verify-etapa3.js
require('dotenv').config();
const mongoose = require('mongoose');
const { TEST_CLIENTE, TEST_ADMIN, PASSWORD } = require('./seed-test-users');

// Dominio propio de este script, distinto del TEST_DOMINIO compartido por seed-test-users
// (TEST001) — este script borra y recrea su Vehiculo repetidas veces, así que reutilizar
// el dominio compartido rompía a los demás scripts que asumen que ese Vehiculo persiste.
const DOM_APP = 'TESTETAPA3';

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
  const Usuario = require('../models/Usuario');
  const Vehiculo = require('../models/Vehiculo');
  const Estacionamiento = require('../models/Estacionamiento');
  const Transaccion = require('../models/Transaccion');
  const ComprobanteEstadia = require('../models/ComprobanteEstadia');
  const estadiaService = require('../services/estadiaService');

  let fallos = 0;
  const check = (cond, msg) => {
    if (cond) console.log(`OK   ${msg}`);
    else { console.error(`FAIL ${msg}`); fallos++; }
  };
  const estadiaIdsDeEsteRun = [];

  // No borra ComprobanteEstadia acá a propósito: los números deben seguir incrementando
  // libremente durante todo el test (no hay razón de negocio para limpiarlos entre pasos,
  // y borrarlos a mitad de camino rompía el test de unicidad más abajo). Se limpian una
  // sola vez al final, por estadiaId.
  const reset = async (dominio) => {
    await Estacionamiento.deleteMany({ vehiculoDominio: dominio });
    await Transaccion.deleteMany({ 'vehiculo.dominio': dominio });
    await Vehiculo.deleteMany({ dominio });
  };

  const token = await login(TEST_CLIENTE.email, PASSWORD);

  // --- 1. Canal app, sin medioPago explícito → sigue debitando saldo (regresión) ---
  await reset(DOM_APP);
  await Vehiculo.create({ dominio: DOM_APP, tipo: 'auto', marca: 'Test', modelo: 'Test', año: '2020', usuario: (await Usuario.findOne({ dni: TEST_CLIENTE.dni }))._id });
  await Usuario.updateOne({ dni: TEST_CLIENTE.dni }, { $set: { montoDisponible: 100000 } });

  let r = await llamar('POST', '/api/estacionamiento/iniciar', token, { dni: TEST_CLIENTE.dni, dominio: DOM_APP, porton: 'Norte' });
  check(r.status === 200, 'ingreso canal app OK');
  const montoAntes = (await Usuario.findOne({ dni: TEST_CLIENTE.dni }).lean()).montoDisponible;

  r = await llamar('POST', '/api/estacionamiento/finalizar', token, { dni: TEST_CLIENTE.dni, dominio: DOM_APP });
  check(r.status === 200, 'egreso sin medioPago explícito -> 200 (default saldo_prepago)');
  const montoDespues = (await Usuario.findOne({ dni: TEST_CLIENTE.dni }).lean()).montoDisponible;
  check(montoDespues < montoAntes, 'saldo se debitó (comportamiento histórico preservado)');
  check(r.body?.comprobante?.medioPago === 'saldo_prepago', 'comprobante.medioPago === "saldo_prepago"');
  const numeroComprobante1 = r.body?.comprobante?.numero;
  check(typeof numeroComprobante1 === 'number', `comprobante tiene número asignado (${numeroComprobante1})`);
  if (r.body?.estacionamiento?._id) estadiaIdsDeEsteRun.push(r.body.estacionamiento._id);

  // --- 2. Canal app, medioPago='efectivo' → NO debita saldo ---
  await reset(DOM_APP);
  await Vehiculo.create({ dominio: DOM_APP, tipo: 'auto', marca: 'Test', modelo: 'Test', año: '2020', usuario: (await Usuario.findOne({ dni: TEST_CLIENTE.dni }))._id });
  await Usuario.updateOne({ dni: TEST_CLIENTE.dni }, { $set: { montoDisponible: 100000 } });

  await llamar('POST', '/api/estacionamiento/iniciar', token, { dni: TEST_CLIENTE.dni, dominio: DOM_APP, porton: 'Sur' });
  const montoAntesEf = (await Usuario.findOne({ dni: TEST_CLIENTE.dni }).lean()).montoDisponible;
  r = await llamar('POST', '/api/estacionamiento/finalizar', token, { dni: TEST_CLIENTE.dni, dominio: DOM_APP, medioPago: 'efectivo' });
  check(r.status === 200, 'egreso con medioPago=efectivo -> 200');
  const montoDespuesEf = (await Usuario.findOne({ dni: TEST_CLIENTE.dni }).lean()).montoDisponible;
  check(montoDespuesEf === montoAntesEf, 'saldo NO se debitó al pagar en efectivo');
  check(r.body?.comprobante?.medioPago === 'efectivo', 'comprobante.medioPago === "efectivo"');
  const numeroComprobante2 = r.body?.comprobante?.numero;
  check(numeroComprobante2 === numeroComprobante1 + 1, `numeración correlativa sin duplicados (${numeroComprobante1} -> ${numeroComprobante2})`);
  if (r.body?.estacionamiento?._id) estadiaIdsDeEsteRun.push(r.body.estacionamiento._id);

  // --- 3. Cliente ocasional: ahora SÍ puede egresar (bloqueado desde Etapa 2, desbloqueado acá) ---
  const DOM_OCAS = 'TESTPAGO';
  await reset(DOM_OCAS);
  const operadorEtapa4 = await Usuario.findOne({ dni: TEST_ADMIN.dni });
  const ingresoOcas = await estadiaService.iniciarEstadia({ dominio: DOM_OCAS, porton: 'Este', origen: 'caja', operadorId: operadorEtapa4._id, clienteOcasional: { nombre: 'Cliente Ocasional' } });
  check(!!ingresoOcas.estacionamiento, 'ingreso cliente ocasional OK');
  estadiaIdsDeEsteRun.push(ingresoOcas.estacionamiento._id);

  try {
    await estadiaService.finalizarEstadia({ dominio: DOM_OCAS });
    console.error('FAIL egreso cliente ocasional sin medioPago debería fallar con 400');
    fallos++;
  } catch (e) {
    check(e.statusCode === 400, `egreso cliente ocasional sin medioPago -> 400 (${e.statusCode})`);
  }

  try {
    await estadiaService.finalizarEstadia({ dominio: DOM_OCAS, medioPago: 'saldo_prepago' });
    console.error('FAIL egreso cliente ocasional con saldo_prepago debería fallar con 400');
    fallos++;
  } catch (e) {
    check(e.statusCode === 400, `egreso cliente ocasional con medioPago=saldo_prepago -> 400 (${e.statusCode})`);
  }

  // Desde Etapa 4, cobrar en efectivo fuera del canal 'app' requiere un turno abierto en
  // la caja de la sucursal — ver scripts/verify-etapa4.js para el detalle de esa regla.
  const Caja = require('../models/Caja');
  const Turno = require('../models/Turno');
  const caja = await Caja.findOne({ nombre: 'Caja Principal' });
  const tokenAdmin = await login(TEST_ADMIN.email, PASSWORD);
  await llamar('POST', '/api/turnos/abrir', tokenAdmin, { cajaId: caja._id.toString(), montoInicial: 0 });

  const egresoOcas = await estadiaService.finalizarEstadia({ dominio: DOM_OCAS, medioPago: 'efectivo' });
  check(!!egresoOcas.comprobante, 'egreso cliente ocasional con medioPago=efectivo -> comprobante generado');
  check(egresoOcas.comprobante?.receptor?.tipo === 'clienteOcasional', 'comprobante.receptor.tipo === "clienteOcasional"');
  check(egresoOcas.comprobante?.receptor?.nombre === 'Cliente Ocasional', 'comprobante.receptor.nombre correcto');

  // --- 4. Constraint de unicidad de numeración a nivel de base de datos ---
  // Usa el puntoVenta devuelto en la respuesta, no una relectura por número — reset()
  // ya pudo haber borrado ese comprobante (filtra por receptor.dni incluyendo TEST_CLIENTE.dni).
  const dup = new ComprobanteEstadia({
    numero: numeroComprobante1,
    puntoVenta: egresoOcas.comprobante.puntoVenta,
    tipoComprobante: 'ticket',
    estadiaId: ingresoOcas.estacionamiento._id,
    receptor: { tipo: 'consumidor_final' },
    medioPago: 'efectivo',
    subtotal: 100,
    total: 100
  });
  try {
    await dup.save();
    console.error('FAIL debería haber rechazado un número de comprobante duplicado');
    fallos++;
  } catch (e) {
    check(e.code === 11000, `constraint de unicidad (puntoVenta,tipoComprobante,numero) rechaza duplicados -> ${e.code}`);
  }

  await ComprobanteEstadia.deleteMany({ estadiaId: { $in: estadiaIdsDeEsteRun } });
  await Turno.deleteMany({ cajaId: caja._id }); // turno abierto para el test del paso 3
  await reset(DOM_APP);
  await reset(DOM_OCAS);
  await mongoose.disconnect();

  console.log(`\n${fallos === 0 ? '✅ TODO OK' : `❌ ${fallos} fallo(s)`}`);
  process.exit(fallos === 0 ? 0 : 1);
})().catch(err => {
  console.error('Error ejecutando verify-etapa3:', err);
  process.exit(1);
});
