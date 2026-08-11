// WSAA — autenticación de ARCA.
//
// El circuito lo impone ARCA y no se negocia:
//   1. Armar el TRA (Ticket de Requerimiento de Acceso): un XML con uniqueId, generationTime,
//      expirationTime y el servicio que se quiere usar.
//   2. Firmarlo como CMS/PKCS#7 con el certificado X.509 de la empresa.
//   3. Mandar ese CMS en base64 a `loginCms`.
//   4. Recibir token y sign, que valen para todas las llamadas al WSFE.
//
// Dos detalles que CGAS aprendió peleándose con ARCA en producción y que se copian tal cual
// (ver docs/analisis-gap-cgas/04, sección 4):
//
//   - Los tiempos se firman con ±10 minutos de margen. Es tolerancia al desfasaje de reloj
//     contra los servidores de ARCA: sin ese margen, un reloj unos minutos adelantado hace
//     fallar la autenticación con un error que no explica nada.
//   - La hora es la de Argentina, no UTC ni la del servidor donde corre esto.
//
// Y uno propio: el ticket dura 12 horas y se cachea. Pedir uno nuevo por cada comprobante es
// la forma más rápida de que ARCA rechace por exceso de solicitudes.

const fs = require('fs');
const forge = require('node-forge');
const soap = require('soap');
const { leerConfig, validarConfig } = require('./config');

const MARGEN_MINUTOS = 10;
// El ticket de ARCA vale 12 horas; se renueva antes para no usar uno que vence en el medio
// de una tanda de emisiones.
const MARGEN_RENOVACION_MS = 10 * 60 * 1000;

let ticketEnCache = null;

// ARCA espera la hora local argentina en formato ISO sin zona. `sv-SE` da exactamente
// `YYYY-MM-DD HH:mm:ss`, que es lo más cerca del formato pedido sin armarlo a mano.
const horaArgentina = (desplazamientoMinutos = 0) => {
  const fecha = new Date(Date.now() + desplazamientoMinutos * 60000);
  const partes = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false
  }).formatToParts(fecha).reduce((acc, p) => ({ ...acc, [p.type]: p.value }), {});

  return `${partes.year}-${partes.month}-${partes.day}T${partes.hour}:${partes.minute}:${partes.second}`;
};

const construirTRA = (servicio) => {
  // El uniqueId tiene que crecer entre pedidos. El epoch en segundos alcanza y sobra: ARCA
  // solo exige que no se repita para el mismo par (CUIT, servicio) en la misma ventana.
  const uniqueId = Math.floor(Date.now() / 1000);

  return `<?xml version="1.0" encoding="UTF-8"?>
<loginTicketRequest version="1.0">
  <header>
    <uniqueId>${uniqueId}</uniqueId>
    <generationTime>${horaArgentina(-MARGEN_MINUTOS)}</generationTime>
    <expirationTime>${horaArgentina(MARGEN_MINUTOS)}</expirationTime>
  </header>
  <service>${servicio}</service>
</loginTicketRequest>`;
};

// ARCA entrega el certificado como `.crt` en PEM. La clave privada es la que generaste vos
// junto al CSR y ARCA nunca la ve. Firmar necesita las dos cosas.
//
// CGAS usa un `.p12` porque .NET empaqueta así, pero el `.p12` es solo un contenedor de esos
// mismos dos archivos: acá se aceptan los dos caminos, y el PEM es el directo — evita un paso
// de conversión que solo existía por el stack del otro sistema.
const leerCertificadoPEM = (rutaCert, rutaClave) => {
  for (const [ruta, que] of [[rutaCert, 'certificado (.crt)'], [rutaClave, 'clave privada (.key)']]) {
    if (!fs.existsSync(ruta)) {
      throw new Error(
        `No se encontró el ${que} de ARCA en "${ruta}". ` +
        'Configurá ARCA_CERT_PATH y ARCA_KEY_PATH.'
      );
    }
  }

  const certificado = forge.pki.certificateFromPem(fs.readFileSync(rutaCert, 'utf8'));

  const pemClave = fs.readFileSync(rutaClave, 'utf8');
  let clave;
  try {
    // Una clave privada puede venir cifrada con passphrase o en claro. Se prueban las dos
    // formas para no obligar a declarar cuál es.
    clave = pemClave.includes('ENCRYPTED')
      ? forge.pki.decryptRsaPrivateKey(pemClave, process.env.ARCA_CERT_PASSWORD || '')
      : forge.pki.privateKeyFromPem(pemClave);
  } catch (error) {
    throw new Error(`No se pudo leer la clave privada de ARCA: ${error.message}`);
  }

  if (!clave) {
    throw new Error(
      'La clave privada de ARCA está cifrada y ARCA_CERT_PASSWORD no la abre.'
    );
  }

  return { clave, certificado };
};

