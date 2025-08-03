// routes/auth.js
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Usuario = require('../models/Usuario'); // Importar modelo Usuario

const {
  registrarConEmail,
  confirmarEmail,
  setearPassword,
  login,
  solicitarRecuperacionPassword,
  validarTokenRecuperacion,
  restablecerPassword
} = require('../controllers/authController');

// Middleware para verificar JWT
const verificarJWT = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ mensaje: 'No se proporcionó token de acceso' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const usuario = await Usuario.findById(decoded.id).select('-password');
    
    if (!usuario) {
      return res.status(401).json({ mensaje: 'Usuario no encontrado' });
    }

    req.usuario = usuario;
    next();
  } catch (error) {
    return res.status(401).json({ mensaje: 'Token inválido o expirado' });
  }
};

// Registro con email
router.post('/registrar-con-email', registrarConEmail);

// Confirmación por token desde email
router.get('/confirmar/:token', confirmarEmail);

// Procesar formulario para setear contraseña (POST)
router.post('/setear-password', setearPassword);

// Login
router.post('/login', login);

// Solicitar recuperación de contraseña (envía email)
router.post('/solicitar-recuperacion', solicitarRecuperacionPassword);

// Validar token de recuperación
router.get('/validar-recuperacion/:token', validarTokenRecuperacion);

// Restablecer contraseña con token
router.post('/restablecer-password', restablecerPassword);

// Verificar token JWT y devolver datos del usuario
router.get('/verificar', verificarJWT, (req, res) => {
  res.json({
    mensaje: 'Token válido',
    usuario: req.usuario
  });
});

module.exports = router;
