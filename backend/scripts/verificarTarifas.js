const mongoose = require('mongoose');
const Usuario = require('../models/Usuario');
const ConfiguracionPrecio = require('../models/ConfiguracionPrecio');
require('dotenv').config();

const verificarSistemaTarifas = async () => {
  try {
    console.log('🔍 Verificando sistema de tarifas...');
    
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/estacionamiento');
    console.log('✅ Conectado a MongoDB');

    // 1. Verificar tarifas disponibles
    const tarifas = await ConfiguracionPrecio.find({ activo: true });
    console.log(`\n📋 Tarifas disponibles (${tarifas.length}):`);
    tarifas.forEach(tarifa => {
      console.log(`   • ${tarifa.tipoUsuario}: $${tarifa.precioPorHora}/hora ${tarifa.descripcion ? `(${tarifa.descripcion})` : ''}`);
    });

    // 2. Verificar usuarios y sus tarifas asignadas
    const usuarios = await Usuario.find({ activo: true })
      .populate('tarifaAsignada', 'tipoUsuario precioPorHora descripcion');
    
    console.log(`\n👥 Usuarios activos (${usuarios.length}):`);
    usuarios.forEach(usuario => {
      const tarifaInfo = usuario.tarifaAsignada 
        ? `${usuario.tarifaAsignada.tipoUsuario} ($${usuario.tarifaAsignada.precioPorHora}/hora)`
        : 'Sin tarifa específica';
      
      console.log(`   • ${usuario.nombre} ${usuario.apellido} (${usuario.dni}) - ${usuario.asociado ? 'Asociado' : 'No Asociado'} - Tarifa: ${tarifaInfo}`);
    });

    // 3. Verificar distribución de tarifas
    const usuariosConTarifa = usuarios.filter(u => u.tarifaAsignada);
    const usuariosSinTarifa = usuarios.filter(u => !u.tarifaAsignada);
    
    console.log(`\n📊 Distribución:`);
    console.log(`   ✅ Usuarios con tarifa específica: ${usuariosConTarifa.length}`);
    console.log(`   ⚠️ Usuarios sin tarifa específica: ${usuariosSinTarifa.length}`);

    // 4. Mostrar resumen por tipo
    const usuariosAsociados = usuarios.filter(u => u.asociado);
    const usuariosNoAsociados = usuarios.filter(u => !u.asociado);
    
    console.log(`\n👥 Por tipo de usuario:`);
    console.log(`   🏛️ Asociados: ${usuariosAsociados.length}`);
    console.log(`   🏢 No Asociados: ${usuariosNoAsociados.length}`);

    console.log('\n✅ Verificación completada');

  } catch (error) {
    console.error('❌ Error durante la verificación:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Conexión cerrada');
  }
};

verificarSistemaTarifas();
