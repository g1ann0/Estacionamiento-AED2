const mongoose = require('mongoose');
const Usuario = require('../models/Usuario');
const ConfiguracionPrecio = require('../models/ConfiguracionPrecio');
require('dotenv').config();

// Script de migración para asignar tarifas a usuarios existentes
const migrarUsuariosATarifas = async () => {
  try {
    console.log('🚀 Iniciando migración de usuarios a sistema de tarifas...');
    
    // Conectar a la base de datos
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/estacionamiento');
    console.log('✅ Conectado a MongoDB');

    // 1. Obtener todas las tarifas disponibles
    const tarifas = await ConfiguracionPrecio.find({ activo: true });
    console.log(`📋 Encontradas ${tarifas.length} tarifas disponibles:`);
    tarifas.forEach(tarifa => {
      console.log(`   - ${tarifa.tipoUsuario}: $${tarifa.precioPorHora}/hora`);
    });

    if (tarifas.length === 0) {
      console.log('⚠️ No hay tarifas configuradas. Creando tarifas por defecto...');
      await crearTarifasPorDefecto();
      return migrarUsuariosATarifas(); // Reintentar después de crear tarifas
    }

    // 2. Buscar tarifas específicas para asociados y no asociados
    const tarifaAsociado = tarifas.find(t => 
      t.tipoUsuario.toLowerCase().includes('asociado') || 
      t.tipoUsuario.toLowerCase().includes('socio')
    );
    
    const tarifaNoAsociado = tarifas.find(t => 
      t.tipoUsuario.toLowerCase().includes('general') || 
      t.tipoUsuario.toLowerCase().includes('publico') ||
      t.tipoUsuario.toLowerCase().includes('normal')
    );

    // Si no hay tarifas específicas, usar las primeras disponibles
    const tarifaPorDefectoAsociado = tarifaAsociado || tarifas[0];
    const tarifaPorDefectoNoAsociado = tarifaNoAsociado || tarifas[tarifas.length > 1 ? 1 : 0];

    console.log(`🎯 Tarifa para asociados: ${tarifaPorDefectoAsociado.tipoUsuario}`);
    console.log(`🎯 Tarifa para no asociados: ${tarifaPorDefectoNoAsociado.tipoUsuario}`);

    // 3. Obtener todos los usuarios que no tienen tarifa asignada
    const usuariosSinTarifa = await Usuario.find({ 
      tarifaAsignada: { $exists: false } 
    });

    const usuariosConTarifaNula = await Usuario.find({ 
      tarifaAsignada: null 
    });

    const usuariosAMigrar = [...usuariosSinTarifa, ...usuariosConTarifaNula];
    console.log(`👥 Encontrados ${usuariosAMigrar.length} usuarios para migrar`);

    if (usuariosAMigrar.length === 0) {
      console.log('✅ Todos los usuarios ya tienen tarifas asignadas');
      return;
    }

    // 4. Migrar usuarios
    let usuariosMigrados = 0;
    let errores = 0;

    for (const usuario of usuariosAMigrar) {
      try {
        // Asignar tarifa basada en si es asociado o no
        const tarifaAAsignar = usuario.asociado ? 
          tarifaPorDefectoAsociado._id : 
          tarifaPorDefectoNoAsociado._id;

        await Usuario.findByIdAndUpdate(
          usuario._id,
          { tarifaAsignada: tarifaAAsignar },
          { returnDocument: 'after' }
        );

        console.log(`✅ Usuario ${usuario.nombre} ${usuario.apellido} (${usuario.dni}) - Tarifa: ${usuario.asociado ? 'Asociado' : 'No Asociado'}`);
        usuariosMigrados++;

      } catch (error) {
        console.error(`❌ Error migrando usuario ${usuario.dni}:`, error.message);
        errores++;
      }
    }

    // 5. Mostrar resumen
    console.log('\n📊 RESUMEN DE MIGRACIÓN:');
    console.log(`✅ Usuarios migrados exitosamente: ${usuariosMigrados}`);
    console.log(`❌ Errores encontrados: ${errores}`);
    console.log(`📋 Total procesados: ${usuariosAMigrar.length}`);

    // 6. Verificar migración
    await verificarMigracion();

  } catch (error) {
    console.error('❌ Error durante la migración:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Conexión a MongoDB cerrada');
  }
};

// Función para crear tarifas por defecto si no existen
const crearTarifasPorDefecto = async () => {
  console.log('🏗️ Creando tarifas por defecto...');
  
  const tarifasPorDefecto = [
    {
      tipoUsuario: 'Asociado',
      precioPorHora: 50,
      descripcion: 'Tarifa especial para usuarios asociados',
      actualizadoPor: 'Sistema - Migración',
      activo: true
    },
    {
      tipoUsuario: 'Público General',
      precioPorHora: 80,
      descripcion: 'Tarifa estándar para usuarios no asociados',
      actualizadoPor: 'Sistema - Migración',
      activo: true
    }
  ];

  for (const tarifa of tarifasPorDefecto) {
    try {
      const tarifaExistente = await ConfiguracionPrecio.findOne({ 
        tipoUsuario: tarifa.tipoUsuario 
      });
      
      if (!tarifaExistente) {
        await ConfiguracionPrecio.create(tarifa);
        console.log(`✅ Tarifa creada: ${tarifa.tipoUsuario} - $${tarifa.precioPorHora}/hora`);
      } else {
        console.log(`ℹ️ Tarifa ya existe: ${tarifa.tipoUsuario}`);
      }
    } catch (error) {
      console.error(`❌ Error creando tarifa ${tarifa.tipoUsuario}:`, error.message);
    }
  }
};

// Función para verificar que la migración fue exitosa
const verificarMigracion = async () => {
  console.log('\n🔍 Verificando migración...');
  
  const usuariosSinTarifa = await Usuario.countDocuments({ 
    $or: [
      { tarifaAsignada: { $exists: false } },
      { tarifaAsignada: null }
    ]
  });

  const usuariosConTarifa = await Usuario.countDocuments({ 
    tarifaAsignada: { $exists: true, $ne: null }
  });

  console.log(`📊 Usuarios con tarifa asignada: ${usuariosConTarifa}`);
  console.log(`⚠️ Usuarios sin tarifa: ${usuariosSinTarifa}`);

  if (usuariosSinTarifa === 0) {
    console.log('🎉 ¡Migración completada exitosamente! Todos los usuarios tienen tarifas asignadas.');
  } else {
    console.log('⚠️ Algunos usuarios aún no tienen tarifas asignadas. Revisar logs de errores.');
  }
};

// Función para rollback (opcional)
const rollbackMigracion = async () => {
  console.log('🔄 Iniciando rollback de migración...');
  
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/estacionamiento');
    
    const resultado = await Usuario.updateMany(
      {},
      { $unset: { tarifaAsignada: 1 } }
    );
    
    console.log(`✅ Rollback completado. ${resultado.modifiedCount} usuarios actualizados.`);
  } catch (error) {
    console.error('❌ Error durante rollback:', error);
  } finally {
    await mongoose.connection.close();
  }
};

// Ejecutar script según argumento
const argumento = process.argv[2];

if (argumento === 'rollback') {
  rollbackMigracion();
} else {
  migrarUsuariosATarifas();
}

module.exports = {
  migrarUsuariosATarifas,
  rollbackMigracion,
  crearTarifasPorDefecto
};
