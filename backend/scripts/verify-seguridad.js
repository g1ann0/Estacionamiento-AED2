// Verificación de la auditoría de seguridad: cada prueba corresponde a un agujero real que
// estaba abierto y que se cerró. No son casos hipotéticos — todos se reprodujeron primero.
//
// Uso: levantar el servidor con RATE_LIMIT_OFF=true y
//      BASE_URL=http://localhost:3999 node scripts/verify-seguridad.js

require('dotenv').config();
const mongoose = require('mongoose');
const { TEST_ADMIN, TEST_CLIENTE, TEST_CLIENTE2, TEST_OPERADOR, PASSWORD } = require('./seed-test-users');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3999';
const DOMINIO_VICTIMA = 'SEGVICT1';
const DOMINIO_PROPIO = 'SEGPROP1';

let ok = 0;
let fallos = 0;
const check = (condicion, descripcion, detalle = '') => {
  if (condicion) {
    console.log(`OK    ${descripcion}${detalle ? ` (${detalle})` : ''}`);
    ok += 1;
  } else {
    console.error(`FALLA ${descripcion}${detalle ? ` (${detalle})` : ''}`);
    fallos += 1;
  }
};

async function login(email, password) {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 429) throw new Error('Login rate-limiteado. Levantá el servidor con RATE_LIMIT_OFF=true.');
  if (!res.ok) throw new Error(`Login falló para ${email}: ${res.status} ${JSON.stringify(data)}`);
  return data.token;
}

