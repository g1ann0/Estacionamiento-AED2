// Script para configurar certificado AFIP automáticamente
const fs = require('fs');
const path = require('path');

console.log('🔧 CONFIGURACIÓN AUTOMÁTICA DE CERTIFICADO AFIP\n');

// Buscar archivo .crt en la carpeta
const certsDir = __dirname;
const files = fs.readdirSync(certsDir);
const crtFile = files.find(f => f.endsWith('.crt') || f.endsWith('.cer'));

if (!crtFile) {
  console.error('❌ Error: No se encontró ningún archivo .crt o .cer');
  console.log('\n📋 Instrucciones:');
  console.log('1. Descarga el certificado de AFIP');
  console.log('2. Cópialo a la carpeta: backend/certs/');
  console.log('3. Vuelve a ejecutar este script\n');
  process.exit(1);
}

console.log(`✅ Certificado encontrado: ${crtFile}\n`);

// Leer el certificado
const crtPath = path.join(certsDir, crtFile);
const certContent = fs.readFileSync(crtPath, 'utf8');

// Verificar que sea un certificado válido
if (!certContent.includes('BEGIN CERTIFICATE') && !certContent.includes('BEGIN RSA')) {
  console.error('❌ El archivo no parece ser un certificado válido');
  process.exit(1);
}

// Guardar como .pem
const pemPath = path.join(certsDir, 'afip_cert.pem');
fs.writeFileSync(pemPath, certContent);
console.log(`✅ Certificado convertido a PEM: afip_cert.pem`);

// Verificar que existe la clave privada
const keyPath = path.join(certsDir, 'afip_private_key.key');
if (!fs.existsSync(keyPath)) {
  console.error('❌ Error: No se encontró afip_private_key.key');
  process.exit(1);
}
console.log('✅ Clave privada encontrada: afip_private_key.key');

// Actualizar .env
const envPath = path.join(certsDir, '../../.env');
let envContent = fs.readFileSync(envPath, 'utf8');

// Verificar si ya tiene configuración AFIP
if (!envContent.includes('AFIP_CUIT')) {
  // Agregar configuración AFIP
  envContent += `\n
# ========================================
# CONFIGURACIÓN AFIP/ARCA
# ========================================

# CUIT de la empresa (obligatorio)
AFIP_CUIT=20442422924

# Modo de operación: false = Homologación/Testing, true = Producción
AFIP_PRODUCTION=false

# Certificados
AFIP_CERT_PATH=./certs/afip_cert.pem
AFIP_KEY_PATH=./certs/afip_private_key.key
`;
  fs.writeFileSync(envPath, envContent);
  console.log('✅ Archivo .env actualizado con configuración AFIP');
} else {
  console.log('✅ Archivo .env ya tiene configuración AFIP');
  
  // Asegurarse de que las rutas estén descomentadas
  envContent = envContent.replace(/# AFIP_CERT_PATH=/g, 'AFIP_CERT_PATH=');
  envContent = envContent.replace(/# AFIP_KEY_PATH=/g, 'AFIP_KEY_PATH=');
  
  // Actualizar las rutas si es necesario
  if (!envContent.includes('AFIP_CERT_PATH=./certs/afip_cert.pem')) {
    envContent = envContent.replace(/AFIP_CERT_PATH=.*/g, 'AFIP_CERT_PATH=./certs/afip_cert.pem');
  }
  if (!envContent.includes('AFIP_KEY_PATH=./certs/afip_private_key.key')) {
    envContent = envContent.replace(/AFIP_KEY_PATH=.*/g, 'AFIP_KEY_PATH=./certs/afip_private_key.key');
  }
  
  fs.writeFileSync(envPath, envContent);
  console.log('✅ Rutas de certificados actualizadas en .env');
}

console.log('\n📋 RESUMEN DE ARCHIVOS:\n');
console.log('📁 backend/certs/');
console.log('  ├── afip_cert.pem          ✅ Certificado AFIP');
console.log('  ├── afip_private_key.key   ✅ Clave privada');
console.log('  └── ' + crtFile + '         ℹ️  Certificado original\n');

console.log('📁 backend/');
console.log('  └── .env                    ✅ Configurado\n');

console.log('🎯 SIGUIENTE PASO:\n');
console.log('1. Reinicia el servidor backend:');
console.log('   cd backend');
console.log('   npm start\n');
console.log('2. Verifica en la consola que aparezca:');
console.log('   ✅ AFIP SDK inicializado correctamente');
console.log('   Modo: HOMOLOGACIÓN');
console.log('   CUIT: 20442422924');
console.log('   Certificado: Configurado ✓\n');
console.log('3. Abre el facturador en el navegador:');
console.log('   http://localhost:3001/admin/facturador\n');
console.log('✅ ¡Todo listo para facturar! 🚀\n');