// Lee el .p12 y devuelve la clave privada y el certificado. Si la clave del archivo está mal,
// node-forge lanza un error de descifrado que no menciona el archivo: se traduce.
const leerCertificadoP12 = (rutaP12, password) => {
  if (!fs.existsSync(rutaP12)) {
    throw new Error(
      `No se encontró el certificado de ARCA en "${rutaP12}". ` +
      'Poné el archivo .p12 ahí o configurá ARCA_CERT_PATH.'
    );
  }

  const p12Buffer = fs.readFileSync(rutaP12);
  let p12;
  try {
    const p12Asn1 = forge.asn1.fromDer(p12Buffer.toString('binary'));
    p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password);
  } catch (error) {
    throw new Error(
      `No se pudo abrir el certificado de ARCA: ${error.message}. ` +
      'Suele ser la clave equivocada en ARCA_CERT_PASSWORD.'
    );
  }

  const bolsaClave =
    p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0] ??
    p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag]?.[0];
  const bolsaCert = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag]?.[0];

  if (!bolsaClave?.key || !bolsaCert?.cert) {
    throw new Error('El archivo .p12 no contiene un par certificado + clave privada utilizable.');
  }

  return { clave: bolsaClave.key, certificado: bolsaCert.cert };
};

// Punto de entrada único: elige el formato por lo que haya configurado. El PEM gana cuando
// están las dos rutas, porque es lo que ARCA entrega y no requiere conversión.
const leerCertificado = (config) => {
  if (config.clavePath) return leerCertificadoPEM(config.certificadoPath, config.clavePath);
  return leerCertificadoP12(config.certificadoPath, config.certificadoPassword);
};

// Firma el TRA como CMS/PKCS#7 adjunto (el contenido viaja dentro de la firma), que es lo que
// espera `loginCms`. Es el equivalente exacto de `CertificadosX509Lib.FirmaBytesMensaje` de
// CGAS, que en .NET viene resuelto por SignedCms.
const firmarCMS = (tra, { clave, certificado }) => {
  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(tra, 'utf8');
  p7.addCertificate(certificado);
  p7.addSigner({
    key: clave,
    certificate: certificado,
    digestAlgorithm: forge.pki.oids.sha256,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
      { type: forge.pki.oids.messageDigest },
      { type: forge.pki.oids.signingTime, value: new Date() }
    ]
  });
  p7.sign();

  return forge.util.encode64(forge.asn1.toDer(p7.toAsn1()).getBytes());
};

// La respuesta de loginCms es un XML con token, sign y expirationTime. Se leen con regex y no
// con un parser: son tres campos de un documento que ARCA define y no cambia, y agregar una
// dependencia de XML para esto sería peor.
const parsearRespuesta = (xml) => {
  const buscar = (etiqueta) => xml.match(new RegExp(`<${etiqueta}>([\\s\\S]*?)</${etiqueta}>`))?.[1]?.trim();

  const token = buscar('token');
  const sign = buscar('sign');
  const expiracion = buscar('expirationTime');

  if (!token || !sign) {
    throw new Error('ARCA respondió a la autenticación sin token ni sign.');
  }

  return { token, sign, expiracion: expiracion ? new Date(expiracion) : null };
};

// Devuelve {token, sign} listos para el WSFE, reusando el ticket vigente si lo hay.
async function obtenerTicket({ forzarRenovacion = false } = {}) {
  const config = leerConfig();

  if (!forzarRenovacion && ticketEnCache?.expiracion) {
    const vigente = ticketEnCache.expiracion.getTime() - MARGEN_RENOVACION_MS > Date.now();
    if (vigente) return ticketEnCache;
  }

  const faltantes = validarConfig(config);
  if (faltantes.length) {
    throw new Error(`Falta configurar la integración con ARCA: ${faltantes.join(', ')}.`);
  }

  const certificado = leerCertificado(config);
  const tra = construirTRA(config.servicio);
  const cms = firmarCMS(tra, certificado);

  const cliente = await soap.createClientAsync(config.urls.wsaa);
  const [respuesta] = await cliente.loginCmsAsync({ in0: cms });

  const ticket = parsearRespuesta(respuesta.loginCmsReturn);
  ticketEnCache = { ...ticket, cuit: config.cuit, ambiente: config.ambiente };
  return ticketEnCache;
}

// Para los tests y para el arranque: deja el cache limpio.
const olvidarTicket = () => { ticketEnCache = null; };

module.exports = {
  obtenerTicket,
  olvidarTicket,
  construirTRA,
  firmarCMS,
  leerCertificado,
  leerCertificadoPEM,
  leerCertificadoP12,
  horaArgentina
};