async function llamar(method, path, token, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  const Usuario = require('../models/Usuario');
  const Vehiculo = require('../models/Vehiculo');
  const Estacionamiento = require('../models/Estacionamiento');
  const Transaccion = require('../models/Transaccion');

  const limpiar = async () => {
    await Estacionamiento.deleteMany({ vehiculoDominio: { $in: [DOMINIO_VICTIMA, DOMINIO_PROPIO] } });
    await Transaccion.deleteMany({ 'vehiculo.dominio': { $in: [DOMINIO_VICTIMA, DOMINIO_PROPIO] } });
    await Vehiculo.deleteMany({ dominio: { $in: [DOMINIO_VICTIMA, DOMINIO_PROPIO] } });
  };
  await limpiar();

  const victima = await Usuario.findOne({ dni: TEST_CLIENTE2.dni });
  const atacante = await Usuario.findOne({ dni: TEST_CLIENTE.dni });
  if (!victima || !atacante) throw new Error('Faltan usuarios de prueba: node scripts/seed-test-users.js');

  const tokenAtacante = await login(TEST_CLIENTE.email, PASSWORD);
  const tokenAdmin = await login(TEST_ADMIN.email, PASSWORD);
  const tokenOperador = await login(TEST_OPERADOR.email, PASSWORD);

  // ------------------------------------------------ Inyección de operadores de Mongo --
  console.log('\n— Inyección de operadores de MongoDB —');

  // El caso grave: `{"token": {"$ne": null}}` encontraba al primer usuario con un token de
  // recuperación vivo y le cambiaba la contraseña. Toma de cuenta sin conocer a la víctima.
  await Usuario.updateOne(
    { _id: victima._id },
    { $set: { tokenRecuperacion: 'token-de-prueba-seguridad', fechaTokenRecuperacion: new Date() } }
  );

  let r = await llamar('POST', '/api/auth/restablecer-password', null, {
    token: { $ne: null }, nuevaPassword: 'HackeadoTotal1'
  });
  check(r.status === 400, 'restablecer-password rechaza un operador como token', `status ${r.status}`);

  const victimaDespues = await Usuario.findById(victima._id).select('password tokenRecuperacion');
  check(
    victimaDespues.tokenRecuperacion === 'token-de-prueba-seguridad',
    'la contraseña de la víctima quedó intacta (el token sigue sin usarse)'
  );
  await Usuario.updateOne({ _id: victima._id }, { $unset: { tokenRecuperacion: '', fechaTokenRecuperacion: '' } });

  r = await llamar('POST', '/api/auth/login', null, { email: { $ne: null }, password: 'loquesea' });
  check(r.status === 400, 'login rechaza un operador como email', `status ${r.status}`);

  r = await llamar('POST', '/api/auth/solicitar-recuperacion', null, { email: { $gt: '' } });
  check(r.status === 400, 'solicitar-recuperacion no dispara mails con un operador por email', `status ${r.status}`);

  r = await llamar('GET', '/api/turnos?estado[$ne]=xxx', tokenAdmin);
  check(r.status === 400, 'un operador en la query string también se rechaza', `status ${r.status}`);

  // --------------------------------------------------------------- Saldo y dinero --
  console.log('\n— Dinero —');

  const saldoAntes = (await Usuario.findById(atacante._id).select('montoDisponible')).montoDisponible;
  r = await llamar('POST', '/api/usuarios/recargar', tokenAtacante, { dni: TEST_CLIENTE.dni, monto: 999999 });
  check(r.status === 410, 'la autorrecarga de saldo ya no existe', `status ${r.status}`);
  const saldoDespues = (await Usuario.findById(atacante._id).select('montoDisponible')).montoDisponible;
  check(saldoDespues === saldoAntes, 'el saldo del cliente no cambió', `$${saldoAntes} -> $${saldoDespues}`);

  r = await llamar('PUT', `/api/admin/usuarios/${TEST_CLIENTE.dni}`, tokenAdmin, {
    montoDisponible: -50000, motivo: 'prueba de saldo negativo'
  });
  check(r.status === 400, 'el admin tampoco puede dejar un saldo negativo', `status ${r.status}`);

  // ----------------------------------------------------------- Estadía de otro --
  console.log('\n— Estadía ajena —');

  // La víctima tiene un auto adentro, pagando con su saldo.
  await Vehiculo.create({ dominio: DOMINIO_VICTIMA, tipo: 'auto', usuario: victima._id, estActivo: false });
  r = await llamar('POST', '/api/estacionamiento/iniciar', tokenAdmin, {
    dni: TEST_CLIENTE2.dni, dominio: DOMINIO_VICTIMA
  });
  check(r.status === 200, 'la víctima entra a la playa por el canal app', `status ${r.status}`);

  const saldoVictimaAntes = (await Usuario.findById(victima._id).select('montoDisponible')).montoDisponible;

  r = await llamar('POST', '/api/estacionamiento/finalizar', tokenAtacante, { dominio: DOMINIO_VICTIMA });
  check(r.status === 403, 'otro cliente no puede cerrar la estadía ajena', `status ${r.status}`);

  const saldoVictimaDespues = (await Usuario.findById(victima._id).select('montoDisponible')).montoDisponible;
  check(saldoVictimaDespues === saldoVictimaAntes, 'y por lo tanto no le debitó el saldo a la víctima');

  r = await llamar('GET', `/api/estacionamiento/estado/${DOMINIO_VICTIMA}`, tokenAtacante);
  check(r.status === 403, 'ni puede espiar el estado de una patente ajena', `status ${r.status}`);

  r = await llamar('GET', `/api/estacionamiento/estado/${DOMINIO_VICTIMA}`, tokenOperador);
  check(r.status === 200, 'el mostrador sí ve cualquier patente: es su trabajo', `status ${r.status}`);

  // Salir gratis: el canal app ya no acepta el medio de pago que venga en el request.
  await Vehiculo.create({ dominio: DOMINIO_PROPIO, tipo: 'auto', usuario: atacante._id, estActivo: false });
  await llamar('POST', '/api/estacionamiento/iniciar', tokenAtacante, { dni: TEST_CLIENTE.dni, dominio: DOMINIO_PROPIO });
  const saldoPropioAntes = (await Usuario.findById(atacante._id).select('montoDisponible')).montoDisponible;
  r = await llamar('POST', '/api/estacionamiento/finalizar', tokenAtacante, { dominio: DOMINIO_PROPIO, medioPago: 'efectivo' });
  const saldoPropioDespues = (await Usuario.findById(atacante._id).select('montoDisponible')).montoDisponible;
  check(r.status === 200, 'el dueño cierra su propia estadía', `status ${r.status}`);
  check(
    saldoPropioDespues < saldoPropioAntes,
    'y se le cobra del saldo aunque haya pedido "efectivo": en autoservicio no hay cajero',
    `$${saldoPropioAntes} -> $${saldoPropioDespues}`
  );

  // --------------------------------------------------------- Escritura de campos --
  console.log('\n— Campos que no son del cliente —');

  r = await llamar('PUT', `/api/vehiculos/usuario/${TEST_CLIENTE.dni}/vehiculo/${DOMINIO_PROPIO}`, tokenAtacante, {
    marca: 'Fiat', estActivo: true, usuario: String(victima._id)
  });
  check(r.status === 200, 'se puede editar la marca del propio vehículo', `status ${r.status}`);
  const vehiculoTocado = await Vehiculo.findOne({ dominio: DOMINIO_PROPIO }).lean();
  check(vehiculoTocado.marca === 'Fiat', 'el campo editable sí se guardó');
  check(vehiculoTocado.estActivo !== true, 'pero `estActivo` no se puede escribir desde el formulario');
  check(String(vehiculoTocado.usuario) === String(atacante._id), 'ni se puede transferir el vehículo a otra cuenta');

  // ------------------------------------------------------------ Límites y regex --
  console.log('\n— Límites de consulta —');

  r = await llamar('GET', '/api/estadias/historial?limite=999999', tokenAdmin);
  check(r.body?.limite === 100, 'el historial acota el límite pedido', `limite ${r.body?.limite}`);

  r = await llamar('GET', '/api/estadias/historial?pagina=abc', tokenAdmin);
  check(r.status === 200 && r.body?.pagina === 1, 'una página no numérica no rompe la consulta', `status ${r.status}`);

  // Un término con retroceso catastrófico: si el regex no estuviera escapado, esto se cuelga.
  const inicio = Date.now();
  r = await llamar('GET', `/api/estadias/historial?dominio=${encodeURIComponent('(a+)+$'.repeat(3))}`, tokenAdmin);
  const tardo = Date.now() - inicio;
  check(r.status === 200 && tardo < 3000, 'una patente con forma de bomba de regex se responde al instante', `${tardo} ms`);

  // ------------------------------------------------------- Enumeración de usuarios --
  console.log('\n— Enumeración de cuentas —');

  const inexistente = await llamar('POST', '/api/auth/login', null, { email: 'nadie@verify.local', password: 'x' });
  const malaPassword = await llamar('POST', '/api/auth/login', null, { email: TEST_CLIENTE.email, password: 'incorrecta' });
  check(
    inexistente.status === malaPassword.status && inexistente.body?.mensaje === malaPassword.body?.mensaje,
    'el login responde igual para "no existe" y "contraseña mala"',
    `${inexistente.status} / ${malaPassword.status}`
  );

  // ------------------------------------------------------------ Fugas en errores --
  console.log('\n— Errores —');

  r = await llamar('POST', '/api/auth/registrar-con-email', null, {});
  check(r.status === 400 && !r.body?.error, 'un alta incompleta responde 400 sin volcar el error interno', `status ${r.status}`);

  // ------------------------------------------------------------------- Limpieza --
  await limpiar();
  await mongoose.disconnect();

  console.log(`\n${fallos === 0 ? '✅' : '❌'} ${ok}/${ok + fallos} OK${fallos ? `, ${fallos} falla(s)` : ''}`);
  process.exit(fallos === 0 ? 0 : 1);
})().catch(async (error) => {
  console.error('Error ejecutando verify-seguridad:', error.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
