/**
 * @fileoverview Middleware de autenticación JWT
 * @description Verifica el token JWT y la existencia del usuario en las peticiones protegidas
 * @module middlewares/authMiddleware
 */

const jwt = require('jsonwebtoken');
const Usuario = require('../models/Usuario');

/**
 * Middleware para verificar token JWT y autenticar usuario
 * 
 * @async
 * @function verificarToken
 * @param {Object} req - Objeto de petición de Express
 * @param {Object} res - Objeto de respuesta de Express
 * @param {Function} next - Función para continuar al siguiente middleware
 * @returns {Object} Respuesta JSON con error o continúa al siguiente middleware
 * 
 * @example
 * // Usar en rutas protegidas
 * router.get('/perfil', verificarToken, obtenerPerfil);
 */
async function verificarToken(req, res, next) {
  try {
    // Extraer token del header Authorization (Bearer token)
    const token = req.headers['authorization']?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ 
        success: false,
        mensaje: 'Token no proporcionado. Debe incluir el header: Authorization: Bearer <token>' 
      });
    }

    // Verificar y decodificar el token JWT
    jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
      if (err) {
        return res.status(403).json({ 
          success: false,
          mensaje: 'Token inválido o expirado' 
        });
      }
      
      // Verificar que el usuario todavía esté activo en la base de datos
      const usuario = await Usuario.findOne({ 
        _id: decoded.id, 
        activo: true 
      });
      
      if (!usuario) {
        return res.status(403).json({ 
          success: false,
          mensaje: 'Usuario inactivo o no encontrado' 
        });
      }
      
      // Adjuntar información del usuario decodificada a la petición
      req.usuario = decoded; // contiene { id, email, rol, etc. }
      next();
    });
  } catch (error) {
    console.error('Error en verificarToken:', error);
    return res.status(500).json({ 
      success: false,
      mensaje: 'Error al verificar autenticación' 
    });
  }
}

module.exports = verificarToken;
