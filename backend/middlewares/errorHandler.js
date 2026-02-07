/**
 * @fileoverview Middleware centralizado para manejo de errores
 * @description Captura y formatea todos los errores de la aplicación
 * @module middlewares/errorHandler
 */

/**
 * Middleware de manejo de errores centralizado
 * Debe ser el último middleware registrado en la aplicación
 * 
 * @function errorHandler
 * @param {Error} err - Objeto de error
 * @param {Object} req - Objeto de petición de Express
 * @param {Object} res - Objeto de respuesta de Express
 * @param {Function} next - Función para continuar (no se usa en error handlers)
 * @returns {Object} Respuesta JSON formateada con el error
 * 
 * @example
 * // En server.js (debe ser el último middleware)
 * app.use(errorHandler);
 */
const errorHandler = (err, req, res, next) => {
    // Registrar error en consola para debugging
    console.error('❌ Error capturado:', {
        mensaje: err.message,
        ruta: req.originalUrl,
        metodo: req.method,
        timestamp: new Date().toISOString()
    });
    
    // Error de validación de Mongoose
    if (err.name === 'ValidationError') {
        return res.status(400).json({
            success: false,
            mensaje: 'Error de validación de datos',
            errores: Object.values(err.errors).map(e => e.message)
        });
    }
    
    // Error de duplicado en MongoDB (unique constraint)
    if (err.name === 'MongoError' || err.name === 'MongoServerError') {
        if (err.code === 11000) {
            const campo = Object.keys(err.keyPattern)[0];
            return res.status(400).json({
                success: false,
                mensaje: `Ya existe un registro con ese ${campo}`
            });
        }
    }
    
    // Error de JWT inválido
    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({
            success: false,
            mensaje: 'Token de autenticación inválido'
        });
    }
    
    // Error de JWT expirado
    if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
            success: false,
            mensaje: 'Token de autenticación expirado'
        });
    }
    
    // Error de casteo de MongoDB (ID inválido, etc.)
    if (err.name === 'CastError') {
        return res.status(400).json({
            success: false,
            mensaje: `Formato de ${err.path} inválido`
        });
    }
    
    // Error genérico del servidor
    res.status(err.status || 500).json({
        success: false,
        mensaje: err.message || 'Error interno del servidor',
        // Solo mostrar stack trace en desarrollo
        ...(process.env.NODE_ENV === 'development' && { 
            error: err.message,
            stack: err.stack 
        })
    });
};

module.exports = errorHandler;
