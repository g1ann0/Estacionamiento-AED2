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
  restablecerPassword,
  logout
} = require('../controllers/authController');

const rateLimit = require('../middlewares/rateLimit');
const { tokenDelRequest } = require('../middlewares/cookies');

// Los tres límites de la superficie sin token. Los números son de mostrador, no de laboratorio:
// un cajero que se equivoca de contraseña tres veces seguidas sigue entrando al cuarto intento,
// y quien prueba diez mil se queda afuera. `RATE_LIMIT_OFF=true` los apaga en desarrollo y en
// los scripts de verificación, que hacen decenas de logins seguidos a propósito.
const apagado = process.env.RATE_LIMIT_OFF === 'true';
const limite = (opciones) => (apagado ? (req, res, next) => next() : rateLimit(opciones));

const limiteLogin = limite({
  ventanaMs: 15 * 60 * 1000,
  maximo: 20,
  mensaje: 'Demasiados intentos de acceso. Esperá unos minutos antes de volver a probar.'
});

// El envío de mail se limita más fuerte: cada request le cuesta un correo a un tercero.
const limiteMail = limite({
  ventanaMs: 60 * 60 * 1000,
  maximo: 5,
  mensaje: 'Demasiadas solicitudes seguidas. Revisá tu casilla y esperá una hora antes de pedir otro correo.'
});

const limiteToken = limite({
  ventanaMs: 15 * 60 * 1000,
  maximo: 20,
  mensaje: 'Demasiados intentos. Esperá unos minutos antes de volver a probar.'
});

// Middleware para verificar JWT
const verificarJWT = async (req, res, next) => {
  // Cabecera o cookie de sesión, igual que el middleware principal.
  const token = tokenDelRequest(req);
  
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
router.post('/registrar-con-email', limiteMail, registrarConEmail);

// Confirmación por token desde email
router.get('/confirmar/:token', confirmarEmail);

// Procesar formulario para setear contraseña (POST)
router.post('/setear-password', limiteToken, setearPassword);

// Login
router.post('/login', limiteLogin, login);

// Cerrar sesión: borra la cookie. No pide token — si la sesión ya venció, "salir" tiene que
// funcionar igual, no devolver un 401 y dejar la cookie puesta.
router.post('/logout', logout);

// Solicitar recuperación de contraseña (envía email)
router.post('/solicitar-recuperacion', limiteMail, solicitarRecuperacionPassword);

// Validar token de recuperación
router.get('/validar-recuperacion/:token', limiteToken, validarTokenRecuperacion);

// Restablecer contraseña con token
router.post('/restablecer-password', limiteToken, restablecerPassword);

// Verificar token JWT y devolver datos del usuario
router.get('/verificar', verificarJWT, (req, res) => {
  res.json({
    mensaje: 'Token válido',
    usuario: req.usuario
  });
});

module.exports = router;
