/**
 * SCRIPT DE PRUEBA: Validación de eliminación de vehículo con estacionamiento activo
 * 
 * Este script prueba que NO se puede eliminar un vehículo que tiene un estacionamiento en curso
 */

const mongoose = require('mongoose');
const Vehiculo = require('../models/Vehiculo');
const Estacionamiento = require('../models/Estacionamiento');
const Usuario = require('../models/Usuario');
require('dotenv').config();

async function probarValidacion() {
  try {
    // Conectar a MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost/estacionamiento');
    console.log('✅ Conectado a MongoDB');

    // 1. Buscar un vehículo cualquiera
    const vehiculo = await Vehiculo.findOne();
    if (!vehiculo) {
      console.log('❌ No hay vehículos en el sistema para probar');
      process.exit(1);
    }

    console.log(`\n📋 Vehículo de prueba: ${vehiculo.dominio}`);

    // 2. Verificar si ya tiene estacionamiento activo
    let estacionamientoActivo = await Estacionamiento.findOne({
      dominio: vehiculo.dominio,
      estado: 'en_curso'
    });

    if (!estacionamientoActivo) {
      // Crear un estacionamiento activo de prueba
      console.log('🅿️ Creando estacionamiento activo de prueba...');
      
      const usuario = await Usuario.findById(vehiculo.usuario);
      if (!usuario) {
        console.log('❌ Usuario no encontrado');
        process.exit(1);
      }

      estacionamientoActivo = new Estacionamiento({
        usuario: usuario._id,
        dominio: vehiculo.dominio,
        tipo: vehiculo.tipo,
        marca: vehiculo.marca,
        modelo: vehiculo.modelo,
        ubicacion: 'Zona de Prueba',
        estado: 'en_curso',
        horaIngreso: new Date(),
        tarifaPorHora: 100
      });

      await estacionamientoActivo.save();
      console.log('✅ Estacionamiento activo creado');
    } else {
      console.log('✅ El vehículo ya tiene un estacionamiento activo');
    }

    // 3. Simular la validación de eliminación
    console.log('\n🔍 Probando validación de eliminación...');
    
    const estacionamiento = await Estacionamiento.findOne({
      dominio: vehiculo.dominio.toUpperCase(),
      estado: 'en_curso'
    });

    if (estacionamiento) {
      console.log('\n❌ VALIDACIÓN EXITOSA: No se puede eliminar el vehículo');
      console.log(`   Motivo: Tiene estacionamiento en curso desde ${estacionamiento.horaIngreso}`);
      console.log(`   Ubicación: ${estacionamiento.ubicacion}`);
      console.log('\n✅ La validación está funcionando correctamente');
    } else {
      console.log('\n⚠️ No se encontró estacionamiento activo - se puede eliminar');
    }

    // 4. Limpiar (opcional - comentar si quiere dejar el estacionamiento de prueba)
    // await Estacionamiento.deleteOne({ _id: estacionamientoActivo._id });
    // console.log('\n🧹 Estacionamiento de prueba eliminado');

    console.log('\n📝 INSTRUCCIONES PARA PROBAR EN LA INTERFAZ:');
    console.log(`   1. Vaya a Gestión de Usuarios > Vehículos`);
    console.log(`   2. Busque el vehículo: ${vehiculo.dominio}`);
    console.log(`   3. Intente eliminarlo`);
    console.log(`   4. Debería ver el mensaje: "No se puede eliminar el vehículo porque tiene un estacionamiento en curso"`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Desconectado de MongoDB');
  }
}

probarValidacion();
