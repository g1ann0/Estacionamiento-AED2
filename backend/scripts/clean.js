/**
 * Script rápido para limpiar la base de datos
 * 
 * Uso:
 * node scripts/clean.js
 */

const limpiarBaseDatos = require('./limpiarBaseDatos');

console.log('🗑️  Iniciando limpieza rápida de la base de datos...\n');

limpiarBaseDatos()
  .then(() => {
    console.log('\n✅ Limpieza completada exitosamente');
    console.log('💡 Para inicializar el sistema nuevamente, ejecuta:');
    console.log('   node scripts/setupSystem.js init');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Error durante la limpieza:', error);
    process.exit(1);
  });
