// Verificación de la resolución de patente para la terminal de caja.
// Uso: node scripts/verify-resolver.js
//
// A diferencia de los verify-etapa*, este no necesita el servidor levantado: ejercita
// estadiaService directamente, porque lo que hay que probar es la lógica de resolución y la
// garantía central del flujo de cobro — que el importe previsualizado sea exactamente el que
// después cobra finalizarEstadia.
require('dotenv').config();
const mongoose = require('mongoose');

const DOM_NUEVO = 'RESOLV01';   // nunca visto
const DOM_REGIS = 'RESOLV02';   // vehículo de un cliente registrado
const DOM_OCAS = 'RESOLV03';    // estadía de cliente ocasional

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  const Usuario = require('../../models/Usuario');
  const Vehiculo = require('../../models/Vehiculo');
  const Estacionamiento = require('../../models/Estacionamiento');
  const Transaccion = require('../../models/Transaccion');
  const Caja = require('../../models/Caja');
  const Turno = require('../../models/Turno');
  const MovimientoCaja = require('../../models/MovimientoCaja');
  const ComprobanteEstadia = require('../../models/ComprobanteEstadia');
  const estadiaService = require('../../services/estadiaService');
  const turnoService = require('../../services/turnoService');
  const { TEST_CLIENTE, TEST_ADMIN } = require('../seed-test-users');

  let fallos = 0;
  const check = (cond, msg) => {
    if (cond) console.log(`OK   ${msg}`);
    else { console.error(`FAIL ${msg}`); fallos++; }
  };

  const dominios = [DOM_NUEVO, DOM_REGIS, DOM_OCAS];
  const limpiar = async () => {
    await Estacionamiento.deleteMany({ vehiculoDominio: { $in: dominios } });
    await Transaccion.deleteMany({ 'vehiculo.dominio': { $in: dominios } });
    await Vehiculo.deleteMany({ dominio: { $in: dominios } });
    await ComprobanteEstadia.deleteMany({ 'estadia.dominio': { $in: dominios } });
  };
  await limpiar();

  const cliente = await Usuario.findOne({ dni: TEST_CLIENTE.dni });
  const admin = await Usuario.findOne({ dni: TEST_ADMIN.dni });
  if (!cliente || !admin) {
    console.error('Faltan los usuarios de prueba. Corré: node scripts/seed-test-users.js');
    process.exit(1);
  }

  // --- 1. Patente nunca vista ---
  const nuevo = await estadiaService.resolverPatente({ dominio: ` ${DOM_NUEVO.toLowerCase()} ` });
  check(nuevo.dominio === DOM_NUEVO, '1. normaliza la patente (trim + mayúsculas)');
  check(nuevo.estado === 'afuera' && nuevo.accion === 'ingresar', '1. patente desconocida resuelve a INGRESAR');
  check(nuevo.vehiculoNuevo === true && nuevo.vehiculo === null, '1. marca el vehículo como nuevo');
  check(nuevo.cliente.tipo === 'ocasional', '1. cliente ocasional por defecto');
  check(typeof nuevo.tarifa.precioPorHora === 'number' && !!nuevo.tarifa.etiqueta, '1. devuelve tarifa con etiqueta de origen');

  // --- 2. Vehículo de cliente registrado, afuera ---
  await Vehiculo.create({
    dominio: DOM_REGIS, tipo: 'auto', marca: 'Volkswagen', modelo: 'Golf', año: '2021',
    usuario: cliente._id, estActivo: false
  });
  const registrado = await estadiaService.resolverPatente({ dominio: DOM_REGIS });
  check(registrado.estado === 'afuera', '2. vehículo conocido sin estadía resuelve a INGRESAR');
  check(registrado.vehiculoNuevo === false && registrado.vehiculo.modelo === 'Golf', '2. devuelve los datos del vehículo conocido');
  check(registrado.cliente.tipo === 'registrado' && registrado.cliente.dni === TEST_CLIENTE.dni, '2. identifica al titular registrado');

  // --- 3. Estadía activa de cliente ocasional ---
  await estadiaService.iniciarEstadia({
    dominio: DOM_OCAS, porton: 'Norte', origen: 'caja', operadorId: admin._id,
    clienteOcasional: { nombre: 'Cliente Resolver' }
  });
  // Antigüedad forzada: 2h 12m -> con redondeo hacia arriba deben cobrarse 3 horas.
  const horaInicio = new Date(Date.now() - ((2 * 60 + 12) * 60 * 1000));
  await Estacionamiento.updateOne({ vehiculoDominio: DOM_OCAS, estado: 'activo' }, { $set: { horaInicio } });

  const adentro = await estadiaService.resolverPatente({ dominio: DOM_OCAS });
  check(adentro.estado === 'adentro' && adentro.accion === 'cobrar', '3. estadía activa resuelve a COBRAR');
  check(adentro.cobro.duracionHoras === 3, `3. redondea 2h12m a 3 horas (dio ${adentro.cobro.duracionHoras})`);
  check(adentro.cobro.montoTotal === 3 * adentro.tarifa.precioPorHora, '3. importe = horas redondeadas × tarifa');
  check(adentro.cliente.tipo === 'ocasional', '3. cliente ocasional en la estadía de caja');

  const saldo = adentro.mediosPago.find((m) => m.medio === 'saldo_prepago');
  check(saldo.disponible === false && saldo.motivo === 'Sin cuenta registrada', '3. saldo prepago no disponible sin cuenta, con motivo');

  // --- 4. Turno: el bloqueo se ve ANTES de cobrar ---
  const caja = await Caja.findOne({ activa: true });
  await Turno.deleteMany({ cajaId: caja._id, estado: 'abierto' });
  const sinTurno = await estadiaService.resolverPatente({ dominio: DOM_OCAS });
  const efectivoSinTurno = sinTurno.mediosPago.find((m) => m.medio === 'efectivo');
  check(sinTurno.turno.requiere === true && sinTurno.turno.abierto === false, '4. informa que falta turno abierto');
  check(efectivoSinTurno.disponible === false && efectivoSinTurno.motivo === 'No hay turno abierto', '4. efectivo bloqueado con motivo legible');

  const turno = await turnoService.abrirTurno({ cajaId: caja._id, operadorId: admin._id, montoInicial: 0 });
  const conTurno = await estadiaService.resolverPatente({ dominio: DOM_OCAS });
  check(conTurno.turno.abierto === true && conTurno.turno.numero === turno.numero, '4. reconoce el turno abierto y su número');
  check(conTurno.mediosPago.find((m) => m.medio === 'efectivo').disponible === true, '4. efectivo habilitado con turno abierto');

  // --- 5. LA GARANTÍA: lo previsualizado es lo que se cobra ---
  const previo = await estadiaService.resolverPatente({ dominio: DOM_OCAS });
  const cobrado = await estadiaService.finalizarEstadia({
    dominio: DOM_OCAS, medioPago: 'efectivo', operadorId: admin._id
  });
  check(cobrado.montoTotal === previo.cobro.montoTotal,
    `5. el importe cobrado ($${cobrado.montoTotal}) es el previsualizado ($${previo.cobro.montoTotal})`);
  check(cobrado.duracionHoras === previo.cobro.duracionHoras, '5. las horas cobradas son las previsualizadas');

  // --- 6. Ingreso desde caja de un registrado sin saldo ya no se bloquea ---
  const saldoOriginal = cliente.montoDisponible;
  await Usuario.updateOne({ _id: cliente._id }, { $set: { montoDisponible: 0 } });
  try {
    await estadiaService.iniciarEstadia({
      dni: TEST_CLIENTE.dni, dominio: DOM_REGIS, porton: 'Norte', origen: 'caja', operadorId: admin._id
    });
    check(true, '6. cliente registrado con saldo 0 puede ingresar desde caja (paga al salir)');
  } catch (error) {
    check(false, `6. cliente registrado con saldo 0 puede ingresar desde caja — falló: ${error.message}`);
  }
  try {
    await estadiaService.iniciarEstadia({ dni: TEST_CLIENTE.dni, dominio: 'RESOLV04', porton: 'Norte' });
    check(false, '6. canal app sigue exigiendo saldo positivo');
  } catch (error) {
    check(/[Ss]aldo insuficiente/.test(error.message), '6. canal app sigue exigiendo saldo positivo');
  }
  await Usuario.updateOne({ _id: cliente._id }, { $set: { montoDisponible: saldoOriginal } });

  // --- 7. Ocupación: sin capacidad configurada no se inventa denominador ---
  const Sucursal = require('../../models/Sucursal');
  const estadiaManualController = require('../../controllers/estadiaManualController');
  const respuesta = { status: null, cuerpo: null };
  const resFalso = { status(c) { respuesta.status = c; return this; }, json(b) { respuesta.cuerpo = b; } };

  const sucursal = await Sucursal.findOne({ esPrincipal: true });
  const capacidadOriginal = sucursal.capacidad?.total ?? null;

  await Sucursal.updateOne({ _id: sucursal._id }, { $set: { 'capacidad.total': null } });
  await estadiaManualController.listarActivas({}, resFalso, (e) => { throw e; });
  check(respuesta.cuerpo.ocupacion.capacidad === null, '7. sin capacidad configurada, capacidad viaja en null');
  check(respuesta.cuerpo.ocupacion.completa === false, '7. sin capacidad, nunca se reporta "completa"');
  check(typeof respuesta.cuerpo.ocupacion.dentro === 'number', '7. informa cuántos hay adentro igual');

  await Sucursal.updateOne({ _id: sucursal._id }, { $set: { 'capacidad.total': 1 } });
  await estadiaManualController.listarActivas({}, resFalso, (e) => { throw e; });
  const esperadoCompleta = respuesta.cuerpo.ocupacion.dentro >= 1;
  check(respuesta.cuerpo.ocupacion.completa === esperadoCompleta, '7. con capacidad 1, detecta playa completa');

  await Sucursal.updateOne({ _id: sucursal._id }, { $set: { 'capacidad.total': capacidadOriginal } });

  // --- 8. Patente vacía ---
  try {
    await estadiaService.resolverPatente({ dominio: '   ' });
    check(false, '8. patente vacía rechazada con 400');
  } catch (error) {
    check(error.statusCode === 400, '8. patente vacía rechazada con 400');
  }

  await limpiar();
  await Turno.deleteMany({ cajaId: caja._id });
  await MovimientoCaja.deleteMany({ turnoId: turno._id });
  await mongoose.disconnect();

  console.log(fallos === 0 ? '\nTodo OK' : `\n${fallos} fallo(s)`);
  process.exit(fallos === 0 ? 0 : 1);
})();
