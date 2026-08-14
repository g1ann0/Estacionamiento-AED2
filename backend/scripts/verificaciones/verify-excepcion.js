// Verificación del egreso de excepción (ticket perdido).
// Uso: node scripts/verify-excepcion.js
require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');

const DOM_EXC = 'EXCEP01';
const DOM_ACTIVA = 'EXCEP02';

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  const Usuario = require('../../models/Usuario');
  const Vehiculo = require('../../models/Vehiculo');
  const Estacionamiento = require('../../models/Estacionamiento');
  const Transaccion = require('../../models/Transaccion');
  const Sucursal = require('../../models/Sucursal');
  const Caja = require('../../models/Caja');
  const Turno = require('../../models/Turno');
  const MovimientoCaja = require('../../models/MovimientoCaja');
  const ComprobanteEstadia = require('../../models/ComprobanteEstadia');
  const AuditLog = require('../../models/AuditLog');
  const estadiaService = require('../../services/estadiaService');
  const turnoService = require('../../services/turnoService');
  const { TEST_ADMIN } = require('../seed-test-users');

  let fallos = 0;
  const check = (cond, msg) => {
    if (cond) console.log(`OK   ${msg}`);
    else { console.error(`FAIL ${msg}`); fallos++; }
  };

  const dominios = [DOM_EXC, DOM_ACTIVA];
  const limpiar = async () => {
    await Estacionamiento.deleteMany({ vehiculoDominio: { $in: dominios } });
    await Transaccion.deleteMany({ 'vehiculo.dominio': { $in: dominios } });
    await Vehiculo.deleteMany({ dominio: { $in: dominios } });
  };
  await limpiar();

  const admin = await Usuario.findOne({ dni: TEST_ADMIN.dni });
  const sucursal = await Sucursal.findOne({ esPrincipal: true });
  const caja = await Caja.findOne({ activa: true });
  const tarifaOriginal = sucursal.tarifaExcepcion ?? null;

  await Turno.deleteMany({ cajaId: caja._id, estado: 'abierto' });

  // --- 1. Sin tarifa de excepción configurada, el flujo no cobra cero: se niega ---
  await Sucursal.updateOne({ _id: sucursal._id }, { $set: { tarifaExcepcion: null } });
  const turno = await turnoService.abrirTurno({ cajaId: caja._id, operadorId: admin._id, montoInicial: 0 });
  try {
    await estadiaService.egresoExcepcion({ dominio: DOM_EXC, medioPago: 'efectivo', motivo: 'Ticket perdido', operadorId: admin._id });
    check(false, '1. sin tarifa configurada se rechaza');
  } catch (e) {
    check(e.statusCode === 409, `1. sin tarifa configurada se rechaza con 409 (${e.statusCode})`);
  }

  await Sucursal.updateOne({ _id: sucursal._id }, { $set: { tarifaExcepcion: 12000 } });

  // --- 2. Motivo obligatorio ---
  for (const [motivo, etiqueta] of [[undefined, 'ausente'], ['   ', 'en blanco']]) {
    try {
      await estadiaService.egresoExcepcion({ dominio: DOM_EXC, medioPago: 'efectivo', motivo, operadorId: admin._id });
      check(false, `2. motivo ${etiqueta} se rechaza`);
    } catch (e) {
      check(e.statusCode === 400, `2. motivo ${etiqueta} se rechaza con 400`);
    }
  }

  // --- 3. No se puede cobrar con saldo prepago ---
  try {
    await estadiaService.egresoExcepcion({ dominio: DOM_EXC, medioPago: 'saldo_prepago', motivo: 'Ticket perdido', operadorId: admin._id });
    check(false, '3. saldo prepago se rechaza');
  } catch (e) {
    check(e.statusCode === 400, '3. saldo prepago se rechaza con 400 (no hay cuenta detrás)');
  }

  // --- 4. Si la patente TIENE estadía activa, no es excepción ---
  await estadiaService.iniciarEstadia({ dominio: DOM_ACTIVA, origen: 'caja', operadorId: admin._id });
  try {
    await estadiaService.egresoExcepcion({ dominio: DOM_ACTIVA, medioPago: 'efectivo', motivo: 'Ticket perdido', operadorId: admin._id });
    check(false, '4. patente con estadía activa se rechaza');
  } catch (e) {
    check(e.statusCode === 409, '4. patente con estadía activa se rechaza con 409 (cobrala normal)');
  }

  // --- 5. Cobro exitoso: monto de configuración, no del request ---
  const resultado = await estadiaService.egresoExcepcion({
    dominio: DOM_EXC, medioPago: 'efectivo', motivo: 'Ticket perdido — cliente sin comprobante', operadorId: admin._id
  });
  check(resultado.montoTotal === 12000, `5. cobra el monto configurado ($${resultado.montoTotal})`);
  check(!!resultado.comprobante, '5. genera comprobante');
  check(!!resultado.movimientoCaja, '5. genera movimiento de caja en el turno');

  const estadia = await Estacionamiento.findOne({ vehiculoDominio: DOM_EXC });
  check(estadia.origen === 'excepcion', '5. la estadía queda marcada como excepción');
  check(estadia.estado === 'finalizado', '5. la estadía nace finalizada');
  check(estadia.motivoExcepcion === 'Ticket perdido — cliente sin comprobante', '5. guarda el motivo');
  check(estadia.usuarioDNI === null, '5. sin titular, como corresponde a un ticket perdido');

  const auditoria = await AuditLog.findOne({ accion: 'egreso_excepcion', entidadId: String(estadia._id) });
  check(!!auditoria, '5. queda auditada como egreso_excepcion');
  check(auditoria?.motivo?.includes('Ticket perdido'), '5. la auditoría conserva el motivo');

  const vehiculo = await Vehiculo.findOne({ dominio: DOM_EXC });
  check(vehiculo && vehiculo.estActivo === false, '5. el vehículo queda libre');

  // --- 6. Sin turno abierto no se puede cobrar ---
  await Turno.updateOne({ _id: turno._id }, { $set: { estado: 'cerrado', fechaCierre: new Date() } });
  await Estacionamiento.deleteMany({ vehiculoDominio: DOM_EXC });
  try {
    await estadiaService.egresoExcepcion({ dominio: DOM_EXC, medioPago: 'efectivo', motivo: 'Ticket perdido', operadorId: admin._id });
    check(false, '6. sin turno abierto se rechaza');
  } catch (e) {
    check(e.statusCode === 409, '6. sin turno abierto se rechaza con 409');
  }

  // --- 7. resolverPatente informa si la excepción está disponible ---
  const resuelta = await estadiaService.resolverPatente({ dominio: DOM_EXC });
  check(resuelta.excepcion?.disponible === true, '7. resolver informa que la excepción está disponible');
  check(resuelta.excepcion?.monto === 12000, '7. resolver informa el monto de la excepción');

  await Sucursal.updateOne({ _id: sucursal._id }, { $set: { tarifaExcepcion: null } });
  const sinTarifa = await estadiaService.resolverPatente({ dominio: DOM_EXC });
  check(sinTarifa.excepcion?.disponible === false, '7. sin tarifa configurada, resolver la reporta no disponible');

  // Limpieza
  await Sucursal.updateOne({ _id: sucursal._id }, { $set: { tarifaExcepcion: tarifaOriginal } });
  await MovimientoCaja.deleteMany({ turnoId: turno._id });
  await Turno.deleteMany({ cajaId: caja._id });
  await ComprobanteEstadia.deleteMany({ 'estadia.dominio': { $in: dominios } });
  await AuditLog.deleteMany({ accion: 'egreso_excepcion', entidadId: String(estadia._id) });
  await limpiar();
  await mongoose.disconnect();

  console.log(fallos === 0 ? '\nTodo OK' : `\n${fallos} fallo(s)`);
  process.exit(fallos === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
