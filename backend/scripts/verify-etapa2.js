// Verificación manual de Etapa 2 — cliente ocasional, Vehiculo sin dueño, Sucursal.
// No pasa por HTTP (no existe endpoint público todavía — eso es Etapa 5) sino que
// llama directamente a estadiaService, que es donde vive la lógica de esta etapa.
// Uso: node scripts/verify-etapa2.js
require('dotenv').config();
const mongoose = require('mongoose');

const TEST_DOMINIO = 'TESTOCAS';

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const Vehiculo = require('../models/Vehiculo');
  const Estacionamiento = require('../models/Estacionamiento');
  const Transaccion = require('../models/Transaccion');
  const Sucursal = require('../models/Sucursal');
  const estadiaService = require('../services/estadiaService');
  const { crearSucursalPrincipalPorDefecto } = require('../utils/seedData');

  // Este script conecta directo a Mongo sin pasar por server.js, así que el seed
  // automático de arranque no corrió — lo disparamos acá (es idempotente).
  await crearSucursalPrincipalPorDefecto();

  let fallos = 0;
  const check = (cond, msg) => {
    if (cond) console.log(`OK   ${msg}`);
    else { console.error(`FAIL ${msg}`); fallos++; }
  };

  // Limpieza previa
  await Estacionamiento.deleteMany({ vehiculoDominio: TEST_DOMINIO });
  await Transaccion.deleteMany({ 'vehiculo.dominio': TEST_DOMINIO });
  await Vehiculo.deleteMany({ dominio: TEST_DOMINIO });

  // --- Sucursal principal sembrada ---
  const sucursalPrincipal = await Sucursal.findOne({ esPrincipal: true });
  check(!!sucursalPrincipal, 'existe una Sucursal principal sembrada por defecto');

  // --- Ingreso de cliente ocasional (sin dni) ---
  const { estacionamiento, transaccion } = await estadiaService.iniciarEstadia({
    dominio: TEST_DOMINIO,
    porton: 'Norte',
    origen: 'caja',
    clienteOcasional: { nombre: 'Juan Pérez', telefono: '3510000000' }
  });

  check(estacionamiento.usuarioDNI === null || estacionamiento.usuarioDNI === undefined, 'Estacionamiento se creó sin usuarioDNI');
  check(estacionamiento.origen === 'caja', 'Estacionamiento.origen === "caja"');
  check(estacionamiento.clienteOcasional?.nombre === 'Juan Pérez', 'Estacionamiento.clienteOcasional se guardó correctamente');
  check(String(estacionamiento.sucursalId) === String(sucursalPrincipal?._id), 'Estacionamiento.sucursalId resolvió a la sucursal principal por defecto');

  check(transaccion.origen === 'caja', 'Transaccion.origen === "caja"');
  check(!transaccion.usuario, 'Transaccion se creó sin usuario asociado');
  check(transaccion.clienteOcasional?.nombre === 'Juan Pérez', 'Transaccion.clienteOcasional se guardó correctamente');

  // --- Vehiculo se creó automáticamente, sin dueño ---
  const vehiculo = await Vehiculo.findOne({ dominio: TEST_DOMINIO });
  check(!!vehiculo, 'Vehiculo se creó automáticamente para el cliente ocasional');
  check(vehiculo && !vehiculo.usuario, 'Vehiculo.usuario es null (sin propietario)');
  check(vehiculo && vehiculo.estActivo === true, 'Vehiculo.estActivo === true tras el ingreso');

  // --- Doble ingreso sigue bloqueado (guard de concurrencia no se rompió) ---
  try {
    await estadiaService.iniciarEstadia({ dominio: TEST_DOMINIO, porton: 'Sur', origen: 'caja' });
    console.error('FAIL doble ingreso del mismo dominio debería fallar con 409');
    fallos++;
  } catch (e) {
    check(e.statusCode === 409, `doble ingreso rechazado correctamente (${e.statusCode})`);
  }

  // --- Egreso de cliente ocasional sin medioPago: Etapa 3 ya lo desbloqueó, pero
  // medioPago sigue siendo obligatorio sin cuenta registrada (400, no 404 ni crash).
  // Ver scripts/verify-etapa3.js para el caso con medioPago sí provisto.
  try {
    await estadiaService.finalizarEstadia({ dominio: TEST_DOMINIO });
    console.error('FAIL egreso de cliente ocasional sin medioPago debería fallar con 400');
    fallos++;
  } catch (e) {
    check(e.statusCode === 400, `egreso de cliente ocasional sin medioPago -> 400 (no crash) -> ${e.statusCode}`);
  }

  // --- Regresión: el canal app (con dni) sigue funcionando igual que antes ---
  const { TEST_CLIENTE, TEST_DOMINIO: DOM_APP, PASSWORD } = require('./seed-test-users');
  const Usuario = require('../models/Usuario');
  await Estacionamiento.deleteMany({ vehiculoDominio: DOM_APP });
  await Transaccion.deleteMany({ 'vehiculo.dominio': DOM_APP });
  await Vehiculo.updateOne({ dominio: DOM_APP }, { $set: { estActivo: false } });
  await Usuario.updateOne({ dni: TEST_CLIENTE.dni }, { $set: { montoDisponible: 100000 } });

  const resultadoApp = await estadiaService.iniciarEstadia({ dni: TEST_CLIENTE.dni, dominio: DOM_APP, porton: 'Este' });
  check(resultadoApp.estacionamiento.origen === 'app', 'canal app sigue default origen="app"');
  check(resultadoApp.estacionamiento.usuarioDNI === TEST_CLIENTE.dni, 'canal app sigue guardando usuarioDNI');
  await estadiaService.finalizarEstadia({ dominio: DOM_APP });

  // Limpieza final
  await Estacionamiento.deleteMany({ vehiculoDominio: TEST_DOMINIO });
  await Transaccion.deleteMany({ 'vehiculo.dominio': TEST_DOMINIO });
  await Vehiculo.deleteMany({ dominio: TEST_DOMINIO });
  await Estacionamiento.deleteMany({ vehiculoDominio: DOM_APP });
  await Transaccion.deleteMany({ 'vehiculo.dominio': DOM_APP });
  await Vehiculo.updateOne({ dominio: DOM_APP }, { $set: { estActivo: false } });

  await mongoose.disconnect();

  console.log(`\n${fallos === 0 ? '✅ TODO OK' : `❌ ${fallos} fallo(s)`}`);
  process.exit(fallos === 0 ? 0 : 1);
})().catch(err => {
  console.error('Error ejecutando verify-etapa2:', err);
  process.exit(1);
});
