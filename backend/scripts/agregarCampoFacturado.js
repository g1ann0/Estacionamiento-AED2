const mongoose = require('mongoose');
const Comprobante = require('../models/Comprobante');

const MONGODB_URI = 'mongodb://localhost/estacionamientoDB';

async function agregarCampoFacturadoATodos() {
  try {
    // Conectar a MongoDB
    console.log('🔌 Conectando a MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Conectado a MongoDB\n');

    // PASO 1: Contar comprobantes SIN el campo facturado
    console.log('📊 PASO 1: Analizando comprobantes...');
    const totalComprobantes = await Comprobante.countDocuments({});
    const sinCampoFacturado = await Comprobante.countDocuments({
      facturado: { $exists: false }
    });
    
    console.log(`   Total de comprobantes: ${totalComprobantes}`);
    console.log(`   Sin campo 'facturado': ${sinCampoFacturado}`);
    console.log(`   Con campo 'facturado': ${totalComprobantes - sinCampoFacturado}\n`);

    if (sinCampoFacturado === 0) {
      console.log('✅ Todos los comprobantes ya tienen el campo facturado');
      await mongoose.connection.close();
      return;
    }

    // PASO 2: Agregar campo facturado=false a todos los que no lo tienen
    console.log('📝 PASO 2: Agregando campo facturado a los registros...');
    
    const resultado = await Comprobante.updateMany(
      { facturado: { $exists: false } },
      { $set: { facturado: false } }
    );

    console.log(`   ✅ Documentos actualizados: ${resultado.modifiedCount}\n`);

    // PASO 3: Verificación final
    console.log('🔍 PASO 3: Verificación final...');
    
    const verificacion = await Comprobante.countDocuments({
      facturado: { $exists: false }
    });
    
    const conFacturado = await Comprobante.countDocuments({
      facturado: { $exists: true }
    });

    console.log(`   Comprobantes sin campo facturado: ${verificacion}`);
    console.log(`   Comprobantes con campo facturado: ${conFacturado}\n`);

    // Mostrar desglose por estado
    const desglose = await Comprobante.aggregate([
      {
        $group: {
          _id: {
            estado: '$estado',
            facturado: '$facturado'
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.estado': 1, '_id.facturado': 1 } }
    ]);

    console.log('📊 Desglose de comprobantes:');
    desglose.forEach(item => {
      const estado = item._id.estado || 'sin estado';
      const facturado = item._id.facturado === true ? 'facturado' : 'no facturado';
      console.log(`   ${estado} - ${facturado}: ${item.count}`);
    });

    if (verificacion === 0) {
      console.log('\n✅✅ MIGRACIÓN EXITOSA ✅✅');
      console.log('Todos los comprobantes ahora tienen el campo facturado');
    } else {
      console.log('\n⚠️ ADVERTENCIA: Algunos comprobantes aún no tienen el campo');
    }

    // Cerrar conexión
    await mongoose.connection.close();
    console.log('\n🔌 Conexión cerrada');

  } catch (error) {
    console.error('❌ Error en la migración:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

// Ejecutar
agregarCampoFacturadoATodos();
