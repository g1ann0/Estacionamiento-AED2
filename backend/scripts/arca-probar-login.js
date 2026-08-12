// Prueba el login contra el WSAA real y dice, en castellano, qué pasó.
//
// Es el primer contacto con ARCA: si esto anda, el certificado, la clave, el CUIT y el
// ambiente están bien, y lo que sigue (WSFE) es cuestión de armar el pedido. Si no anda, los
// errores de ARCA son crípticos a propósito, así que acá se traducen los tres o cuatro que
// aparecen el 90% de las veces.
//
// Uso: node scripts/arca-probar-login.js

require('dotenv').config();
const { leerConfig } = require('../services/arca/config');
const { obtenerTicket, olvidarTicket } = require('../services/arca/wsaa');

// Los errores del WSAA no dicen qué hacer. Esta tabla traduce los que realmente aparecen.
const TRADUCCIONES = [
  {
    coincide: /certificado no emitido por AC de confianza|not authorized|Certificado no emitido/i,
    que: 'ARCA no reconoce el certificado en este ambiente.',
    porque: 'Casi siempre es un certificado de producción probado contra homologación, o al revés.',
    hacer: 'Revisá ARCA_AMBIENTE en el .env. Los certificados NO son intercambiables entre ambientes.'
  },
  {
    coincide: /El CEE ya posee un TA valido|ya posee un TA/i,
    que: 'Ya hay un ticket vigente para este certificado y servicio.',
    porque: 'ARCA entrega uno cada 12 horas y rechaza pedir otro antes de tiempo.',
    hacer: 'No es un error real: significa que el certificado funciona. Esperá o reusá el ticket cacheado.'
  },
  {
    coincide: /Computador no autorizado|no autorizado a acceder al servicio/i,
    que: 'El certificado es válido y ARCA lo reconoce, pero el DN no tiene permiso sobre wsfe.',
    porque: 'Subir el CSR y autorizar el servicio son dos acciones distintas; falta la segunda.',
    // Los dos ambientes se autorizan en lugares distintos, y mandar a alguien al portal
    // equivocado le cuesta media hora de buscar un menú que ahí no existe.
    hacer: 'En HOMOLOGACIÓN: en el portal WSASS, "Crear autorización a servicio" → DN = tu alias, ' +
      'servicio = wsfe. En PRODUCCIÓN: Administrador de Relaciones → nueva relación → ' +
      'Facturación Electrónica → representante = el alias del certificado.'
  },
  {
    coincide: /generationTime|expirationTime|fecha/i,
    que: 'ARCA rechazó las fechas del pedido.',
    porque: 'El reloj de esta máquina está corrido respecto del de ARCA.',
    hacer: 'Sincronizá la hora del sistema. El pedido ya se firma con ±10 minutos de tolerancia.'
  },
  {
    coincide: /ENOTFOUND|ETIMEDOUT|ECONNREFUSED|socket hang up/i,
    que: 'No se pudo llegar a los servidores de ARCA.',
    porque: 'Conectividad, DNS o un firewall en el medio.',
    hacer: 'Probá abrir la URL del WSDL en el navegador desde esta misma máquina.'
  }
];

async function main() {
  const config = leerConfig();

  console.log('Configuración');
  console.log(`  ambiente     : ${config.ambiente}`);
  console.log(`  CUIT         : ${config.cuit || '(sin configurar)'}`);
  console.log(`  certificado  : ${config.certificadoPath}`);
  console.log(`  clave privada: ${config.clavePath || '(usando .p12)'}`);
  console.log(`  WSAA         : ${config.urls.wsaa}`);
  console.log();

  if (config.usarMock) {
    console.log('ARCA_MOCK=true — esta prueba consulta el WSAA real, así que apagalo para usarla.');
    process.exit(1);
  }

  console.log('Pidiendo ticket de acceso al WSAA…\n');
  olvidarTicket();

  try {
    const ticket = await obtenerTicket({ forzarRenovacion: true });
    console.log('✅ ARCA autorizó el acceso.\n');
    console.log(`  token   : ${ticket.token.slice(0, 24)}… (${ticket.token.length} caracteres)`);
    console.log(`  sign    : ${ticket.sign.slice(0, 24)}… (${ticket.sign.length} caracteres)`);
    console.log(`  vence   : ${ticket.expiracion ? ticket.expiracion.toLocaleString('es-AR') : 'sin fecha'}`);
    console.log('\nEl certificado, la clave, el CUIT y el ambiente están bien.');
  } catch (error) {
    const mensaje = error?.message ?? String(error);
    console.log('❌ ARCA rechazó el pedido.\n');

    const traduccion = TRADUCCIONES.find((t) => t.coincide.test(mensaje));
    if (traduccion) {
      console.log(`  Qué pasa : ${traduccion.que}`);
      console.log(`  Por qué  : ${traduccion.porque}`);
      console.log(`  Qué hacer: ${traduccion.hacer}`);
    } else {
      console.log('  Este error no está en la lista de los conocidos.');
    }

    console.log(`\n  Mensaje original de ARCA:\n  ${mensaje}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Error inesperado:', error);
  process.exit(1);
});
