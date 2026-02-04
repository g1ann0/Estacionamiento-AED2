/**
 * Prueba final basada en RG 5616/2024
 * El campo correcto es: CondicionIVAReceptorId
 */

const afipConfig = require('../config/afip');

async function testCondicionIVAReceptorId() {
  try {
    console.log('🔧 Inicializando AFIP...');
    const afip = afipConfig.getInstance();
    
    const fecha = new Date();
    const fechaAFIP = fecha.toISOString().split('T')[0].replace(/-/g, '');
    
    console.log('\n📤 Probando con CondicionIVAReceptorId usando createVoucher...');
    
    const datos = {
      'CantReg': 1,
      'PtoVta': 1,
      'CbteTipo': 6,
      'Concepto': 2,
      'DocTipo': 96,
      'DocNro': 45452121,
      'CbteDesde': 1,
      'CbteHasta': 1,
      'CbteFch': parseInt(fechaAFIP),
      'ImpTotal': 1000.00,
      'ImpTotConc': 0,
      'ImpNeto': 1000.00,
      'ImpOpEx': 0,
      'ImpIVA': 0.00,
      'ImpTrib': 0,
      'MonId': 'PES',
      'MonCotiz': 1,
      'Iva': [
        {
          'Id': 3, // 0% - para Factura B
          'BaseImp': 1000.00,
          'Importe': 0.00
        }
      ],
      'FchServDesde': parseInt(fechaAFIP),
      'FchServHasta': parseInt(fechaAFIP),
      'FchVtoPago': parseInt(fechaAFIP),
      'CondicionIVAReceptorId': 5 // Consumidor Final
    };
    
    console.log('Datos:');
    console.log(JSON.stringify(datos, null, 2));
    
    const result = await afip.ElectronicBilling.createVoucher(datos, true);
    console.log('\n✅ FACTURA GENERADA EXITOSAMENTE!');
    console.log(JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
  }
}

testCondicionIVAReceptorId();
