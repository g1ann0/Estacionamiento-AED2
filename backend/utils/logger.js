/**
 * @fileoverview Sistema de Logging Centralizado
 * @description Configuración de Winston para logs detallados con rotación diaria
 * @module utils/logger
 */

const winston = require('winston');
const path = require('path');

// Formato personalizado para logs
const customFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, stack, ...metadata }) => {
    let log = `${timestamp} [${level.toUpperCase()}]: ${message}`;
    
    // Agregar metadata si existe
    if (Object.keys(metadata).length > 0) {
      log += ` ${JSON.stringify(metadata)}`;
    }
    
    // Agregar stack trace si es un error
    if (stack) {
      log += `\n${stack}`;
    }
    
    return log;
  })
);

// Formato colorizado para consola
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...metadata }) => {
    let log = `${timestamp} ${level}: ${message}`;
    
    if (Object.keys(metadata).length > 0) {
      const metadataStr = JSON.stringify(metadata, null, 2);
      log += `\n${metadataStr}`;
    }
    
    return log;
  })
);

// Crear directorio de logs si no existe
const logsDir = path.join(__dirname, '../logs');
const fs = require('fs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

/**
 * Logger principal de la aplicación
 */
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: customFormat,
  defaultMeta: { service: 'estacionamiento-api' },
  transports: [
    // Logs de errores en archivo separado
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    
    // Logs combinados (todos los niveles)
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
});

// En desarrollo, también loguear a consola con colores
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat,
  }));
}

/**
 * Función helper para loguear peticiones HTTP
 * 
 * @param {string} method - Método HTTP (GET, POST, etc.)
 * @param {string} url - URL de la petición
 * @param {number} statusCode - Código de estado HTTP
 * @param {number} responseTime - Tiempo de respuesta en ms
 * @param {Object} metadata - Datos adicionales (usuario, IP, etc.)
 */
logger.logRequest = (method, url, statusCode, responseTime, metadata = {}) => {
  const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
  
  logger.log({
    level,
    message: `${method} ${url} - ${statusCode} - ${responseTime}ms`,
    method,
    url,
    statusCode,
    responseTime,
    ...metadata
  });
};

/**
 * Función helper para loguear operaciones exitosas
 * 
 * @param {string} operation - Nombre de la operación
 * @param {Object} metadata - Datos relevantes
 */
logger.logSuccess = (operation, metadata = {}) => {
  logger.info(`✅ ${operation}`, metadata);
};

/**
 * Función helper para loguear errores de negocio
 * 
 * @param {string} operation - Nombre de la operación que falló
 * @param {Error|string} error - Error ocurrido
 * @param {Object} metadata - Datos relevantes
 */
logger.logError = (operation, error, metadata = {}) => {
  logger.error(`❌ ${operation}`, {
    error: error.message || error,
    stack: error.stack,
    ...metadata
  });
};

/**
 * Función helper para loguear advertencias
 * 
 * @param {string} message - Mensaje de advertencia
 * @param {Object} metadata - Datos relevantes
 */
logger.logWarning = (message, metadata = {}) => {
  logger.warn(`⚠️  ${message}`, metadata);
};

module.exports = logger;
