const express = require('express');
const router = express.Router();
const {
  recargarUsuario,
  agregarVehiculo,
  registrarIngreso,
  obtenerUsuario,
  modificarVehiculo,
  eliminarVehiculo
} = require('../controllers/usuarioController');
const verificarToken = require('../middlewares/authMiddleware');

// Obtener datos del usuario
router.get('/:dni', verificarToken, obtenerUsuario);

// Recarga de saldo
router.post('/recargar', verificarToken, recargarUsuario);

// Registro de ingreso
router.post('/ingresar', verificarToken, registrarIngreso); 

// Gestión de vehículos
router.post('/vehiculo', verificarToken, agregarVehiculo);
router.put('/vehiculo/:dominio', verificarToken, modificarVehiculo);
router.delete('/vehiculo/:dominio', verificarToken, eliminarVehiculo);

module.exports = router;
