/**
 * Script para gestionar datos iniciales del sistema
 * 
 * Uso:
 * node scripts/setupSystem.js init    - Inicializar datos por defecto
 * node scripts/setupSystem.js reset   - Resetear sistema completo
 * node scripts/setupSystem.js demo    - Crear datos de demostración
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { 
  inicializarDatosPorDefecto, 
  resetearSistema,
  crearUsuarioPrueba 
} = require('../utils/seedData');
const migrarUsuarios = require('./migracionUsuariosActivos');
const migrarTransacciones = require('./migracionTransacciones');
const limpiarBaseDatos = require('./limpiarBaseDatos');

// Conectar a MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/estacionamiento_db', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Conectado a MongoDB');
  } catch (error) {
    console.error('❌ Error conectando a MongoDB:', error);
    process.exit(1);
  }
};

// Función principal
const main = async () => {
  await connectDB();
  
  const command = process.argv[2];
  
  switch (command) {
    case 'init':
      console.log('🚀 Inicializando datos por defecto...');
      await migrarUsuarios(); // Asegurar que usuarios existentes tengan campo activo
      await inicializarDatosPorDefecto();
      break;
      
    case 'reset':
      console.log('⚠️  Reseteando sistema completo...');
      await resetearSistema();
      break;
      
    case 'demo':
      console.log('🎭 Creando datos de demostración...');
      await migrarUsuarios(); // Asegurar que usuarios existentes tengan campo activo
      await inicializarDatosPorDefecto();
      await crearUsuarioPrueba();
      break;

    case 'migrate':
      console.log('🔄 Ejecutando migración de usuarios...');
      await migrarUsuarios();
      console.log('🔄 Ejecutando migración de transacciones...');
      await migrarTransacciones();
      break;

    case 'migrate-users':
      console.log('🔄 Ejecutando migración de usuarios...');
      await migrarUsuarios();
      break;

    case 'migrate-transactions':
      console.log('🔄 Ejecutando migración de transacciones...');
      await migrarTransacciones();
      break;

    case 'clean':
      console.log('🗑️  Limpiando base de datos...');
      await limpiarBaseDatos();
      break;

    case 'clean-init':
      console.log('🗑️  Limpiando base de datos...');
      await limpiarBaseDatos();
      console.log('🚀 Inicializando datos por defecto...');
      await inicializarDatosPorDefecto();
      break;
      
    default:
      console.log(`
📋 Comandos disponibles:

  node scripts/setupSystem.js init    - Inicializar datos por defecto
  node scripts/setupSystem.js reset   - Resetear sistema completo  
  node scripts/setupSystem.js demo    - Crear datos de demostración
  node scripts/setupSystem.js migrate - Migrar usuarios y transacciones para soporte activo/inactivo
  node scripts/setupSystem.js migrate-users - Migrar solo usuarios
  node scripts/setupSystem.js migrate-transactions - Migrar solo transacciones
  node scripts/setupSystem.js clean - Limpiar completamente la base de datos
  node scripts/setupSystem.js clean-init - Limpiar base de datos e inicializar

🔍 Estado actual:
  - Ejecutar 'init' si es la primera vez que usas el sistema
  - Ejecutar 'demo' para agregar usuarios de prueba
  - Ejecutar 'migrate' para actualizar usuarios y transacciones existentes
  - Ejecutar 'clean' para limpiar completamente la base de datos
  - Ejecutar 'clean-init' para limpiar e inicializar desde cero
  - Ejecutar 'reset' solo en desarrollo para limpiar todo
      `);
  }
  
  await mongoose.connection.close();
  console.log('👋 Desconectado de MongoDB');
  process.exit(0);
};

// Ejecutar
main().catch(error => {
  console.error('❌ Error ejecutando script:', error);
  process.exit(1);
});
