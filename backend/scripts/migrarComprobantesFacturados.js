/**
 * SCRIPT DE MIGRACIÓN - Comprobantes Facturados
 * 
 * Convierte comprobantes con estado='facturado' a:
 * - estado='aprobado'
 * - facturado=true
 */

const mongoose = require('mongoose');
const Comprobante = require('../models/Comprobante');

const migrarComprobantesFacturados = async () => {
  try {
    console.log('\n🔄 Iniciando migración de comprobantes facturados...\n');

    // Conectar a MongoDB
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost/estacionamientoDB';
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Conectado a MongoDB (estacionamientoDB)\n');

    // PASO 1: SELECT - Buscar comprobantes con estado='facturado'
    console.log('🔍 PASO 1: SELECT - Buscando comprobantes con estado="facturado"...\n');
    const comprobantesFacturados = await Comprobante.find({ estado: 'facturado' });
    
    console.log(`📊 Comprobantes encontrados: ${comprobantesFacturados.length}\n`);

    if (comprobantesFacturados.length === 0) {
      console.log('✅ No hay comprobantes para migrar.\n');
      
      // Mostrar estadísticas generales
      const total = await Comprobante.countDocuments();
      const pendientes = await Comprobante.countDocuments({ estado: 'pendiente' });
      const aprobados = await Comprobante.countDocuments({ estado: 'aprobado' });
      const rechazados = await Comprobante.countDocuments({ estado: 'rechazado' });
      const facturados = await Comprobante.countDocuments({ facturado: true });
      
      console.log('📊 Estadísticas actuales:');
      console.log(`   Total: ${total}`);
      console.log(`   Pendientes: ${pendientes}`);
      console.log(`   Aprobados: ${aprobados} (${facturados} ya facturados)`);
      console.log(`   Rechazados: ${rechazados}\n`);
      
      process.exit(0);
    }

    // Mostrar datos completos de comprobantes a migrar
    console.log('📋 DATOS COMPLETOS a migrar:');
    console.log('═'.repeat(80));
    comprobantesFacturados.forEach((c, index) => {
      console.log(`\n${index + 1}. Comprobante: ${c.nroComprobante}`);
      console.log(`   Usuario: ${c.usuario.nombre} ${c.usuario.apellido} (DNI: ${c.usuario.dni})`);
      console.log(`   Monto: $${c.montoAcreditado}`);
      console.log(`   Estado actual: "${c.estado}"`);
      console.log(`   Campo facturado: ${c.facturado || false}`);
      console.log(`   Fecha: ${c.fecha}`);
      if (c.facturaGenerada?.nroFactura) {
        console.log(`   Factura: ${c.facturaGenerada.nroFactura} (CAE: ${c.facturaGenerada.cae})`);
      }
    });
    console.log('\n' + '═'.repeat(80) + '\n');

    // PASO 2: UPDATE - Actualizar todos los comprobantes
    console.log('🔄 PASO 2: Actualizando comprobantes...\n');
    
    const resultado = await Comprobante.updateMany(
      { estado: 'facturado' },
      { 
        $set: { 
          estado: 'aprobado',
          facturado: true
        }
      }
    );

    console.log('✅ UPDATE completado:');
    console.log(`   - Documentos encontrados: ${resultado.matchedCount}`);
    console.log(`   - Documentos actualizados: ${resultado.modifiedCount}`);
    console.log('');

    // PASO 3: VERIFICACIÓN - Comprobar que la migración fue exitosa
    console.log('🔍 PASO 3: Verificando cambios...\n');
    
    const verificacion = await Comprobante.find({ facturado: true });
    console.log(`✅ Comprobantes con facturado=true: ${verificacion.length}`);
    
    const ahoraFacturados = await Comprobante.find({ estado: 'facturado' });
    console.log(`✅ Comprobantes con estado='facturado': ${ahoraFacturados.length} (debería ser 0)`);
    console.log('');

    // Mostrar datos actualizados
    if (verificacion.length > 0) {
      console.log('📋 DATOS ACTUALIZADOS (primeros 3):');
      console.log('═'.repeat(80));
      verificacion.slice(0, 3).forEach((c, index) => {
        console.log(`\n${index + 1}. Comprobante: ${c.nroComprobante}`);
        console.log(`   Usuario: ${c.usuario.nombre} ${c.usuario.apellido}`);
        console.log(`   Estado nuevo: ${c.estado}`);
        console.log(`   Facturado: ${c.facturado}`);
      });
      console.log('\n' + '═'.repeat(80) + '\n');
    }

    if (ahoraFacturados.length === 0 && resultado.modifiedCount > 0) {
      console.log('✅✅ MIGRACIÓN EXITOSA - Todos los datos actualizados correctamente\n');
    } else if (resultado.modifiedCount === 0) {
      console.log('ℹ️ No se modificaron documentos (ya estaban actualizados)\n');
    } else {
      console.log('⚠️ ADVERTENCIA - Aún quedan comprobantes con estado=facturado\n');
    }

  } catch (error) {
    console.error('❌ Error durante la migración:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Conexión cerrada');
    process.exit(0);
  }
};

// Ejecutar migración
migrarComprobantesFacturados();
