const mongoose = require('mongoose');
require('dotenv').config();

// Importar el modelo para registrar el schema
const Usuario = require('../models/Usuario');

async function migrarUsuarios() {
  try {
    // Conectar a la base de datos
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado a MongoDB');

    // Actualizar todos los usuarios existentes para que tengan activo: true
    const resultado = await Usuario.updateMany(
      { 
        $or: [
          { activo: { $exists: false } }, 
          { activo: null }
        ]
      },
      { 
        $set: { 
          activo: true 
        }
      }
    );

    console.log(`✅ Migración completada:`);
    console.log(`   - Usuarios actualizados: ${resultado.modifiedCount}`);
    console.log(`   - Usuarios ya tenían el campo: ${resultado.matchedCount - resultado.modifiedCount}`);

    // Verificar el resultado
    const totalUsuarios = await Usuario.countDocuments();
    const usuariosActivos = await Usuario.countDocuments({ activo: true });
    
    console.log(`✅ Verificación:`);
    console.log(`   - Total de usuarios: ${totalUsuarios}`);
    console.log(`   - Usuarios activos: ${usuariosActivos}`);

    if (usuariosActivos === totalUsuarios) {
      console.log('🎉 Todos los usuarios ahora tienen el campo activo configurado');
    } else {
      console.log('⚠️  Algunos usuarios no tienen el campo activo configurado');
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
  migrarUsuarios();
}

module.exports = migrarUsuarios;
