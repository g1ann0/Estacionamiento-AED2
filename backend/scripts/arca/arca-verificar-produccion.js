// Verificación del ambiente de PRODUCCIÓN de ARCA — sin emitir un solo comprobante.
//
// Existe por una razón concreta: en producción, pedir un CAE **emite una factura fiscal de
// verdad**, a nombre del CUIT configurado, que no se borra —se anula con nota de crédito— y que
// impacta en el IVA o en el monotributo de esa persona. Así que la instalación en un cliente no
// se puede "probar" como en homologación.
//
// Lo que sí se puede hacer, y es lo que hace este script, es recorrer todo el circuito hasta un
// paso antes del CAE:
//
//   1. Autenticarse contra el WSAA de producción (certificado + clave + CUIT correctos).
//   2. Preguntarle al WSFE el último número autorizado del punto de venta.
//   3. Leer el último comprobante emitido, si existe.
//
// Si los tres pasan, lo único que falta comprobar es la emisión — y esa se hace una sola vez,
// con la primera factura real del negocio, no con una de prueba.
//
// Uso:
//   ARCA_AMBIENTE=produccion ARCA_MOCK=false node scripts/arca-verificar-produccion.js [puntoVenta]

require('dotenv').config();
const { leerConfig } = require('../../services/arca/config');
const { obtenerTicket } = require('../../services/arca/wsaa');
const { ultimoNumeroAutorizado, consultarComprobante } = require('../../services/arca/wsfe');
const catalogos = require('../../services/arca/catalogos');
const mongoose = require('mongoose');

// Este script NO llama a solicitarCAE. Está escrito así a propósito y conviene que siga así:
// es la diferencia entre verificar una instalación y facturarle algo a alguien sin querer.

(async () => {
  const config = leerConfig();

  console.log('Verificación de producción — solo lectura, no emite comprobantes\n');
  console.log(`  ambiente   : ${config.ambiente}`);
  console.log(`  CUIT       : ${config.cuit || '(sin configurar)'}`);
  console.log(`  certificado: ${config.certificadoPath}`);
  console.log(`  WSFE       : ${config.urls.wsfe}\n`);

  if (config.usarMock) {
    console.log('❌ ARCA_MOCK=true. Esto consulta ARCA de verdad: apagalo para usarlo.');
    process.exit(1);
  }
  if (config.ambiente !== 'produccion') {
    console.log(`⚠️  ARCA_AMBIENTE=${config.ambiente}. Este script es para verificar PRODUCCIÓN.`);
    console.log('    Para homologación alcanza con verify-etapa6.js, que sí puede emitir sin consecuencias.\n');
  }

  // 1 · WSAA
  process.stdout.write('1) Autenticación WSAA … ');
  let ticket;
  try {
    ticket = await obtenerTicket();
    console.log(`✅ (vence ${ticket.expiracion ? ticket.expiracion.toLocaleString('es-AR') : 'sin fecha'})`);
  } catch (error) {
    console.log('❌');
    console.log(`\n   ${error.message}\n`);
    console.log('   Ver docs/analisis-gap-cgas/10 — la tabla de errores traduce los habituales.');
    process.exit(1);
  }

  // 2 · Punto de venta y tipo de comprobante. Salen de la configuración de la empresa, que es
  // la que después usa el sistema para facturar: probar con otros valores no probaría nada.
  let puntoVenta = Number(process.argv[2]);
  let tipoComprobante;
  let condicion = null;
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const ConfiguracionEmpresa = require('../../models/ConfiguracionEmpresa');
    const empresa = await ConfiguracionEmpresa.obtenerConfiguracionActiva();
    condicion = empresa?.condicionIva ?? null;
    if (!puntoVenta) puntoVenta = Number(empresa?.puntoVenta ?? 1);
    tipoComprobante = catalogos.tipoComprobantePara(condicion);
    await mongoose.disconnect();
  } catch (error) {
    await mongoose.disconnect().catch(() => {});
    puntoVenta = puntoVenta || 1;
    tipoComprobante = 6;
    console.log(`\n⚠️  No se pudo leer la configuración de empresa (${error.message}).`);
    console.log(`    Se asume punto de venta ${puntoVenta} y factura B.\n`);
  }

  const nombreTipo = tipoComprobante === 11 ? 'factura C' : tipoComprobante === 6 ? 'factura B' : `tipo ${tipoComprobante}`;
  console.log(`\n   Condición de IVA configurada: ${condicion ?? '(sin configurar)'} → emite ${nombreTipo}`);
  console.log(`   Punto de venta: ${puntoVenta}\n`);

  // 3 · El punto de venta tiene que estar habilitado para Web Services. Si no lo está, ARCA no
  // dice "falta el punto de venta": devuelve un error que no lo menciona, y se pierde la tarde.
  process.stdout.write(`2) Último número autorizado en PV ${puntoVenta} … `);
  let ultimo;
  try {
    ultimo = await ultimoNumeroAutorizado(puntoVenta, tipoComprobante);
    console.log(`✅ ${ultimo}`);
    if (ultimo === 0) {
      console.log('   (0 = el punto de venta responde y todavía no emitió ninguna de este tipo)');
    }
  } catch (error) {
    console.log('❌');
    console.log(`\n   ${error.message}\n`);
    console.log('   Lo más probable: el punto de venta no está dado de alta para');
    console.log('   "Factura Electrónica - Web Services", o está dado de alta para otro sistema.');
    process.exit(1);
  }

  // 4 · Lectura del último comprobante, si hay alguno.
  if (ultimo > 0) {
    process.stdout.write(`3) Lectura del comprobante N° ${ultimo} … `);
    try {
      const comprobante = await consultarComprobante(puntoVenta, tipoComprobante, ultimo);
      console.log(comprobante ? `✅ CAE ${comprobante.cae}, $${comprobante.importeTotal}` : '⚠️ no devolvió datos');
    } catch (error) {
      console.log(`❌ ${error.message}`);
      process.exit(1);
    }
  } else {
    console.log('3) Lectura de comprobante … se saltea: todavía no hay ninguno emitido');
  }

  console.log('\n✅ La instalación puede autenticarse y leer contra ARCA producción.');
  console.log('\nLo único que queda sin probar es la emisión, y eso es a propósito: en producción');
  console.log('cada CAE es una factura fiscal real. La primera se emite con una venta de verdad.');
  process.exit(0);
})().catch(async (error) => {
  await mongoose.disconnect().catch(() => {});
  console.error('\nError inesperado:', error.message);
  process.exit(1);
});
