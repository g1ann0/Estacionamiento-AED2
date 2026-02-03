// Script para generar CSR (Certificate Signing Request) para AFIP
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function pregunta(texto) {
  return new Promise((resolve) => {
    rl.question(texto, (respuesta) => {
      resolve(respuesta);
    });
  });
}

async function generarCSR() {
  console.log('🔐 GENERAR CSR PARA AFIP/ARCA\n');
  console.log('Por favor ingresa los datos de tu empresa:\n');

  const pais = await pregunta('País (Country) [AR]: ') || 'AR';
  const provincia = await pregunta('Provincia (State) [Buenos Aires]: ') || 'Buenos Aires';
  const ciudad = await pregunta('Ciudad (Locality) [CABA]: ') || 'CABA';
  const organizacion = await pregunta('Razón Social (Organization) [ESTACIONAMIENTO SEGURO SA]: ') || 'ESTACIONAMIENTO SEGURO SA';
  const unidad = await pregunta('Departamento (Unit) [Sistemas]: ') || 'Sistemas';
  const cuit = await pregunta('⚠️  CUIT (Common Name) - SIN GUIONES [20409378472]: ') || '20409378472';
  const email = await pregunta('Email [admin@estacionamiento.com]: ') || 'admin@estacionamiento.com';

  rl.close();

  console.log('\n📝 Generando CSR...\n');

  // Leer clave privada
  const privateKeyPath = path.join(__dirname, 'afip_private_key.key');
  if (!fs.existsSync(privateKeyPath)) {
    console.error('❌ Error: No se encontró afip_private_key.key');
    console.error('Primero ejecuta: node generar-clave.js');
    process.exit(1);
  }

  const privateKey = fs.readFileSync(privateKeyPath, 'utf8');

  // Crear CSR
  const csrOptions = {
    key: privateKey,
    subject: {
      C: pais,
      ST: provincia,
      L: ciudad,
      O: organizacion,
      OU: unidad,
      CN: cuit,
      emailAddress: email
    }
  };

  // Generar CSR usando crypto
  const { publicKey } = crypto.generateKeyPairSync('rsa', {
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

  // Crear subject string
  const subject = `/C=${pais}/ST=${provincia}/L=${ciudad}/O=${organizacion}/OU=${unidad}/CN=${cuit}/emailAddress=${email}`;
  
  // Generar CSR manualmente
  const { spawnSync } = require('child_process');
  
  // Intentar con openssl si está disponible en WSL
  const csrPath = path.join(__dirname, 'afip.csr');
  
  // Crear archivo de configuración temporal para el CSR
  const configContent = `
[req]
distinguished_name = req_distinguished_name
prompt = no

[req_distinguished_name]
C = ${pais}
ST = ${provincia}
L = ${ciudad}
O = ${organizacion}
OU = ${unidad}
CN = ${cuit}
emailAddress = ${email}
`;

  const configPath = path.join(__dirname, 'openssl.cnf');
  fs.writeFileSync(configPath, configContent);

  console.log('✅ Datos recopilados:');
  console.log(`   País: ${pais}`);
  console.log(`   Provincia: ${provincia}`);
  console.log(`   Ciudad: ${ciudad}`);
  console.log(`   Organización: ${organizacion}`);
  console.log(`   Unidad: ${unidad}`);
  console.log(`   CUIT: ${cuit}`);
  console.log(`   Email: ${email}\n`);

  console.log('📋 SIGUIENTE PASO:\n');
  console.log('1. Instala OpenSSL desde: https://slproweb.com/products/Win32OpenSSL.html');
  console.log('2. Luego ejecuta en PowerShell:');
  console.log(`\n   openssl req -new -key afip_private_key.key -out afip.csr -config openssl.cnf\n`);
  console.log('3. O manualmente copia el subject y usa un generador online:\n');
  console.log(`   Subject: ${subject}\n`);
  console.log('📄 Archivo de configuración creado: openssl.cnf');
  console.log('🔑 Clave privada: afip_private_key.key\n');
  
  // Guardar instrucciones
  const instrucciones = `
INSTRUCCIONES PARA GENERAR CSR

Opción 1: Con OpenSSL (recomendado)
====================================
1. Instalar OpenSSL: https://slproweb.com/products/Win32OpenSSL.html
2. Ejecutar: openssl req -new -key afip_private_key.key -out afip.csr -config openssl.cnf

Opción 2: Generador Online
===========================
1. Ir a: https://www.sslshopper.com/csr-decoder.html
2. Subject DN: ${subject}
3. Pegar la clave privada del archivo: afip_private_key.key

Datos del CSR:
- País: ${pais}
- Provincia: ${provincia}
- Ciudad: ${ciudad}
- Organización: ${organizacion}
- Unidad Organizacional: ${unidad}
- Common Name (CUIT): ${cuit}
- Email: ${email}

IMPORTANTE:
- El Common Name DEBE ser tu CUIT sin guiones
- NO pongas contraseña al CSR
- Guarda la clave privada en lugar seguro
`;

  fs.writeFileSync(path.join(__dirname, 'INSTRUCCIONES_CSR.txt'), instrucciones);
  console.log('📝 Instrucciones guardadas en: INSTRUCCIONES_CSR.txt');
}

generarCSR();
