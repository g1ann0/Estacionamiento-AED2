const os = require('os');

/**
 * Obtiene la dirección IPv4 local de la máquina
 * Detecta automáticamente la IP de la red local
 */
function obtenerIPLocal() {
  const interfaces = os.networkInterfaces();
  
  for (const interfaceName in interfaces) {
    const networkInterface = interfaces[interfaceName];
    
    for (const network of networkInterface) {
      // Buscar IPv4 que no sea loopback y que esté activa
      if (network.family === 'IPv4' && !network.internal && network.address !== '127.0.0.1') {
        return network.address;
      }
    }
  }
  
  // Si no encuentra IP externa, usar localhost como fallback
  return 'localhost';
}

/**
 * Obtiene la URL base del backend con la IP detectada
 */
function obtenerURLBackend(puerto = 3000) {
  const ip = obtenerIPLocal();
  return `http://${ip}:${puerto}`;
}

/**
 * Muestra información de red al iniciar el servidor
 */
function mostrarInfoRed(puerto = 3000) {
  const ip = obtenerIPLocal();
  console.log('\n🌐 INFORMACIÓN DE RED:');
  console.log(`   IP Local detectada: ${ip}`);
  console.log(`   Servidor Backend: http://${ip}:${puerto}`);
  console.log(`   Acceso desde otros dispositivos: http://${ip}:${puerto}`);
  console.log(`   Acceso local: http://localhost:${puerto}`);
  console.log(`   Estado: Escuchando en todas las interfaces (0.0.0.0)\n`);
}

module.exports = {
  obtenerIPLocal,
  obtenerURLBackend,
  mostrarInfoRed
};
