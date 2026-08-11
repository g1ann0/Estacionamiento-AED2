// Empaqueta el certificado de ARCA (.crt) y su clave privada (.key) en un .p12.
//
// El sistema NO lo necesita: la integración firma directamente con el par PEM que entrega
// ARCA. Este script existe porque otras herramientas del rubro —y CGAS, que es .NET— sí piden
// PKCS#12, y porque tener el par empaquetado en un solo archivo con contraseña es una forma
// razonable de guardarlo.
//
// Uso:
//   node scripts/arca-empaquetar-p12.js <ruta.crt> <ruta.key> <salida.p12>
//
// La contraseña se pide por consola y no se pasa como argumento: los argumentos quedan en el
// historial del shell y en la lista de procesos.

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const forge = require('node-forge');

const [, , rutaCrt, rutaKey, rutaSalida] = process.argv;

if (!rutaCrt || !rutaKey || !rutaSalida) {
  console.error('Uso: node scripts/arca-empaquetar-p12.js <ruta.crt> <ruta.key> <salida.p12>');
  process.exit(1);
}

const preguntarClave = () => new Promise((resolver) => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  // Se apaga el eco para que la contraseña no quede escrita en la terminal.
  const escribir = rl._writeToOutput?.bind(rl);
  rl._writeToOutput = (texto) => { if (texto.includes('Contraseña')) escribir?.(texto); };
  rl.question('Contraseña para proteger el .p12: ', (respuesta) => {
    rl.close();
    console.log();
    resolver(respuesta);
  });
});

async function main() {
  for (const [ruta, que] of [[rutaCrt, 'certificado'], [rutaKey, 'clave privada']]) {
    if (!fs.existsSync(ruta)) {
      console.error(`No se encontró el ${que} en "${ruta}".`);
      process.exit(1);
    }
  }

  const certificado = forge.pki.certificateFromPem(fs.readFileSync(rutaCrt, 'utf8'));
  const pemClave = fs.readFileSync(rutaKey, 'utf8');

  let clave;
  if (pemClave.includes('ENCRYPTED')) {
    const claveDeLaKey = await preguntarClave();
    clave = forge.pki.decryptRsaPrivateKey(pemClave, claveDeLaKey);
    if (!clave) {
      console.error('Esa contraseña no abre la clave privada.');
      process.exit(1);
    }
  } else {
    clave = forge.pki.privateKeyFromPem(pemClave);
  }

  // Se comprueba que la clave sea la del certificado antes de empaquetar: un .p12 con un par
  // que no se corresponde produce firmas que ARCA rechaza sin explicar por qué.
  const modulosCoinciden = certificado.publicKey.n.equals(clave.n);
  if (!modulosCoinciden) {
    console.error('La clave privada no corresponde a ese certificado: no son un par.');
    process.exit(1);
  }

  const claveDelP12 = await preguntarClave();
  if (!claveDelP12) {
    console.error('El .p12 tiene que llevar contraseña.');
    process.exit(1);
  }

  const p12Asn1 = forge.pkcs12.toPkcs12Asn1(clave, [certificado], claveDelP12, { algorithm: '3des' });
  fs.mkdirSync(path.dirname(path.resolve(rutaSalida)), { recursive: true });
  fs.writeFileSync(rutaSalida, Buffer.from(forge.asn1.toDer(p12Asn1).getBytes(), 'binary'));

  console.log(`Listo: ${rutaSalida}`);
  console.log(`Titular: ${certificado.subject.attributes.map((a) => `${a.shortName || a.type}=${a.value}`).join(', ')}`);
  console.log(`Válido hasta: ${certificado.validity.notAfter.toLocaleDateString('es-AR')}`);
  console.log('\nGuardalo fuera del repo: backend/certs/ está en .gitignore.');
}

main().catch((error) => {
  console.error('Error empaquetando el .p12:', error.message);
  process.exit(1);
});
