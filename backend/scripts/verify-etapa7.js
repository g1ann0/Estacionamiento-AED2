// Verificación de la Etapa 7 — auditoría avanzada y endurecimiento.
//
// Cubre las tres cosas que la etapa agrega:
//
//   7.1  El histórico de cierres filtrable (operador / caja / período) y el acumulado de
//        diferencias que lo acompaña.
//   7.2  El turno tiene dueño: un operador no lee ni toca el turno de otro. Es el IDOR que
//        importa acá, porque el resumen de cierre trae justo los importes que la caja ciega
//        le esconde al que está por contar el cajón.
//   7.2  El límite de intentos de la superficie sin token.
//
// Los datos se arman en la base (turnos cerrados con diferencias conocidas) y se consultan
// por la API, que es donde viven los filtros y los permisos. Todo lo creado se borra al final.
//
// Uso: levantar el servidor con RATE_LIMIT_OFF=true (el script hace varios logins seguidos) y
//      BASE_URL=http://localhost:3999 node scripts/verify-etapa7.js

require('dotenv').config();
const mongoose = require('mongoose');
const { TEST_ADMIN, TEST_CLIENTE, TEST_OPERADOR, TEST_OPERADOR2, PASSWORD } = require('./seed-test-users');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3999';
const CAJA_A = 'Caja Verify E7 A';
const CAJA_B = 'Caja Verify E7 B';

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
  if (res.status === 429) {
    throw new Error('El login está rate-limiteado (429). Levantá el servidor con RATE_LIMIT_OFF=true.');
  }
  if (!res.ok) throw new Error(`Login falló para ${email}: ${res.status} ${JSON.stringify(data)}`);
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

// Fecha local en formato AAAA-MM-DD, que es lo que manda un <input type="date">. Con
// `toISOString()` la fecha se corre a UTC y en Argentina eso es el día anterior a partir de
// las 21:00 — un filtro "hasta hoy" que pierde los turnos de la noche.
const diaLocal = (fecha) => {
  const dos = (n) => String(n).padStart(2, '0');
  return `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}`;
};

