// Script para generar clave privada RSA sin necesidad de OpenSSL
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

console.log('🔑 Generando clave privada RSA de 2048 bits...\n');

// Generar par de claves
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: {
    type: 'spki',
    format: 'pem'
  },
  privateKeyEncoding: {
    type: 'pkcs1',
    format: 'pem'
  }
});

// Guardar clave privada
const privateKeyPath = path.join(__dirname, 'afip_private_key.key');
fs.writeFileSync(privateKeyPath, privateKey);

console.log('✅ Clave privada generada exitosamente!');
console.log('📁 Ubicación:', privateKeyPath);
console.log('\n📋 Contenido (primeras líneas):');
console.log(privateKey.split('\n').slice(0, 3).join('\n'));
console.log('...');
console.log('\n🔒 IMPORTANTE: Guarda esta clave en lugar seguro y NUNCA la compartas.\n');

// Opcional: Guardar clave pública también
const publicKeyPath = path.join(__dirname, 'afip_public_key.pub');
fs.writeFileSync(publicKeyPath, publicKey);
console.log('📄 También se generó la clave pública en:', publicKeyPath);
