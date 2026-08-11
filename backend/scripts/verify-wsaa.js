// Verifica el circuito criptográfico del WSAA sin tocar ARCA: genera un certificado de
// prueba, lo empaqueta como .p12, lo lee, arma un TRA y lo firma como CMS/PKCS#7.
//
// Es la parte más delicada de la integración —si la firma está mal, ARCA rechaza con un
// error que no explica por qué— y es la única que se puede validar sin certificado real.
//
// Uso: node scripts/verify-wsaa.js

const fs = require('fs');
const os = require('os');
const path = require('path');
const forge = require('node-forge');

let ok = 0;
let fallos = 0;
const check = (condicion, descripcion, detalle = '') => {
  if (condicion) {
    console.log(`OK   ${descripcion}${detalle ? ` (${detalle})` : ''}`);
    ok += 1;
  } else {
    console.log(`FALLA ${descripcion}${detalle ? ` (${detalle})` : ''}`);
    fallos += 1;
  }
};

const CLAVE = 'clave-de-prueba';

function generarP12(destino) {
  const claves = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = claves.publicKey;
  cert.serialNumber = '01';
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

  const atributos = [
    { name: 'commonName', value: 'estacionamiento-prueba' },
    { name: 'countryName', value: 'AR' },
    { name: 'organizationName', value: 'Prueba' },
    // ARCA identifica al emisor por el CUIT del subject; en el certificado real viene como
    // `serialNumber`, que forge pide por su OID.
    { type: '2.5.4.5', value: 'CUIT 20123456786' }
  ];
  cert.setSubject(atributos);
  cert.setIssuer(atributos);
  cert.sign(claves.privateKey, forge.md.sha256.create());

  const p12Asn1 = forge.pkcs12.toPkcs12Asn1(claves.privateKey, [cert], CLAVE, { algorithm: '3des' });
  fs.writeFileSync(destino, Buffer.from(forge.asn1.toDer(p12Asn1).getBytes(), 'binary'));
  return cert;
}

async function main() {
  const carpeta = fs.mkdtempSync(path.join(os.tmpdir(), 'wsaa-'));
  const rutaP12 = path.join(carpeta, 'prueba.p12');

  try {
    generarP12(rutaP12);
    check(fs.existsSync(rutaP12), 'se genera un .p12 de prueba');

    // Se configura el entorno antes de requerir el módulo: la config se lee al invocar.
    process.env.ARCA_CERT_PATH = rutaP12;
    process.env.ARCA_CERT_PASSWORD = CLAVE;
    process.env.ARCA_CUIT = '20123456786';
    const { construirTRA, firmarCMS, leerCertificado, horaArgentina } = require('../services/arca/wsaa');

    const certificado = leerCertificado(rutaP12, CLAVE);
    check(Boolean(certificado.clave && certificado.certificado), 'se lee el par clave + certificado del .p12');

    let errorClaveMala = null;
    try { leerCertificado(rutaP12, 'clave-incorrecta'); } catch (e) { errorClaveMala = e.message; }
    check(
      errorClaveMala?.includes('ARCA_CERT_PASSWORD'),
      'una clave equivocada explica que el problema es ARCA_CERT_PASSWORD'
    );

    let errorFaltante = null;
    try { leerCertificado(path.join(carpeta, 'no-existe.p12'), CLAVE); } catch (e) { errorFaltante = e.message; }
    check(errorFaltante?.includes('No se encontró'), 'un certificado inexistente dice dónde se lo buscó');

    const tra = construirTRA('wsfe');
    check(tra.includes('<service>wsfe</service>'), 'el TRA nombra el servicio pedido');
    check(/<uniqueId>\d+<\/uniqueId>/.test(tra), 'el TRA lleva uniqueId numérico');

    const generacion = tra.match(/<generationTime>(.*?)<\/generationTime>/)[1];
    const expiracion = tra.match(/<expirationTime>(.*?)<\/expirationTime>/)[1];
    const minutos = (new Date(expiracion) - new Date(generacion)) / 60000;
    check(Math.round(minutos) === 20, 'la ventana del TRA es de 20 minutos (±10 de margen de reloj)', `${Math.round(minutos)} min`);

    // La hora tiene que ser la de Argentina, no la del servidor ni UTC.
    const ahoraArg = horaArgentina();
    const offsetArg = new Date(`${ahoraArg}Z`) - new Date();
    const horasDeDiferencia = Math.round(offsetArg / 3600000);
    check(horasDeDiferencia === -3, 'los tiempos se firman en hora de Argentina (UTC-3)', `UTC${horasDeDiferencia}`);

    const cms = firmarCMS(tra, certificado);
    check(typeof cms === 'string' && cms.length > 100, 'la firma devuelve un CMS en base64', `${cms.length} chars`);

    // Se vuelve a abrir la firma y se comprueba que el TRA viaje adentro, íntegro. Es lo que
    // ARCA hace del otro lado: si el contenido no está o no coincide, rechaza.
    const der = forge.util.decode64(cms);
    const p7 = forge.pkcs7.messageFromAsn1(forge.asn1.fromDer(der));
    check(p7.type === forge.pki.oids.signedData, 'el CMS es de tipo signedData');
    check(p7.rawCapture?.signature?.length > 0, 'el CMS lleva una firma');

    const contenido = p7.rawCapture?.content
      ? forge.util.decodeUtf8(p7.rawCapture.content.value?.[0]?.value ?? p7.rawCapture.content.value)
      : '';
    check(contenido.includes('<service>wsfe</service>'), 'el TRA viaja completo dentro de la firma (CMS adjunto)');
    check(p7.certificates?.length > 0, 'el certificado del firmante viaja en el CMS');
  } finally {
    fs.rmSync(carpeta, { recursive: true, force: true });
  }

  console.log(`\n${fallos === 0 ? '✅ TODO OK' : `❌ ${fallos} fallas`} — ${ok} verificaciones`);
  process.exit(fallos === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error('Error ejecutando verify-wsaa:', error);
  process.exit(1);
});
