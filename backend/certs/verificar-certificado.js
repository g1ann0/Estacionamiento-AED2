// Verificar tipo de certificado AFIP
const fs = require('fs');
const path = require('path');

console.log('🔍 VERIFICANDO TIPO DE CERTIFICADO AFIP\n');

const certPath = path.join(__dirname, 'afip_cert.pem');

if (!fs.existsSync(certPath)) {
  console.error('❌ No se encontró afip_cert.pem');
  process.exit(1);
}

const certContent = fs.readFileSync(certPath, 'utf8');

console.log('📄 Contenido del certificado:\n');
console.log(certContent);
console.log('\n' + '='.repeat(60) + '\n');

// Buscar indicadores
const esHomologacion = certContent.toLowerCase().includes('homo') || 
                       certContent.toLowerCase().includes('test') ||
                       certContent.toLowerCase().includes('dev');

const esProduccion = certContent.toLowerCase().includes('prod') ||
                     certContent.toLowerCase().includes('afip.gob.ar');

console.log('📊 ANÁLISIS:\n');

if (esHomologacion) {
  console.log('🧪 TIPO: HOMOLOGACIÓN (TESTING)');
  console.log('   ├─ Ambiente de pruebas');
  console.log('   ├─ CAEs generados NO son válidos legalmente');
  console.log('   └─ Ideal para testing del sistema\n');
} else if (esProduccion) {
  console.log('🏭 TIPO: PRODUCCIÓN');
  console.log('   ├─ Ambiente REAL');
  console.log('   ├─ CAEs generados SON válidos legalmente');
  console.log('   └─ Para facturación oficial\n');
} else {
  console.log('❓ NO SE PUDO DETERMINAR AUTOMÁTICAMENTE\n');
}

console.log('📋 CÓMO VERIFICAR MANUALMENTE:\n');
console.log('1. ¿Dónde lo generaste?');
console.log('   • Homologación: wswhomo.afip.gov.ar');
console.log('   • Producción: auth.afip.gob.ar\n');

console.log('2. Probar contra el servicio AFIP:');
console.log('   • Si funciona con AFIP_PRODUCTION=false → Homologación');
console.log('   • Si funciona con AFIP_PRODUCTION=true → Producción\n');

console.log('3. Revisar el nombre del archivo original:');
const files = fs.readdirSync(__dirname);
const crtFile = files.find(f => f.endsWith('.crt') || f.endsWith('.cer'));
if (crtFile) {
  console.log(`   • Archivo descargado: ${crtFile}`);
  if (crtFile.toLowerCase().includes('homo') || crtFile.toLowerCase().includes('test')) {
    console.log('   • 🧪 Indica HOMOLOGACIÓN');
  } else {
    console.log('   • 🏭 Probablemente PRODUCCIÓN');
  }
}

console.log('\n' + '='.repeat(60));
console.log('\n💡 TIP: Si lo generaste en AFIP normal (no en un portal');
console.log('   especial de testing), es PRODUCCIÓN.\n');
console.log('⚠️  Para homologación, AFIP tiene un portal separado');
console.log('   específico para testing: wswhomo.afip.gov.ar\n');
