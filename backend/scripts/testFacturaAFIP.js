/**
 * Script para probar generación de factura directamente con AFIP
 * Permite depurar el error 10246 de condición IVA
 */

const afipConfig = require('../config/afip');

async function testFactura() {
  try {
    console.log('🔧 Inicializando AFIP...');
    const afip = afipConfig.getInstance();
    
    // Primero consultar condiciones IVA válidas
    console.log('\n📋 Consultando condiciones IVA válidas en AFIP...');
    const condicionesIVA = await afip.ElectronicBilling.executeRequest('FEParamGetCondicionIvaReceptor', {});
    console.log('Condiciones IVA disponibles:');
    console.log(JSON.stringify(condicionesIVA.ResultGet?.CondIva || condicionesIVA, null, 2));
    
    // Obtener último número de comprobante
    console.log('\n📊 Obteniendo último número de factura...');
    const ultimoNumero = await afip.ElectronicBilling.getLastVoucher(1, 6);
    console.log(`Último número: ${ultimoNumero}`);
    const numeroComprobante = ultimoNumero + 1;
    
    // Preparar fecha actual
    const fecha = new Date();
    const fechaAFIP = fecha.toISOString().split('T')[0].replace(/-/g, '');
    
    console.log('\n📤 Intentando generar factura B con diferentes estructuras...');
    
    // PRUEBA 1: Sin campo Compradores
    console.log('\n--- PRUEBA 1: Sin Compradores ---');
    try {
      const datos1 = {
        'CantReg': 1,
        'PtoVta': 1,
        'CbteTipo': 6, // Factura B
        'Concepto': 2, // Servicios
        'DocTipo': 96, // DNI
        'DocNro': 45452121,
        'CbteDesde': numeroComprobante,
        'CbteHasta': numeroComprobante,
        'CbteFch': fechaAFIP,
        'ImpTotal': 1000.00,
        'ImpTotConc': 0,
        'ImpNeto': 1000.00,
        'ImpOpEx': 0,
        'ImpIVA': 0.00,
        'ImpTrib': 0,
        'MonId': 'PES',
        'MonCotiz': 1,
        'FchServDesde': fechaAFIP,
        'FchServHasta': fechaAFIP,
        'FchVtoPago': fechaAFIP
      };
      
      const result1 = await afip.ElectronicBilling.createVoucher(datos1, true);
      console.log('✅ PRUEBA 1 exitosa!');
      console.log(JSON.stringify(result1, null, 2));
    } catch (err) {
      console.log('❌ PRUEBA 1 falló:', err.message);
    }
    
    // PRUEBA 2: Con Compradores sin CondIVA
    console.log('\n--- PRUEBA 2: Compradores sin CondIVA ---');
    try {
      const datos2 = {
        'CantReg': 1,
        'PtoVta': 1,
        'CbteTipo': 6,
        'Concepto': 2,
        'DocTipo': 96,
        'DocNro': 45452121,
        'CbteDesde': numeroComprobante,
        'CbteHasta': numeroComprobante,
        'CbteFch': fechaAFIP,
        'ImpTotal': 1000.00,
        'ImpTotConc': 0,
        'ImpNeto': 1000.00,
        'ImpOpEx': 0,
        'ImpIVA': 0.00,
        'ImpTrib': 0,
        'MonId': 'PES',
        'MonCotiz': 1,
        'Compradores': [{
          'DocTipo': 96,
          'DocNro': 45452121,
          'Porcentaje': 100,
          'ImpMonNeto': 1000.00
        }],
        'FchServDesde': fechaAFIP,
        'FchServHasta': fechaAFIP,
        'FchVtoPago': fechaAFIP
      };
      
      const result2 = await afip.ElectronicBilling.createVoucher(datos2, true);
      console.log('✅ PRUEBA 2 exitosa!');
      console.log(JSON.stringify(result2, null, 2));
    } catch (err) {
      console.log('❌ PRUEBA 2 falló:', err.message);
    }
    
    // PRUEBA 3: Con Compradores con CondIVA
    console.log('\n--- PRUEBA 3: Compradores con CondIVA ---');
    try {
      const datos3 = {
        'CantReg': 1,
        'PtoVta': 1,
        'CbteTipo': 6,
        'Concepto': 2,
        'DocTipo': 96,
        'DocNro': 45452121,
        'CbteDesde': numeroComprobante,
        'CbteHasta': numeroComprobante,
        'CbteFch': fechaAFIP,
        'ImpTotal': 1000.00,
        'ImpTotConc': 0,
        'ImpNeto': 1000.00,
        'ImpOpEx': 0,
        'ImpIVA': 0.00,
        'ImpTrib': 0,
        'MonId': 'PES',
        'MonCotiz': 1,
        'Compradores': [{
          'DocTipo': 96,
          'DocNro': 45452121,
          'Porcentaje': 100,
          'ImpMonNeto': 1000.00,
          'CondIVA': 5
        }],
        'FchServDesde': fechaAFIP,
        'FchServHasta': fechaAFIP,
        'FchVtoPago': fechaAFIP
      };
      
      const result3 = await afip.ElectronicBilling.createVoucher(datos3, true);
      console.log('✅ PRUEBA 3 exitosa!');
      console.log(JSON.stringify(result3, null, 2));
    } catch (err) {
      console.log('❌ PRUEBA 3 falló:', err.message);
    }

    // PRUEBA 4: Con campo ImpCondIVA en nivel principal
    console.log('\n--- PRUEBA 4: ImpCondIVA en nivel principal ---');
    try {
      const datos4 = {
        'CantReg': 1,
        'PtoVta': 1,
        'CbteTipo': 6,
        'Concepto': 2,
        'DocTipo': 96,
        'DocNro': 45452121,
        'CbteDesde': numeroComprobante,
        'CbteHasta': numeroComprobante,
        'CbteFch': fechaAFIP,
        'ImpTotal': 1000.00,
        'ImpTotConc': 0,
        'ImpNeto': 1000.00,
        'ImpOpEx': 0,
        'ImpIVA': 0.00,
        'ImpTrib': 0,
        'MonId': 'PES',
        'MonCotiz': 1,
        'ImpCondIVA': 5,
        'FchServDesde': fechaAFIP,
        'FchServHasta': fechaAFIP,
        'FchVtoPago': fechaAFIP
      };
      
      const result4 = await afip.ElectronicBilling.createVoucher(datos4, true);
      console.log('✅ PRUEBA 4 exitosa!');
      console.log(JSON.stringify(result4, null, 2));
    } catch (err) {
      console.log('❌ PRUEBA 4 falló:', err.message);
    }

    console.log('\n✅ Pruebas completadas');
    
  } catch (error) {
    console.error('❌ Error general:', error.message);
    console.error(error);
  }
}

testFactura();
