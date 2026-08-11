// Verificación manual de Etapa 4 — Caja, Turno, MovimientoCaja.
// Uso: BASE_URL=http://localhost:3999 node scripts/verify-etapa4.js
require('dotenv').config();
const mongoose = require('mongoose');
const { TEST_ADMIN, PASSWORD } = require('./seed-test-users');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3999';
const DOM_OCAS = 'TESTETAPA4';

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
  const Caja = require('../models/Caja');
  const Turno = require('../models/Turno');
  const MovimientoCaja = require('../models/MovimientoCaja');
  const Estacionamiento = require('../models/Estacionamiento');
  const Transaccion = require('../models/Transaccion');
  const Vehiculo = require('../models/Vehiculo');
  const Usuario = require('../models/Usuario');
  const estadiaService = require('../services/estadiaService');

  let fallos = 0;
  const check = (cond, msg) => {
    if (cond) console.log(`OK   ${msg}`);
    else { console.error(`FAIL ${msg}`); fallos++; }
  };

  const tokenAdmin = await login(TEST_ADMIN.email, PASSWORD);
  const admin = await Usuario.findOne({ dni: TEST_ADMIN.dni });

  const caja = await Caja.findOne({ nombre: 'Caja Principal' });
  check(!!caja, 'existe la Caja Principal sembrada por defecto');

  // Limpieza previa: si quedó un turno abierto de una corrida anterior, cerrarlo.
  await Turno.deleteMany({ cajaId: caja._id });
  await MovimientoCaja.deleteMany({});
  await Estacionamiento.deleteMany({ vehiculoDominio: DOM_OCAS });
  await Transaccion.deleteMany({ 'vehiculo.dominio': DOM_OCAS });
  await Vehiculo.deleteMany({ dominio: DOM_OCAS });

  // --- 1. Cobro en efectivo SIN turno abierto -> 409 ---
  try {
    await estadiaService.iniciarEstadia({ dominio: DOM_OCAS, porton: 'Norte', origen: 'caja', operadorId: admin._id, clienteOcasional: { nombre: 'Cliente Etapa 4' } });
    await estadiaService.finalizarEstadia({ dominio: DOM_OCAS, medioPago: 'efectivo' });
    console.error('FAIL cobro en efectivo sin turno abierto debería fallar con 409');
    fallos++;
  } catch (e) {
    check(e.statusCode === 409, `cobro en efectivo sin turno abierto -> 409 (${e.statusCode})`);
  }
  await Estacionamiento.deleteMany({ vehiculoDominio: DOM_OCAS });
  await Transaccion.deleteMany({ 'vehiculo.dominio': DOM_OCAS });
  await Vehiculo.deleteMany({ dominio: DOM_OCAS });

  // --- 2. Abrir turno ---
  let r = await llamar('POST', '/api/turnos/abrir', tokenAdmin, { cajaId: caja._id.toString(), montoInicial: 5000 });
  check(r.status === 201, `abrir turno -> 201 (${r.status})`);
  const turnoId = r.body?.turno?._id;
  check(!!turnoId, 'turno creado con _id');

  // --- 3. Doble apertura en la misma caja -> 409 ---
  r = await llamar('POST', '/api/turnos/abrir', tokenAdmin, { cajaId: caja._id.toString(), montoInicial: 1000 });
  check(r.status === 409, `doble apertura de turno en la misma caja -> 409 (${r.status})`);

  // --- 4. GET /api/turnos/actual ---
  r = await llamar('GET', `/api/turnos/actual?cajaId=${caja._id}`, tokenAdmin);
  check(r.status === 200 && r.body?.turno?._id === turnoId, 'GET /api/turnos/actual devuelve el turno abierto');

  // --- 5. Ahora sí: cobro en efectivo con turno abierto -> OK, genera MovimientoCaja ---
  const ingreso = await estadiaService.iniciarEstadia({ dominio: DOM_OCAS, porton: 'Sur', origen: 'caja', operadorId: admin._id, clienteOcasional: { nombre: 'Cliente Etapa 4' } });
  const egreso = await estadiaService.finalizarEstadia({ dominio: DOM_OCAS, medioPago: 'efectivo', operadorId: admin._id });
  check(!!egreso.movimientoCaja, 'cobro en efectivo con turno abierto -> MovimientoCaja generado');
  check(egreso.movimientoCaja?.origen === 'cobro_estadia', 'MovimientoCaja.origen === "cobro_estadia"');
  check(egreso.movimientoCaja?.monto === egreso.montoTotal, 'MovimientoCaja.monto coincide con el total cobrado');
  check(String(egreso.movimientoCaja?.turnoId) === turnoId, 'MovimientoCaja está vinculado al turno correcto');

  // --- 6. Movimiento manual sin motivo -> 400 ---
  r = await llamar('POST', `/api/turnos/${turnoId}/movimientos`, tokenAdmin, { tipo: 'egreso', medioPago: 'efectivo', monto: 500 });
  check(r.status === 400, `movimiento manual sin motivo -> 400 (${r.status})`);

  // --- 7. Movimiento manual con motivo -> OK ---
  r = await llamar('POST', `/api/turnos/${turnoId}/movimientos`, tokenAdmin, { tipo: 'egreso', medioPago: 'efectivo', monto: 500, motivo: 'Cambio para el turno siguiente' });
  check(r.status === 201, `movimiento manual con motivo -> 201 (${r.status})`);

  // --- 8. Resumen de cierre: efectivoEsperado = montoInicial + cobro - egreso manual ---
  r = await llamar('GET', `/api/turnos/${turnoId}/resumen-cierre`, tokenAdmin);
  const efectivoEsperado = 5000 + egreso.montoTotal - 500;
  check(r.body?.efectivoEsperado === efectivoEsperado, `efectivoEsperado calculado correctamente (${r.body?.efectivoEsperado} === ${efectivoEsperado})`);

  // --- 9. Cerrar con diferencia sin observación -> 400 ---
  r = await llamar('POST', `/api/turnos/${turnoId}/cerrar`, tokenAdmin, { montoDeclaradoCierre: efectivoEsperado + 100 });
  check(r.status === 400, `cerrar con diferencia sin observación -> 400 (${r.status})`);

  // --- 10. Cerrar con diferencia y observación -> OK, diferencia correcta ---
  r = await llamar('POST', `/api/turnos/${turnoId}/cerrar`, tokenAdmin, { montoDeclaradoCierre: efectivoEsperado + 100, observacionCierre: 'Sobrante sin explicación clara' });
  check(r.status === 200, `cerrar con diferencia y observación -> 200 (${r.status})`);
  check(r.body?.turno?.diferencia === 100, `diferencia calculada correctamente (${r.body?.turno?.diferencia} === 100)`);
  check(r.body?.turno?.estado === 'cerrado', 'turno queda en estado "cerrado"');

  // --- 11. No se puede volver a cerrar un turno ya cerrado ---
  r = await llamar('POST', `/api/turnos/${turnoId}/cerrar`, tokenAdmin, { montoDeclaradoCierre: efectivoEsperado });
  check(r.status === 409, `cerrar un turno ya cerrado -> 409 (${r.status})`);

  // --- 12. Anular turno (solo admin, solo desde 'cerrado') ---
  r = await llamar('POST', `/api/turnos/${turnoId}/anular`, tokenAdmin, { motivo: 'Prueba de anulación' });
  check(r.status === 200 && r.body?.turno?.estado === 'anulado', `anular turno cerrado -> 200, estado "anulado" (${r.status})`);

  // --- 13. Se puede abrir un turno nuevo en la caja ahora que el anterior está anulado/cerrado ---
  r = await llamar('POST', '/api/turnos/abrir', tokenAdmin, { cajaId: caja._id.toString(), montoInicial: 1000 });
  check(r.status === 201, `abrir turno nuevo tras cerrar el anterior -> 201 (${r.status})`);
  const turnoNuevoId = r.body?.turno?._id;

  // Limpieza final
  await Turno.deleteMany({ cajaId: caja._id });
  await MovimientoCaja.deleteMany({});
  await Estacionamiento.deleteMany({ vehiculoDominio: DOM_OCAS });
  await Transaccion.deleteMany({ 'vehiculo.dominio': DOM_OCAS });
  await Vehiculo.deleteMany({ dominio: DOM_OCAS });
  await mongoose.disconnect();

  console.log(`\n${fallos === 0 ? '✅ TODO OK' : `❌ ${fallos} fallo(s)`}`);
  process.exit(fallos === 0 ? 0 : 1);
})().catch(err => {
  console.error('Error ejecutando verify-etapa4:', err);
  process.exit(1);
});