const diasAtras = (dias) => {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() - dias);
  fecha.setHours(12, 0, 0, 0); // mediodía: lejos de los dos bordes del día
  return fecha;
};

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  const Usuario = require('../models/Usuario');
  const Caja = require('../models/Caja');
  const Turno = require('../models/Turno');
  const MovimientoCaja = require('../models/MovimientoCaja');

  const operador1 = await Usuario.findOne({ dni: TEST_OPERADOR.dni });
  const operador2 = await Usuario.findOne({ dni: TEST_OPERADOR2.dni });
  if (!operador1 || !operador2) {
    throw new Error('Faltan los operadores de prueba. Corré primero: node scripts/seed-test-users.js');
  }

  const limpiar = async () => {
    const cajas = await Caja.find({ nombre: { $in: [CAJA_A, CAJA_B] } }).select('_id');
    const ids = cajas.map((c) => c._id);
    if (ids.length > 0) {
      const turnos = await Turno.find({ cajaId: { $in: ids } }).select('_id');
      await MovimientoCaja.deleteMany({ turnoId: { $in: turnos.map((t) => t._id) } });
      await Turno.deleteMany({ cajaId: { $in: ids } });
      await Caja.deleteMany({ _id: { $in: ids } });
    }
  };
  await limpiar();

  // El próximo número queda por encima de los turnos que se insertan a mano: el índice único
  // {cajaId, numero} es real y una caja que reparte un número ya usado no abre turno.
  const cajaA = await Caja.create({ nombre: CAJA_A, activa: true, proximoNumeroTurno: 110 });
  const cajaB = await Caja.create({ nombre: CAJA_B, activa: true, proximoNumeroTurno: 210 });

  // Cinco arqueos con diferencias conocidas. El anulado lleva un descuadre enorme a propósito:
  // si aparece en algún total, el número salta a la vista.
  const cerrado = (cajaId, numero, operadorId, fecha, diferencia, estado = 'cerrado') => ({
    cajaId,
    numero,
    operadorId,
    fechaApertura: fecha,
    fechaCierre: new Date(fecha.getTime() + 8 * 60 * 60 * 1000),
    montoInicial: 10000,
    montoEsperadoCierre: 50000,
    montoDeclaradoCierre: 50000 + diferencia,
    diferencia,
    estado,
    observacionCierre: diferencia === 0 ? '' : 'diferencia de prueba'
  });

  const fecha20 = diasAtras(20);
  const fecha10 = diasAtras(10);
  const fecha2 = diasAtras(2);

  await Turno.create([
    cerrado(cajaA._id, 100, operador1._id, fecha20, -5000),
    cerrado(cajaA._id, 101, operador1._id, fecha10, 2000),
    cerrado(cajaA._id, 102, operador1._id, fecha2, 0),
    cerrado(cajaB._id, 200, operador2._id, fecha2, -1500),
    cerrado(cajaB._id, 201, operador2._id, fecha2, -99999, 'anulado')
  ]);

  const tokenAdmin = await login(TEST_ADMIN.email, PASSWORD);
  const tokenOperador1 = await login(TEST_OPERADOR.email, PASSWORD);
  const tokenOperador2 = await login(TEST_OPERADOR2.email, PASSWORD);
  const tokenCliente = await login(TEST_CLIENTE.email, PASSWORD);

  // Las cajas de prueba conviven con las reales de la base de desarrollo, así que todas las
  // consultas se acotan a ellas: el reporte sin filtro mezcla los turnos que ya había.
  const soloA = `cajaId=${cajaA._id}`;
  const soloB = `cajaId=${cajaB._id}`;

  // ---------------------------------------------------------------- 7.1 reporte --
  console.log('\n— 7.1 · Reporte de diferencias de caja —');

  let r = await llamar('GET', `/api/reportes/cierres?${soloA}`, tokenAdmin);
  check(r.status === 200, 'el reporte responde 200 al admin', `status ${r.status}`);
  check(r.body?.totales?.turnos === 3, 'cuenta los tres turnos cerrados de la caja A', `${r.body?.totales?.turnos}`);
  check(r.body?.totales?.faltante === 5000, 'el faltante va en positivo y sumado aparte', `$${r.body?.totales?.faltante}`);
  check(r.body?.totales?.sobrante === 2000, 'el sobrante va separado del faltante', `$${r.body?.totales?.sobrante}`);
  check(r.body?.totales?.diferenciaNeta === -3000, 'el neto es la suma con signo', `$${r.body?.totales?.diferenciaNeta}`);
  check(r.body?.totales?.conDiferencia === 2, 'el arqueo que cerró en cero no cuenta como diferencia', `${r.body?.totales?.conDiferencia}`);

  const reporteB = await llamar('GET', `/api/reportes/cierres?${soloB}`, tokenAdmin);
  check(reporteB.body?.totales?.turnos === 1, 'el turno anulado queda fuera del acumulado', `${reporteB.body?.totales?.turnos} turno(s)`);
  check(
    reporteB.body?.totales?.faltante === 1500,
    'la diferencia del anulado no se suma como plata faltante',
    `$${reporteB.body?.totales?.faltante}`
  );

  const porOperador = r.body?.porOperador ?? [];
  check(porOperador.length === 1, 'agrupa por operador', `${porOperador.length} fila(s)`);
  check(
    porOperador[0]?.operador?.nombre === TEST_OPERADOR.nombre,
    'la fila del operador trae su nombre resuelto',
    `${porOperador[0]?.operador?.nombre} ${porOperador[0]?.operador?.apellido ?? ''}`
  );

  const porCaja = r.body?.porCaja ?? [];
  check(porCaja[0]?.caja?.nombre === CAJA_A, 'la fila de caja trae el nombre resuelto', `${porCaja[0]?.caja?.nombre}`);

  const porOperador2 = await llamar('GET', `/api/reportes/cierres?operadorId=${operador2._id}`, tokenAdmin);
  check(
    (porOperador2.body?.porOperador ?? []).every((fila) => String(fila._id) === String(operador2._id)),
    'filtrado por operador, solo aparece ese operador'
  );

  const enRango = await llamar(
    'GET',
    `/api/reportes/cierres?${soloA}&desde=${diaLocal(fecha10)}&hasta=${diaLocal(fecha2)}`,
    tokenAdmin
  );
  check(enRango.body?.totales?.turnos === 2, 'el período recorta por fecha de apertura', `${enRango.body?.totales?.turnos} turno(s)`);
  check(enRango.body?.totales?.faltante === 0, 'el turno con faltante quedó fuera del período elegido');

  const hastaHoy = await llamar('GET', `/api/reportes/cierres?${soloB}&hasta=${diaLocal(new Date())}`, tokenAdmin);
  check(hastaHoy.body?.totales?.turnos === 1, '"hasta hoy" incluye el día completo, no hasta las 00:00');

  const idFeo = await llamar('GET', '/api/reportes/cierres?operadorId=no-es-un-id', tokenAdmin);
  check(idFeo.status === 400, 'un id mal formado responde 400, no 500', `status ${idFeo.status}`);

  const reporteOperador = await llamar('GET', '/api/reportes/cierres', tokenOperador1);
  check(reporteOperador.status === 403, 'el acumulado de diferencias es solo del admin', `status ${reporteOperador.status}`);

  // ------------------------------------------------------------- 7.1 histórico --
  console.log('\n— 7.1 · Histórico de cierres filtrable —');

  r = await llamar('GET', `/api/turnos?${soloA}&estado=cerrado,anulado`, tokenAdmin);
  check(r.body?.total === 3, 'lista los cierres de la caja pedida', `${r.body?.total}`);

  r = await llamar('GET', `/api/turnos?operadorId=${operador2._id}&estado=cerrado,anulado`, tokenAdmin);
  check(r.body?.total === 2, 'filtra por operador e incluye el anulado en la lista', `${r.body?.total}`);
  check(
    (r.body?.turnos ?? []).every((t) => String(t.operadorId?._id ?? t.operadorId) === String(operador2._id)),
    'ninguna fila es de otro operador'
  );

  r = await llamar('GET', `/api/turnos?${soloA}&desde=${diaLocal(fecha10)}`, tokenAdmin);
  check(r.body?.total === 2, 'el filtro por fecha desde recorta la lista', `${r.body?.total}`);

  r = await llamar('GET', '/api/turnos?estado=inventado', tokenAdmin);
  check(r.status === 400, 'un estado que no existe responde 400', `status ${r.status}`);

  r = await llamar('GET', '/api/turnos?cajaId=123', tokenAdmin);
  check(r.status === 400, 'un cajaId mal formado responde 400, no CastError', `status ${r.status}`);

  r = await llamar('GET', '/api/turnos?limite=999999', tokenAdmin);
  check(r.body?.limite === 100, 'el límite se acota: no se puede pedir la colección entera', `limite ${r.body?.limite}`);

  r = await llamar('GET', '/api/turnos?pagina=0', tokenAdmin);
  check(r.body?.pagina === 1, 'página 0 se lee como la primera', `pagina ${r.body?.pagina}`);

  r = await llamar('GET', '/api/turnos', tokenCliente);
  check(r.status === 403, 'un cliente no ve el histórico de arqueos', `status ${r.status}`);

  // ------------------------------------------------------- 7.2 el turno es de uno --
  console.log('\n— 7.2 · El turno tiene dueño —');

  const abierto = await llamar('POST', '/api/turnos/abrir', tokenOperador1, { cajaId: String(cajaA._id), montoInicial: 5000 });
  check(abierto.status === 201, 'el operador 1 abre su turno', `status ${abierto.status}`);
  const turnoId = abierto.body?.turno?._id;

  const propio = await llamar('GET', `/api/turnos/${turnoId}/movimientos`, tokenOperador1);
  check(propio.status === 200, 'el dueño lee los movimientos de su turno', `status ${propio.status}`);

  const ajenoMovimientos = await llamar('GET', `/api/turnos/${turnoId}/movimientos`, tokenOperador2);
  check(ajenoMovimientos.status === 403, 'otro operador no lee los movimientos del turno ajeno', `status ${ajenoMovimientos.status}`);

  const ajenoContadores = await llamar('GET', `/api/turnos/${turnoId}/contadores`, tokenOperador2);
  check(ajenoContadores.status === 403, 'otro operador no ve los contadores del turno ajeno', `status ${ajenoContadores.status}`);

  const ajenoResumen = await llamar('GET', `/api/turnos/${turnoId}/resumen-cierre`, tokenOperador2);
  check(ajenoResumen.status === 403, 'otro operador no ve el resumen con importes del turno ajeno', `status ${ajenoResumen.status}`);

  const ajenoMovimiento = await llamar('POST', `/api/turnos/${turnoId}/movimientos`, tokenOperador2, {
    tipo: 'egreso', medioPago: 'efectivo', monto: 1000, motivo: 'intento indebido'
  });
  check(ajenoMovimiento.status === 403, 'otro operador no mete un movimiento en la caja ajena', `status ${ajenoMovimiento.status}`);

  const ajenoCierre = await llamar('POST', `/api/turnos/${turnoId}/cerrar`, tokenOperador2, {
    montoDeclaradoCierre: 5000, observacionCierre: 'intento indebido'
  });
  check(ajenoCierre.status === 403, 'otro operador no cierra el turno ajeno', `status ${ajenoCierre.status}`);

  const movimientosDespues = await llamar('GET', `/api/turnos/${turnoId}/movimientos`, tokenOperador1);
  check((movimientosDespues.body?.movimientos ?? []).length === 0, 'ninguno de los intentos dejó rastro en la caja');

  const adminResumen = await llamar('GET', `/api/turnos/${turnoId}/resumen-cierre`, tokenAdmin);
  check(adminResumen.status === 200, 'el admin sí entra a cualquier turno: es quien revisa', `status ${adminResumen.status}`);

  const inexistente = await llamar('GET', '/api/turnos/000000000000000000000000/resumen-cierre', tokenOperador1);
  check(inexistente.status === 404, 'un turno que no existe responde 404', `status ${inexistente.status}`);

  const idBasura = await llamar('GET', '/api/turnos/no-es-un-id/resumen-cierre', tokenOperador1);
  check(idBasura.status === 404, 'un id que no es un id responde 404, no 500', `status ${idBasura.status}`);

  // El turno propio se cierra bien: el guard protege del ajeno, no estorba al dueño.
  const cierrePropio = await llamar('POST', `/api/turnos/${turnoId}/cerrar`, tokenOperador1, {
    montoDeclaradoCierre: 5000, observacionCierre: ''
  });
  check(cierrePropio.status === 200, 'el dueño cierra su propio turno sin fricción', `status ${cierrePropio.status}`);

  // -------------------------------------------------------- 7.2 límite de intentos --
  console.log('\n— 7.2 · Límite de intentos —');

  const rateLimit = require('../middlewares/rateLimit');
  const correr = (middleware, ruta = '/login', ip = '10.0.0.1') => new Promise((resolver) => {
    const req = { ip, baseUrl: '/api/auth', path: ruta };
    const res = {
      headers: {},
      setHeader(clave, valor) { this.headers[clave] = valor; },
      status(codigo) { this.codigo = codigo; return this; },
      json(cuerpo) { resolver({ bloqueado: true, codigo: this.codigo, cuerpo, headers: this.headers }); }
    };
    middleware(req, res, () => resolver({ bloqueado: false }));
  });

  const limitador = rateLimit({ ventanaMs: 200, maximo: 3 });
  const primeros = [];
  for (let i = 0; i < 3; i += 1) primeros.push(await correr(limitador));
  check(primeros.every((p) => !p.bloqueado), 'los intentos dentro del límite pasan');

  const cuarto = await correr(limitador);
  check(cuarto.bloqueado && cuarto.codigo === 429, 'el intento que se pasa recibe 429', `codigo ${cuarto.codigo}`);
  check(Boolean(cuarto.headers?.['Retry-After']), 'y un Retry-After que dice cuánto esperar', `${cuarto.headers?.['Retry-After']}s`);

  const otraRuta = await correr(limitador, '/solicitar-recuperacion');
  check(!otraRuta.bloqueado, 'gastar los intentos de una ruta no bloquea la otra');

  const otraIp = await correr(limitador, '/login', '10.0.0.2');
  check(!otraIp.bloqueado, 'el límite es por IP: un cliente bloqueado no bloquea al resto');

  await new Promise((resolver) => setTimeout(resolver, 250));
  const pasadaLaVentana = await correr(limitador);
  check(!pasadaLaVentana.bloqueado, 'pasada la ventana, se vuelve a poder intentar');

  // ------------------------------------------------------------------- Limpieza --
  await limpiar();
  await mongoose.disconnect();

  console.log(`\n${fallos === 0 ? '✅' : '❌'} ${ok}/${ok + fallos} OK${fallos ? `, ${fallos} falla(s)` : ''}`);
  process.exit(fallos === 0 ? 0 : 1);
})().catch(async (error) => {
  console.error('Error ejecutando verify-etapa7:', error.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
