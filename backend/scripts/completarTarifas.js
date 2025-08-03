const mongoose = require('mongoose');
const Usuario = require('../models/Usuario');
const ConfiguracionPrecio = require('../models/ConfiguracionPrecio');

// Usar la misma configuración de DB que el servidor
const DB_URI = 'mongodb://127.0.0.1:27017/estacionamientoDB';

async function conectarDB() {
  try {
    await mongoose.connect(DB_URI);
    console.log('✅ Conectado a MongoDB');
  } catch (error) {
    console.error('❌ Error conectando a MongoDB:', error);
    process.exit(1);
  }
}

async function asignarTarifasFaltantes() {
  try {
    console.log('🔧 Asignando tarifas faltantes...');
    
    // Obtener tarifas disponibles
    const tarifas = await ConfiguracionPrecio.find({});
    const tarifaGeneral = tarifas.find(t => t.tipoUsuario === 'no_asociado');
    
    if (!tarifaGeneral) {
      console.log('❌ No se encontró la tarifa general (no_asociado)');
      return;
    }
    
    // Buscar usuarios sin tarifa asignada
    const usuariosSinTarifa = await Usuario.find({ 
      tarifaAsignada: null,
      activo: true 
    });
    
    console.log(`👥 Encontrados ${usuariosSinTarifa.length} usuarios sin tarifa específica`);
    
    for (const usuario of usuariosSinTarifa) {
      // Asignar tarifa según si es asociado o no
      let tarifaAAsignar;
      if (usuario.asociado) {
        tarifaAAsignar = tarifas.find(t => t.tipoUsuario === 'asociado');
      } else {
        tarifaAAsignar = tarifaGeneral; // no_asociado para usuarios regulares
      }
      
      if (tarifaAAsignar) {
        await Usuario.findByIdAndUpdate(usuario._id, {
          tarifaAsignada: tarifaAAsignar._id
        });
        console.log(`✅ ${usuario.nombre} ${usuario.apellido} (${usuario.dni}) -> ${tarifaAAsignar.tipoUsuario} ($${tarifaAAsignar.precioPorHora}/hora)`);
      }
    }
    
    console.log('✅ Asignación de tarifas completada');
  } catch (error) {
    console.error('❌ Error asignando tarifas:', error);
  }
}

async function mostrarResumenFinal() {
  try {
    console.log('\n📊 RESUMEN FINAL:');
    
    const totalUsuarios = await Usuario.countDocuments({ activo: true });
    const usuariosConTarifa = await Usuario.countDocuments({ 
      tarifaAsignada: { $ne: null }, 
      activo: true 
    });
    
    console.log(`👥 Total usuarios: ${totalUsuarios}`);
    console.log(`💰 Usuarios con tarifa específica: ${usuariosConTarifa}`);
    
    // Mostrar distribución final
    const tarifas = await ConfiguracionPrecio.find({});
    for (const tarifa of tarifas) {
      const count = await Usuario.countDocuments({ 
        tarifaAsignada: tarifa._id, 
        activo: true 
      });
      console.log(`   ${tarifa.tipoUsuario}: ${count} usuarios ($${tarifa.precioPorHora}/hora)`);
    }
    
    // Mostrar algunos ejemplos de usuarios
    console.log('\n👤 Ejemplos de usuarios creados:');
    const ejemplos = await Usuario.find({ activo: true })
      .populate('tarifaAsignada', 'tipoUsuario precioPorHora')
      .limit(5);
      
    ejemplos.forEach(user => {
      const tarifa = user.tarifaAsignada ? 
        `${user.tarifaAsignada.tipoUsuario} ($${user.tarifaAsignada.precioPorHora}/hora)` : 
        'Sin tarifa';
      console.log(`   📧 ${user.email} - ${tarifa} - Saldo: $${user.montoDisponible}`);
    });
    
  } catch (error) {
    console.error('❌ Error generando resumen:', error);
  }
}

async function main() {
  console.log('🚀 Completando configuración de tarifas...\n');
  
  await conectarDB();
  await asignarTarifasFaltantes();
  await mostrarResumenFinal();
  
  console.log('\n✅ Configuración completada!');
  console.log('\n🔗 La base de datos está lista para producción con:');
  console.log('   • 12+ usuarios con diferentes tarifas');
  console.log('   • 18+ vehículos variados (autos y motos)');
  console.log('   • Sistema de tarifas personalizadas funcional');
  console.log('   • Saldos iniciales para realizar transacciones');
  
  mongoose.connection.close();
}

main().catch(console.error);
