/**
 * Script para actualizar usuarios existentes con campos fiscales
 * 
 * Este script agrega los campos cuit y condicionIVA a usuarios existentes
 * que no los tengan, estableciendo valores por defecto.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Usuario = require('../models/Usuario');

const actualizarUsuarios = async () => {
  try {
    console.log('Conectando a la base de datos...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✓ Conectado a MongoDB');

    // Buscar usuarios que no tengan condicionIVA definida
    const usuarios = await Usuario.find({
      $or: [
        { condicionIVA: { $exists: false } },
        { condicionIVA: null }
      ]
    });

    console.log(`\nEncontrados ${usuarios.length} usuarios para actualizar`);

    if (usuarios.length === 0) {
      console.log('No hay usuarios para actualizar');
      await mongoose.connection.close();
      return;
    }

    let actualizados = 0;

    for (const usuario of usuarios) {
      // Establecer condición IVA por defecto como Consumidor Final
      if (!usuario.condicionIVA) {
        usuario.condicionIVA = 'Consumidor Final';
      }

      // cuit se deja en null por defecto (usuarios normales no tienen CUIT)
      if (!usuario.cuit) {
        usuario.cuit = null;
      }

      await usuario.save();
      actualizados++;
      
      console.log(`✓ Usuario ${usuario.dni} - ${usuario.nombre} ${usuario.apellido} actualizado`);
      console.log(`  - Condición IVA: ${usuario.condicionIVA}`);
      console.log(`  - CUIT: ${usuario.cuit || 'No tiene'}`);
    }

    console.log(`\n✓ Total de usuarios actualizados: ${actualizados}`);
    console.log('\nNotas importantes:');
    console.log('- Todos los usuarios fueron configurados como "Consumidor Final" por defecto');
    console.log('- Si algún cliente es Responsable Inscripto o Monotributista, debe actualizarse manualmente');
    console.log('- Los clientes con CUIT deben tener su número de CUIT cargado para emitir Factura A');

    await mongoose.connection.close();
    console.log('\n✓ Conexión cerrada');
    process.exit(0);

  } catch (error) {
    console.error('Error al actualizar usuarios:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
};

actualizarUsuarios();
