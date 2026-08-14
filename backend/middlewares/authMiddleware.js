const jwt = require('jsonwebtoken');
const Usuario = require('../models/Usuario');
const { tokenDelRequest } = require('./cookies');

async function verificarToken(req, res, next) {
  // Cabecera `Authorization` o cookie de sesión: el navegador usa la cookie HttpOnly, que el
  // JavaScript de la página no puede leer; los scripts y las integraciones siguen con Bearer.
  const token = tokenDelRequest(req);
  if (!token) return res.status(401).json({ mensaje: 'Token no proporcionado' });

  jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
    if (err) return res.status(403).json({ mensaje: 'Token inválido' });
    
    // Verificar que el usuario todavía esté activo
    try {
      const usuario = await Usuario.findOne({ 
        _id: decoded.id, 
        activo: true 
      });
      
      if (!usuario) {
        return res.status(403).json({ mensaje: 'Usuario inactivo o no encontrado' });
      }
      
      req.usuario = decoded; // contendra req.usuario.id, etc. (payload del JWT, congelado desde el login)
      req.usuarioActual = usuario; // documento vivo de la DB — fuente de verdad para autorización (rol actual, no el del login)
      next();
    } catch (error) {
      return res.status(500).json({ mensaje: 'Error al verificar usuario' });
    }
  });
}

module.exports = verificarToken;
