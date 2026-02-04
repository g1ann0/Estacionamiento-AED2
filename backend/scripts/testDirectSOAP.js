/**
 * Script para probar estructura SOAP directa con AFIP
 */

const afipConfig = require('../config/afip');

async function testDirectSOAP() {
  try {
    console.log('🔧 Inicializando AFIP...');
    const afip = afipConfig.getInstance();
    
    const fecha = new Date();
    const fechaAFIP = fecha.toISOString().split('T')[0].replace(/-/g, '');
    
    console.log('\n📤 Probando con estructura SOAP completa...');
    
    // Estructura según documentación oficial WSFE
    const params = {
      'FeCAEReq': {
        'FeCabReq': {
          'CantReg': 1,
          'PtoVta': 1,
          'CbteTipo': 6
        },
        'FeDetReq': {
          'FECAEDetRequest': {
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
            'FchServDesde': parseInt(fechaAFIP),
            'FchServHasta': parseInt(fechaAFIP),
            'FchVtoPago': parseInt(fechaAFIP),
            // CLAVE: Condición IVA receptor como campo separado
            'ImpCondIVA': 5
          }
        }
      }
    };
    
    console.log('Estructura completa:');
    console.log(JSON.stringify(params, null, 2));
    
    const result = await afip.ElectronicBilling.executeRequest('FECAESolicitar', params);
    console.log('\n✅ Factura generada exitosamente!');
    console.log(JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.response) {
      console.log('Respuesta completa:', JSON.stringify(error.response, null, 2));
    }
  }
}

testDirectSOAP();
