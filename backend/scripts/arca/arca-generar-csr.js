// Genera la clave privada y el CSR (pedido de firma) para tramitar un certificado en ARCA.
//
// ARCA no genera la clave privada: se genera acá, se le manda solo el CSR, y ARCA devuelve el
// .crt. Por eso la clave privada **nunca sale de esta máquina** — y por eso, si se pierde, el
// certificado que ARCA emitió queda inservible y hay que tramitar uno nuevo.
//
// Uso:
//   node scripts/arca-generar-csr.js <CUIT> "<Razón social>"
//
// Ejemplo:
//   node scripts/arca-generar-csr.js 20442422924 "CASTELPARK"
//
// Después: subir el .csr en ARCA (Administración de Certificados Digitales), descargar el
// .crt que devuelve, y dejarlo como backend/certs/arca.crt.

const fs = require('fs');
const path = require('path');
const forge = require('node-forge');

const [, , cuit, razonSocial] = process.argv;

if (!cuit || !razonSocial) {
  console.error('Uso: node scripts/arca-generar-csr.js <CUIT> "<Razón social>"');
  console.error('Ejemplo: node scripts/arca-generar-csr.js 20442422924 "CASTELPARK"');
  process.exit(1);
}

if (!/^\d{11}$/.test(cuit)) {
  console.error(`El CUIT debe tener 11 dígitos sin guiones. Recibí "${cuit}".`);
  process.exit(1);
}

// backend/certs/, dos niveles arriba de scripts/arca/.
const carpeta = path.join(__dirname, '..', '..', 'certs');
const rutaKey = path.join(carpeta, 'arca.key');
const rutaCsr = path.join(carpeta, 'arca.csr');

// Sobrescribir una clave privada existente es destruir el acceso al certificado que la usa:
// se pide confirmación explícita moviéndola, no se pisa en silencio.
if (fs.existsSync(rutaKey)) {
  const respaldo = `${rutaKey}.anterior-${Date.now()}`;
  fs.renameSync(rutaKey, respaldo);
  console.log(`Ya había una clave privada. La moví a ${path.basename(respaldo)} en vez de pisarla.`);
}

console.log('Generando clave privada de 2048 bits…');
const claves = forge.pki.rsa.generateKeyPair(2048);

const csr = forge.pki.createCertificationRequest();
csr.publicKey = claves.publicKey;

// ARCA identifica al emisor por estos tres campos. El serialNumber lleva el CUIT con el
// prefijo "CUIT " — así viene en el certificado que ARCA devuelve.
csr.setSubject([
  { name: 'countryName', value: 'AR' },
  { name: 'organizationName', value: razonSocial },
  { name: 'commonName', value: razonSocial },
  { type: '2.5.4.5', value: `CUIT ${cuit}` }
]);

csr.sign(claves.privateKey, forge.md.sha256.create());

fs.mkdirSync(carpeta, { recursive: true });
fs.writeFileSync(rutaKey, forge.pki.privateKeyToPem(claves.privateKey));
fs.writeFileSync(rutaCsr, forge.pki.certificationRequestToPem(csr));

console.log(`
Listo.

  ${rutaKey}
     La clave privada. NO se comparte, NO se sube a ningún lado, NO va al repo.
     Si se pierde, el certificado que ARCA emita con este CSR queda inservible.

  ${rutaCsr}
     El pedido. Esto SÍ se sube a ARCA.

Pasos que siguen, en ARCA:
  1. Entrar con clave fiscal → Administración de Certificados Digitales.
  2. Agregar alias, subir arca.csr, y descargar el .crt que devuelve.
  3. Dejar ese archivo como backend/certs/arca.crt.
  4. Asociar el alias al servicio "Facturación Electrónica" (wsfe) y al punto de venta.

La carpeta backend/certs/ está en .gitignore: nada de esto viaja al repositorio.
`);
