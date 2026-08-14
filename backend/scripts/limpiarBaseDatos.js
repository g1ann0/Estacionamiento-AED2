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
const AuditLog = require('../models/AuditLog');
const Caja = require('../models/Caja');
const Turno = require('../models/Turno');
const MovimientoCaja = require('../models/MovimientoCaja');
const ComprobanteEstadia = require('../models/ComprobanteEstadia');
const Talonario = require('../models/Talonario');
const Sucursal = require('../models/Sucursal');

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
      { modelo: AuditLog, nombre: 'Auditoría' },
      // Faltaban acá: el script decía "elimina TODOS los datos" pero dejaba en pie las
      // colecciones de caja, turno y comprobantes de estadía, así que una base "limpia"
      // arrancaba con turnos abiertos y numeración de talonario a mitad de camino.
      { modelo: Sucursal, nombre: 'Sucursales' },
      { modelo: Caja, nombre: 'Cajas' },
      { modelo: Turno, nombre: 'Turnos' },
      { modelo: MovimientoCaja, nombre: 'Movimientos de Caja' },
      { modelo: ComprobanteEstadia, nombre: 'Comprobantes de Estadía' },
      { modelo: Talonario, nombre: 'Talonarios' }
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
// La "confirmación" imprimía una advertencia y devolvía `true` igual: no confirmaba nada.
// Correr el script era borrar la base entera, sin escala. Ahora hay que decirlo explícito.
const CONFIRMACION = '--si-borrar-todo';

function confirmarLimpieza() {
  console.log('⚠️  ADVERTENCIA: este script elimina TODOS los datos de la base:');
  console.log('   usuarios, estadías, transacciones, vehículos, comprobantes, facturas,');
  console.log('   turnos, movimientos de caja, configuración y auditoría.\n');

  if (process.env.NODE_ENV === 'production') {
    console.log('❌ NODE_ENV=production. Este script no corre contra producción, y punto.');
    return false;
  }

  if (!process.argv.includes(CONFIRMACION)) {
    console.log(`❌ Falta la confirmación. Si es lo que querés:\n`);
    console.log(`   node scripts/limpiarBaseDatos.js ${CONFIRMACION}\n`);
    console.log(`   Base apuntada: ${process.env.MONGODB_URI ?? '(sin MONGODB_URI)'}`);
    return false;
  }

  console.log(`🗑️  Confirmado. Limpiando ${process.env.MONGODB_URI}\n`);
  console.log('💡 Después: levantar el servidor una vez — siembra sola la configuración por defecto.\n');
  return true;
}

// Solo cuando se lo invoca a mano. Nunca al importarlo: `scripts/clean.js` llamaba a esta
// función en el cuerpo del módulo, así que con solo importar ese archivo —por ejemplo
// desde una herramienta que recorre archivos para ver si cargan— borraba la base sin preguntar
// nada. Ese script ya no existe, y este comentario está para que no vuelva.
if (require.main === module) {
  if (!confirmarLimpieza()) {
    process.exit(1);
  }
  limpiarBaseDatos();
}

module.exports = limpiarBaseDatos;
