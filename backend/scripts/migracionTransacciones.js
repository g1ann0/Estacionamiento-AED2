const mongoose = require('mongoose');
require('dotenv').config();

// Importar los modelos para registrar los schemas
const Usuario = require('../models/Usuario');
const Transaccion = require('../models/Transaccion');

async function migrarTransacciones() {
  try {
    // Conectar a la base de datos
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado a MongoDB');

    // 1. Obtener todas las transacciones
    const transacciones = await Transaccion.find({});
    console.log(`📊 Total de transacciones encontradas: ${transacciones.length}`);

    let transaccionesActualizadas = 0;
    let transaccionesHuerfanas = 0;
    let errores = 0;

    for (const transaccion of transacciones) {
      try {
        // Buscar el usuario por DNI en propietario
        const usuario = await Usuario.findOne({ 
          dni: transaccion.propietario?.dni,
          activo: true 
        });

        if (usuario) {
          // Si el usuario existe y está activo, actualizar la referencia
          if (!transaccion.usuario) {
            transaccion.usuario = usuario._id;
            await transaccion.save();
            transaccionesActualizadas++;
          }
        } else {
          // Si el usuario no existe o está inactivo, marcar como huérfana
          console.log(`⚠️  Transacción huérfana encontrada: ID ${transaccion._id}, DNI: ${transaccion.propietario?.dni}`);
          transaccionesHuerfanas++;
        }
      } catch (error) {
        console.error(`❌ Error procesando transacción ${transaccion._id}:`, error.message);
        errores++;
      }
    }

    // 2. Eliminar transacciones huérfanas (opcional - comentar si quieres conservarlas)
    if (transaccionesHuerfanas > 0) {
      console.log('\n🗑️  Eliminando transacciones huérfanas...');
      
      const transaccionesParaEliminar = await Transaccion.find({}).populate('usuario');
      const idsParaEliminar = [];
      
      for (const t of transaccionesParaEliminar) {
        if (!t.usuario || t.usuario.activo === false) {
          idsParaEliminar.push(t._id);
        }
      }
      
      if (idsParaEliminar.length > 0) {
        await Transaccion.deleteMany({ _id: { $in: idsParaEliminar } });
        console.log(`🗑️  Eliminadas ${idsParaEliminar.length} transacciones huérfanas`);
      }
    }

    // 3. Resumen final
    console.log('\n✅ Migración de transacciones completada:');
    console.log(`   - Transacciones actualizadas: ${transaccionesActualizadas}`);
    console.log(`   - Transacciones huérfanas encontradas: ${transaccionesHuerfanas}`);
    console.log(`   - Errores: ${errores}`);

    // 4. Verificación final
    const transaccionesFinales = await Transaccion.countDocuments();
    const transaccionesConUsuario = await Transaccion.countDocuments({ usuario: { $exists: true, $ne: null } });
    
    console.log('\n🔍 Verificación final:');
    console.log(`   - Total de transacciones: ${transaccionesFinales}`);
    console.log(`   - Transacciones con usuario asignado: ${transaccionesConUsuario}`);

    if (transaccionesFinales === transaccionesConUsuario) {
      console.log('🎉 Todas las transacciones tienen usuario asignado');
    } else {
      console.log('⚠️  Algunas transacciones no tienen usuario asignado');
    }

  } catch (error) {
    console.error('❌ Error durante la migración:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Conexión cerrada');
  }
}

// Ejecutar la migración
if (require.main === module) {
  migrarTransacciones();
}

module.exports = migrarTransacciones;
