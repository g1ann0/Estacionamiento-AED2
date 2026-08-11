// Configuración de la integración con ARCA (ex AFIP).
//
// ARCA tiene dos ambientes con URLs, certificados y CUIT distintos. Homologación es donde se
// prueba; producción emite comprobantes fiscales reales, que no se borran: se anulan con nota
// de crédito. Por eso el ambiente es explícito y nunca se infiere de NODE_ENV — un deploy que
// factura de verdad porque alguien cambió una variable de entorno de propósito general sería
// una forma cara de aprender la diferencia.

const path = require('path');

const AMBIENTES = {
  homologacion: {
    wsaa: 'https://wsaahomo.afip.gov.ar/ws/services/LoginCms?wsdl',
    wsfe: 'https://wswhomo.afip.gov.ar/wsfev1/service.asmx?WSDL'
  },
  produccion: {
    wsaa: 'https://wsaa.afip.gov.ar/ws/services/LoginCms?wsdl',
    wsfe: 'https://servicios1.afip.gov.ar/wsfev1/service.asmx?WSDL'
  }
};

const SERVICIO_WSFE = 'wsfe';

const leerConfig = () => {
  const ambiente = process.env.ARCA_AMBIENTE || 'homologacion';
  if (!AMBIENTES[ambiente]) {
    throw new Error(`ARCA_AMBIENTE inválido: "${ambiente}". Debe ser "homologacion" o "produccion".`);
  }

  return {
    ambiente,
    urls: AMBIENTES[ambiente],
    // El CUIT es el de la empresa emisora, el mismo con el que se generó el certificado.
    cuit: process.env.ARCA_CUIT || null,
    // ARCA entrega el certificado como `.crt` en PEM, y la clave privada es la que se generó
    // junto al CSR. Ese par es el camino directo. El `.p12` —un contenedor de esos mismos dos
    // archivos— se acepta porque es lo que usa CGAS, pero no hace falta convertir nada.
    certificadoPath: process.env.ARCA_CERT_PATH
      ? path.resolve(process.env.ARCA_CERT_PATH)
      : path.join(__dirname, '..', '..', 'certs', 'arca.crt'),
    clavePath: process.env.ARCA_KEY_PATH ? path.resolve(process.env.ARCA_KEY_PATH) : null,
    certificadoPassword: process.env.ARCA_CERT_PASSWORD || '',
    // El mock es andamio de desarrollo: devuelve un CAE falso para poder recorrer el circuito
    // sin certificado. PRODUCT.md fija que el objetivo es ARCA real sin mock permanente, así
    // que todo lo que salga del mock queda marcado como tal y la interfaz no lo muestra como
    // un comprobante fiscal válido.
    usarMock: process.env.ARCA_MOCK === 'true',
    servicio: SERVICIO_WSFE
  };
};

// Un error de configuración tiene que decir qué falta y dónde se pone, no "undefined".
const validarConfig = (config) => {
  const faltantes = [];
  if (!config.cuit) faltantes.push('ARCA_CUIT (CUIT de la empresa emisora, sin guiones)');
  // Con PEM la clave puede estar sin cifrar, así que la contraseña solo es obligatoria en el
  // camino del .p12, donde el contenedor siempre lo pide.
  if (!config.clavePath && !config.certificadoPassword) {
    faltantes.push('ARCA_KEY_PATH (clave privada .key) o ARCA_CERT_PASSWORD (si usás un .p12)');
  }
  return faltantes;
};

module.exports = { leerConfig, validarConfig, AMBIENTES, SERVICIO_WSFE };
