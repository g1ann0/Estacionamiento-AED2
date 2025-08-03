const mongoose = require('mongoose');
require('dotenv').config();

// Importar todos los modelos para asegurar que estén registrados
const Usuario = require('../models/Usuario');
const Transaccion = require('../models/Transaccion');
const Vehiculo = require('../models/Vehiculo');
const Comprobante = require('../models/Comprobante');
const Factura = require('../models/Factura');
const ConfiguracionEmpresa = require('../models/ConfiguracionEmpresa');
const ConfiguracionPrecio = require('../models/ConfiguracionPrecio');
const Estacionamiento = require('../models/Estacionamiento');
const LogPrecio = require('../models/LogPrecio');
const LogSaldo = require('../models/LogSaldo');
const LogVehiculo = require('../models/LogVehiculo');
const LogConfiguracionEmpresa = require('../models/LogConfiguracionEmpresa');

async function limpiarBaseDatos() {
  try {
    // Conectar a la base de datos
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado a MongoDB');

    console.log('\n⚠️  ATENCIÓN: Este script eliminará TODOS los datos de la base de datos');
    console.log('🗑️  Procediendo con la limpieza...\n');

    // Lista de todas las colecciones a limpiar
    const colecciones = [
      { modelo: Usuario, nombre: 'Usuarios' },
      { modelo: Transaccion, nombre: 'Transacciones' },
      { modelo: Vehiculo, nombre: 'Vehículos' },
      { modelo: Comprobante, nombre: 'Comprobantes' },
      { modelo: Factura, nombre: 'Facturas' },
      { modelo: ConfiguracionEmpresa, nombre: 'Configuración de Empresa' },
      { modelo: ConfiguracionPrecio, nombre: 'Configuración de Precios' },
      { modelo: Estacionamiento, nombre: 'Estacionamientos' },
      { modelo: LogPrecio, nombre: 'Logs de Precios' },
      { modelo: LogSaldo, nombre: 'Logs de Saldos' },
      { modelo: LogVehiculo, nombre: 'Logs de Vehículos' },
      { modelo: LogConfiguracionEmpresa, nombre: 'Logs de Configuración de Empresa' }
    ];

    let totalEliminados = 0;
    const resultados = [];

    // Eliminar datos de cada colección
    for (const { modelo, nombre } of colecciones) {
      try {
        const count = await modelo.countDocuments();
        if (count > 0) {
          const resultado = await modelo.deleteMany({});
          console.log(`🗑️  ${nombre}: ${resultado.deletedCount} documentos eliminados`);
          totalEliminados += resultado.deletedCount;
          resultados.push({ nombre, eliminados: resultado.deletedCount });
        } else {
          console.log(`📭 ${nombre}: Ya estaba vacía`);
          resultados.push({ nombre, eliminados: 0 });
        }
      } catch (error) {
        console.error(`❌ Error eliminando ${nombre}:`, error.message);
        resultados.push({ nombre, error: error.message });
      }
    }

    // Intentar eliminar colecciones adicionales que puedan existir
    try {
      const db = mongoose.connection.db;
      const collections = await db.listCollections().toArray();
      
      for (const collection of collections) {
        const collectionName = collection.name;
        
        // Verificar si la colección no está en nuestra lista de modelos conocidos
        const conocida = colecciones.some(c => 
          c.modelo.collection.name === collectionName
        );
        
        if (!conocida && !collectionName.startsWith('system.')) {
          try {
            const count = await db.collection(collectionName).countDocuments();
            if (count > 0) {
              await db.collection(collectionName).deleteMany({});
              console.log(`🗑️  ${collectionName} (colección adicional): ${count} documentos eliminados`);
              totalEliminados += count;
            }
          } catch (error) {
            console.error(`❌ Error eliminando colección adicional ${collectionName}:`, error.message);
          }
        }
      }
    } catch (error) {
      console.error('❌ Error al verificar colecciones adicionales:', error.message);
    }

    // Resumen final
    console.log('\n✅ Limpieza completada:');
    console.log(`   - Total de documentos eliminados: ${totalEliminados}`);
    
    if (totalEliminados === 0) {
      console.log('🎉 La base de datos ya estaba limpia');
    } else {
      console.log('🎉 Base de datos completamente limpia');
    }

    // Mostrar resumen detallado
    console.log('\n📊 Detalle por colección:');
    for (const resultado of resultados) {
      if (resultado.error) {
        console.log(`   ❌ ${resultado.nombre}: Error - ${resultado.error}`);
      } else {
        console.log(`   ✅ ${resultado.nombre}: ${resultado.eliminados} eliminados`);
      }
    }

    // Verificación final
    console.log('\n🔍 Verificación final:');
    let documentosRestantes = 0;
    for (const { modelo, nombre } of colecciones) {
      try {
        const count = await modelo.countDocuments();
        documentosRestantes += count;
        if (count > 0) {
          console.log(`   ⚠️  ${nombre}: ${count} documentos restantes`);
        }
      } catch (error) {
        console.error(`   ❌ Error verificando ${nombre}:`, error.message);
      }
    }

    if (documentosRestantes === 0) {
      console.log('   🎉 Verificación exitosa: No quedan documentos en la base de datos');
    } else {
      console.log(`   ⚠️  Quedan ${documentosRestantes} documentos en total`);
    }

  } catch (error) {
    console.error('❌ Error durante la limpieza:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Conexión cerrada');
  }
}

// Función para confirmar la acción (solo en modo interactivo)
async function confirmarLimpieza() {
  console.log('⚠️  ADVERTENCIA: Este script eliminará TODOS los datos de la base de datos');
  console.log('📋 Esto incluye:');
  console.log('   - Todos los usuarios');
  console.log('   - Todas las transacciones');
  console.log('   - Todos los vehículos');
  console.log('   - Todos los comprobantes y facturas');
  console.log('   - Toda la configuración');
  console.log('   - Todos los logs');
  console.log('');
  console.log('💡 Después de la limpieza, deberás ejecutar:');
  console.log('   node scripts/setupSystem.js init');
  console.log('');
  
  // Si se ejecuta directamente, proceder automáticamente
  return true;
}

// Ejecutar la limpieza
if (require.main === module) {
  confirmarLimpieza().then(confirmado => {
    if (confirmado) {
      limpiarBaseDatos();
    } else {
      console.log('❌ Operación cancelada');
      process.exit(0);
    }
  });
}

module.exports = limpiarBaseDatos;
