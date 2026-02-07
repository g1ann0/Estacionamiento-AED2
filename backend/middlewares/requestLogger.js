/**
 * @fileoverview Middleware de Logging de Peticiones HTTP
 * @description Registra todas las peticiones HTTP con detalles de tiempo, estado y errores
 * @module middlewares/requestLogger
 */

const logger = require('../utils/logger');

/**
 * Middleware para registrar todas las peticiones HTTP
 * Muestra método, URL, código de estado, tiempo de respuesta y detalles del usuario
 * 
 * @param {Object} req - Request de Express
 * @param {Object} res - Response de Express
 * @param {Function} next - Next middleware
 * 
 * @example
 * // En server.js
 * app.use(requestLogger);
 */
const requestLogger = (req, res, next) => {
  // Timestamp de inicio
  const startTime = Date.now();
  
  // Guardar el método write original de res
  const originalSend = res.send;
  
  // Sobrescribir res.send para capturar la respuesta
  res.send = function(data) {
    // Calcular tiempo de respuesta
    const responseTime = Date.now() - startTime;
    
    // Metadata de la petición
    const metadata = {
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('user-agent'),
    };
    
    // Si hay usuario autenticado, agregar info
    if (req.usuario) {
      metadata.userId = req.usuario.id;
      metadata.userEmail = req.usuario.email;
      metadata.userRole = req.usuario.rol;
    }
    
    // Si hay parámetros en la URL, agregarlos
    if (Object.keys(req.params).length > 0) {
      metadata.params = req.params;
    }
    
    // Si hay query string, agregarla (sin datos sensibles)
    if (Object.keys(req.query).length > 0) {
      const safeQuery = { ...req.query };
      delete safeQuery.password;
      delete safeQuery.token;
      metadata.query = safeQuery;
    }
    
    // Determinar nivel de log según status code
    let logMessage = '';
    const statusCode = res.statusCode;
    
    if (statusCode >= 500) {
      // Error del servidor
      logMessage = `🔴 ERROR DEL SERVIDOR`;
    } else if (statusCode >= 400) {
      // Error del cliente
      logMessage = `🟡 ERROR DEL CLIENTE`;
    } else if (statusCode >= 300) {
      // Redirección
      logMessage = `🔵 REDIRECCIÓN`;
    } else if (statusCode >= 200) {
      // Éxito
      logMessage = `🟢 ÉXITO`;
    }
    
    // Log personalizado según la ruta y método
    const routeInfo = getRouteDescription(req.method, req.path);
    
    logger.logRequest(
      req.method,
      req.originalUrl || req.url,
      statusCode,
      responseTime,
      {
        ...metadata,
        description: routeInfo,
        message: logMessage
      }
    );
    
    // Llamar al método original
    return originalSend.call(this, data);
  };
  
  next();
};

/**
 * Obtiene una descripción legible de la ruta
 * 
 * @param {string} method - Método HTTP
 * @param {string} path - Ruta de la petición
 * @returns {string} Descripción de la operación
 */
function getRouteDescription(method, path) {
  // Auth
  if (path.includes('/api/auth/login')) return 'Inicio de sesión';
  if (path.includes('/api/auth/registrar')) return 'Registro de usuario';
  if (path.includes('/api/auth/verificar')) return 'Verificación de token';
  if (path.includes('/api/auth/recuperar')) return 'Recuperación de contraseña';
  
  // Usuarios
  if (path.includes('/api/usuarios') && method === 'GET') return 'Consulta de usuarios';
  if (path.includes('/api/usuarios') && method === 'POST') return 'Creación de usuario';
  if (path.includes('/api/usuarios') && method === 'PUT') return 'Actualización de usuario';
  if (path.includes('/api/usuarios/recargar')) return 'Recarga de saldo';
  
  // Vehículos
  if (path.includes('/api/vehiculos') && method === 'GET') return 'Consulta de vehículos';
  if (path.includes('/api/vehiculos') && method === 'POST') return 'Alta de vehículo';
  if (path.includes('/api/vehiculos') && method === 'PUT') return 'Modificación de vehículo';
  if (path.includes('/api/vehiculos') && method === 'DELETE') return 'Baja de vehículo';
  
  // Estacionamiento
  if (path.includes('/api/estacionamiento/iniciar')) return 'Inicio de estacionamiento';
  if (path.includes('/api/estacionamiento/finalizar')) return 'Finalización de estacionamiento';
  if (path.includes('/api/estacionamiento/estado')) return 'Consulta de estado de estacionamiento';
  
  // Transacciones
  if (path.includes('/api/transacciones')) return 'Consulta de transacciones';
  
  // Comprobantes
  if (path.includes('/api/comprobantes') && method === 'POST') return 'Carga de comprobante';
  if (path.includes('/api/comprobantes') && method === 'GET') return 'Consulta de comprobantes';
  if (path.includes('/aprobar')) return 'Aprobación de comprobante';
  
  // Facturación
  if (path.includes('/api/facturador/generar-factura')) return 'Generación de factura AFIP';
  if (path.includes('/api/facturador/validar-cuit')) return 'Validación de CUIT';
  
  // Admin
  if (path.includes('/api/admin')) return 'Operación administrativa';
  
  // Perfil
  if (path.includes('/api/perfil')) return 'Gestión de perfil';
  
  // Precios
  if (path.includes('/api/precios')) return 'Gestión de precios';
  
  return 'Operación general';
}

module.exports = requestLogger;
