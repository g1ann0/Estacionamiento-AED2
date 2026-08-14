// Estado de los servicios de ARCA que este sistema necesita.
//
// Sirve para no perder tiempo adivinando: cuando algo no anda, lo primero es saber si el
// problema es nuestro o de ellos. Los portales de ARCA se caen seguido y el error que
// devuelven no lo dice — un reset de conexión se parece bastante a un firewall propio.
//
// Uso: node scripts/arca-estado.js

const https = require('https');

const SERVICIOS = [
  { nombre: 'WSAA homologación', url: 'https://wsaahomo.afip.gov.ar/ws/services/LoginCms?wsdl', para: 'autenticarse para probar' },
  { nombre: 'WSFE homologación', url: 'https://wswhomo.afip.gov.ar/wsfev1/service.asmx?WSDL', para: 'pedir CAE de prueba' },
  { nombre: 'WSASS (certificados homo)', url: 'https://wsass-homo.afip.gob.ar/wsass/portal/main.aspx', para: 'tramitar el certificado de homologación' },
  { nombre: 'WSAA producción', url: 'https://wsaa.afip.gov.ar/ws/services/LoginCms?wsdl', para: 'autenticarse en serio' },
  { nombre: 'WSFE producción', url: 'https://servicios1.afip.gov.ar/wsfev1/service.asmx?WSDL', para: 'pedir CAE real' },
  { nombre: 'Portal ARCA', url: 'https://www.arca.gob.ar', para: 'clave fiscal y trámites' }
];

const consultar = (url) => new Promise((resolver) => {
  const inicio = Date.now();
  const request = https.get(url, {
    timeout: 15000,
    // Algunos portales de ARCA cortan la conexión si no reconocen al cliente.
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36' }
  }, (respuesta) => {
    respuesta.resume();
    resolver({ ok: respuesta.statusCode < 400, detalle: `HTTP ${respuesta.statusCode}`, ms: Date.now() - inicio });
  });

  request.on('timeout', () => {
    request.destroy();
    resolver({ ok: false, detalle: 'sin respuesta (timeout)', ms: Date.now() - inicio });
  });

  request.on('error', (error) => {
    const detalle = error.code === 'ECONNRESET' ? 'la conexión se corta del lado de ARCA'
      : error.code === 'ENOTFOUND' ? 'el dominio no resuelve'
      : error.code === 'ECONNREFUSED' ? 'conexión rechazada'
      : error.code || error.message;
    resolver({ ok: false, detalle, ms: Date.now() - inicio });
  });
});

async function main() {
  console.log('Estado de los servicios de ARCA\n');

  const resultados = [];
  for (const servicio of SERVICIOS) {
    const resultado = await consultar(servicio.url);
    resultados.push({ ...servicio, ...resultado });
    const marca = resultado.ok ? '✅' : '❌';
    console.log(`${marca} ${servicio.nombre.padEnd(28)} ${resultado.detalle.padEnd(38)} ${resultado.ms} ms`);
    console.log(`   ${servicio.para}`);
  }

  const caidos = resultados.filter((r) => !r.ok);
  console.log();

  if (caidos.length === 0) {
    console.log('Todo respondiendo.');
    return;
  }

  console.log(`${caidos.length} de ${resultados.length} no responden:`);
  for (const caido of caidos) console.log(`  · ${caido.nombre} — ${caido.para}`);

  // La distinción que importa: si los web services andan y solo falla un portal, el problema
  // es de ellos y no hay nada que hacer de este lado salvo esperar.
  const websServicesOk = resultados.filter((r) => r.nombre.startsWith('WS') && !r.nombre.includes('WSASS')).every((r) => r.ok);
  if (websServicesOk) {
    console.log('\nLos web services andan: lo que falla es un portal web de ARCA.');
    console.log('No hay nada que corregir de este lado — se reintenta más tarde.');
  } else {
    console.log('\nHay web services caídos: la emisión de comprobantes va a fallar hasta que vuelvan.');
    console.log('El diseño diferido cubre esto: los cobros siguen y los comprobantes quedan pendientes.');
  }
}

main();
