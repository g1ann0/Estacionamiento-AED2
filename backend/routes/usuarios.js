const express = require('express');
const router = express.Router();
const { registrarUsuario, recargarUsuario } = require('../controllers/usuarioController');

// Alta de usuario
router.post('/registrar', registrarUsuario);

// Recarga de saldo
router.post('/recargar', recargarUsuario);

module.exports = router;
