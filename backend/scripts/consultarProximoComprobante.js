/**
 * Consulta el próximo comprobante esperado por AFIP
 * Método: FECompUltimoAutorizado
 */

const afipConfig = require('../config/afip');

async function consultarProximoComprobante() {
  try {
    console.log('🔧 Inicializando AFIP...');
    const afip = afipConfig.getInstance();
    
    console.log('✅ AFIP SDK inicializado correctamente');
    console.log(`   Modo: ${afipConfig.config.production ? 'PRODUCCIÓN' : 'HOMOLOGACIÓN (TESTING)'}`);
    console.log(`   CUIT: ${afipConfig.config.CUIT}`);
    
    const puntoVenta = 1;
    const tipoComprobante = 6; // Factura B
    
    console.log(`\n🔍 Consultando último comprobante autorizado...`);
    console.log(`   Punto de Venta: ${puntoVenta}`);
    console.log(`   Tipo Comprobante: ${tipoComprobante} (Factura B)`);
    
    const ultimoComprobante = await afip.ElectronicBilling.getLastVoucher(puntoVenta, tipoComprobante);
    
    console.log(`\n📊 Último comprobante autorizado: ${ultimoComprobante}`);
    console.log(`📋 Próximo número a usar: ${ultimoComprobante + 1}`);
    
    // Obtener fecha del servidor AFIP
    console.log(`\n🕐 Consultando fecha/hora del servidor AFIP...`);
    try {
      const serverStatus = await afip.ElectronicBilling.getServerStatus();
      console.log('✅ Estado del servidor AFIP:');
      console.log(JSON.stringify(serverStatus, null, 2));
    } catch (error) {
      console.error('⚠️  No se pudo obtener estado del servidor:', error.message);
    }
    
    // Fecha local
    const fechaLocal = new Date();
    console.log(`\n📅 Fecha local del sistema: ${fechaLocal.toISOString()}`);
    console.log(`   Fecha AFIP format: ${fechaLocal.toISOString().split('T')[0].replace(/-/g, '')}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
    if (error.response) {
      console.error('Respuesta:', error.response);
    }
  }
}

consultarProximoComprobante();
