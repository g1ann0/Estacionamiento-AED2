const jwt = require('jsonwebtoken');
const Usuario = require('../models/Usuario');

async function verificarToken(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];
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
      
      req.usuario = decoded; // contendra req.usuario.id, etc.
      next();
    } catch (error) {
      return res.status(500).json({ mensaje: 'Error al verificar usuario' });
    }
  });
}

module.exports = verificarToken;
