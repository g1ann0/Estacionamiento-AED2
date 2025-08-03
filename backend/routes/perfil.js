// routes/perfil.js
const express = require('express');
const router = express.Router();
const verificarToken = require('../middlewares/authMiddleware');

const {
  obtenerPerfil,
  actualizarDatosBasicos,
  cambiarContrasena
} = require('../controllers/perfilController');

// Todas las rutas requieren autenticación
router.use(verificarToken);

// Obtener datos del perfil
router.get('/', obtenerPerfil);

// Actualizar datos básicos (nombre, apellido)
router.put('/datos-basicos', actualizarDatosBasicos);

// Cambiar contraseña
router.put('/cambiar-contrasena', cambiarContrasena);

module.exports = router;
