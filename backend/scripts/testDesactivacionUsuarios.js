/**
 * Script de Prueba - Sistema de Desactivación/Reactivación de Usuarios
 * 
 * Este script verifica todas las funcionalidades del sistema de gestión de usuarios.
 * Ejecutar con: node backend/scripts/testDesactivacionUsuarios.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

const Usuario = require('../models/Usuario');
const Vehiculo = require('../models/Vehiculo');
const LogUsuario = require('../models/LogUsuario');
const Estacionamiento = require('../models/Estacionamiento');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/estacionamiento';

// Colores para la consola
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

const log = {
  success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
  info: (msg) => console.log(`${colors.blue}ℹ️  ${msg}${colors.reset}`),
  warning: (msg) => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
  test: (msg) => console.log(`${colors.cyan}🧪 ${msg}${colors.reset}`)
};

async function conectarDB() {
  try {
    await mongoose.connect(MONGODB_URI);
    log.success('Conectado a MongoDB');
  } catch (error) {
    log.error(`Error al conectar a MongoDB: ${error.message}`);
    process.exit(1);
  }
}

async function desconectarDB() {
  await mongoose.connection.close();
  log.info('Desconectado de MongoDB');
}

// ==================== TESTS ====================

async function test1_verificarModelos() {
  log.test('Test 1: Verificar que existen los modelos necesarios');
  
  try {
    const usuario = await Usuario.findOne({ rol: 'usuario', activo: true }).limit(1);
    const vehiculo = await Vehiculo.findOne().limit(1);
    const logUsuario = await LogUsuario.findOne().limit(1);
    
    if (!usuario) {
      log.warning('No se encontraron usuarios en la BD');
    } else {
      log.success(`Usuario encontrado: ${usuario.nombre} ${usuario.apellido} (DNI: ${usuario.dni})`);
    }
    
    if (!vehiculo) {
      log.warning('No se encontraron vehículos en la BD');
    } else {
      log.success(`Vehículo encontrado: ${vehiculo.dominio}`);
    }
    
    log.info(`Logs de usuario en BD: ${await LogUsuario.countDocuments()}`);
    
    return true;
  } catch (error) {
    log.error(`Error en test1: ${error.message}`);
    return false;
  }
}

async function test2_verificarCampos() {
  log.test('Test 2: Verificar campos del modelo Usuario');
  
  try {
    const schema = Usuario.schema.paths;
    
    const camposRequeridos = ['motivoDesactivacion', 'activo', 'fechaDesactivacion'];
    const camposFaltantes = camposRequeridos.filter(campo => !schema[campo]);
    
    if (camposFaltantes.length > 0) {
      log.error(`Campos faltantes en Usuario: ${camposFaltantes.join(', ')}`);
      return false;
    }
    
    log.success('Todos los campos necesarios existen en el modelo Usuario');
    
    // Verificar LogUsuario
    const schemaLog = LogUsuario.schema.paths;
    if (!schemaLog.motivo) {
      log.error('Campo "motivo" faltante en LogUsuario');
      return false;
    }
    
    log.success('Modelo LogUsuario tiene todos los campos necesarios');
    return true;
  } catch (error) {
    log.error(`Error en test2: ${error.message}`);
    return false;
  }
}

async function test3_contarUsuariosDesactivados() {
  log.test('Test 3: Contar usuarios desactivados');
  
  try {
    const total = await Usuario.countDocuments({ activo: false });
    log.info(`Usuarios desactivados: ${total}`);
    
    if (total > 0) {
      const usuarios = await Usuario.find({ activo: false })
        .select('nombre apellido dni fechaDesactivacion motivoDesactivacion')
        .limit(5);
      
      console.log('\nPrimeros 5 usuarios desactivados:');
      usuarios.forEach(u => {
        const dniMatch = u.dni.match(/^(\d+)_DESACTIVADO_/);
        const dniOriginal = dniMatch ? dniMatch[1] : u.dni;
        console.log(`  - ${u.nombre} ${u.apellido} (DNI: ${dniOriginal})`);
        console.log(`    Motivo: ${u.motivoDesactivacion || 'No especificado'}`);
        console.log(`    Fecha: ${u.fechaDesactivacion || 'No especificada'}`);
      });
    }
    
    return true;
  } catch (error) {
    log.error(`Error en test3: ${error.message}`);
    return false;
  }
}

async function test4_verificarVehiculosDesactivados() {
  log.test('Test 4: Verificar vehículos desactivados');
  
  try {
    const usuariosDesactivados = await Usuario.find({ activo: false }).limit(5);
    
    for (const usuario of usuariosDesactivados) {
      const vehiculos = await Vehiculo.find({ usuario: usuario._id });
      const vehiculosActivos = vehiculos.filter(v => v.activo === true);
      
      if (vehiculosActivos.length > 0) {
        log.error(`Usuario ${usuario.dni} tiene ${vehiculosActivos.length} vehículos aún activos!`);
        vehiculosActivos.forEach(v => {
          console.log(`  ⚠️  Vehículo activo: ${v.dominio}`);
        });
      } else {
        log.success(`Usuario ${usuario.dni}: Todos los vehículos desactivados (${vehiculos.length})`);
      }
    }
    
    return true;
  } catch (error) {
    log.error(`Error en test4: ${error.message}`);
    return false;
  }
}

async function test5_verificarLogs() {
  log.test('Test 5: Verificar logs de desactivación');
  
  try {
    const totalLogs = await LogUsuario.countDocuments();
    log.info(`Total de logs: ${totalLogs}`);
    
    const logsDesactivacion = await LogUsuario.countDocuments({ accion: 'desactivacion' });
    const logsReactivacion = await LogUsuario.countDocuments({ accion: 'reactivacion' });
    
    log.info(`Logs de desactivación: ${logsDesactivacion}`);
    log.info(`Logs de reactivación: ${logsReactivacion}`);
    
    if (totalLogs > 0) {
      const ultimoLog = await LogUsuario.findOne().sort({ fecha: -1 });
      console.log('\nÚltimo log registrado:');
      console.log(`  Usuario: ${ultimoLog.usuario.nombre} ${ultimoLog.usuario.apellido} (${ultimoLog.usuario.dni})`);
      console.log(`  Admin: ${ultimoLog.admin.nombre} ${ultimoLog.admin.apellido}`);
      console.log(`  Acción: ${ultimoLog.accion}`);
      console.log(`  Motivo: ${ultimoLog.motivo}`);
      console.log(`  Fecha: ${ultimoLog.fecha}`);
      
      if (ultimoLog.datosAdicionales) {
        console.log(`  Vehículos afectados: ${ultimoLog.datosAdicionales.vehiculosAfectados?.join(', ') || 'N/A'}`);
        console.log(`  Saldo: $${ultimoLog.datosAdicionales.saldoDisponible || 0}`);
        console.log(`  Email notificado: ${ultimoLog.datosAdicionales.emailNotificado || 'N/A'}`);
        console.log(`  IP: ${ultimoLog.datosAdicionales.ipOrigen || 'N/A'}`);
      }
    }
    
    return true;
  } catch (error) {
    log.error(`Error en test5: ${error.message}`);
    return false;
  }
}

async function test6_verificarLogsSinMotivo() {
  log.test('Test 6: Verificar que todos los logs tienen motivo');
  
  try {
    const logsSinMotivo = await LogUsuario.find({
      $or: [
        { motivo: null },
        { motivo: '' },
        { motivo: { $exists: false } }
      ]
    });
    
    if (logsSinMotivo.length > 0) {
      log.error(`Se encontraron ${logsSinMotivo.length} logs sin motivo!`);
      return false;
    }
    
    log.success('Todos los logs tienen motivo especificado');
    return true;
  } catch (error) {
    log.error(`Error en test6: ${error.message}`);
    return false;
  }
}

async function test7_verificarEstacionamientosActivos() {
  log.test('Test 7: Verificar que usuarios desactivados no tengan estacionamientos activos');
  
  try {
    const usuariosDesactivados = await Usuario.find({ activo: false });
    
    for (const usuario of usuariosDesactivados) {
      const vehiculos = await Vehiculo.find({ usuario: usuario._id });
      const dominios = vehiculos.map(v => v.dominio);
      
      const estacionamientoActivo = await Estacionamiento.findOne({
        $or: [
          { vehiculoDominio: { $in: dominios }, estado: 'activo' },
          { dominio: { $in: dominios }, estado: 'activo' },
          { vehiculoDominio: { $in: dominios }, estActivo: true },
          { dominio: { $in: dominios }, estActivo: true }
        ]
      });
      
      if (estacionamientoActivo) {
        log.error(`Usuario desactivado ${usuario.dni} tiene estacionamiento activo!`);
        console.log(`  Vehículo: ${estacionamientoActivo.vehiculoDominio || estacionamientoActivo.dominio}`);
        return false;
      }
    }
    
    log.success('Ningún usuario desactivado tiene estacionamientos activos');
    return true;
  } catch (error) {
    log.error(`Error en test7: ${error.message}`);
    return false;
  }
}

// ==================== EJECUCIÓN ====================

async function ejecutarTests() {
  console.log('\n' + '='.repeat(60));
  console.log('  TESTS - SISTEMA DE DESACTIVACIÓN/REACTIVACIÓN DE USUARIOS');
  console.log('='.repeat(60) + '\n');
  
  await conectarDB();
  
  const tests = [
    test1_verificarModelos,
    test2_verificarCampos,
    test3_contarUsuariosDesactivados,
    test4_verificarVehiculosDesactivados,
    test5_verificarLogs,
    test6_verificarLogsSinMotivo,
    test7_verificarEstacionamientosActivos
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    console.log('\n' + '-'.repeat(60));
    const result = await test();
    if (result) {
      passed++;
    } else {
      failed++;
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log(`  RESUMEN: ${passed} tests pasados, ${failed} tests fallidos`);
  console.log('='.repeat(60) + '\n');
  
  await desconectarDB();
  
  process.exit(failed > 0 ? 1 : 0);
}

// Ejecutar
ejecutarTests().catch(error => {
  log.error(`Error fatal: ${error.message}`);
  console.error(error);
  process.exit(1);
});
