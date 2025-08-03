const express = require('express');
const router = express.Router();
const {
  recargarUsuario,
  agregarVehiculo,
  registrarIngreso,
  obtenerUsuario,
  modificarVehiculo,
  eliminarVehiculo,
  obtenerTodosUsuarios,
  actualizarUsuario,
  obtenerTarifasDisponibles
} = require('../controllers/usuarioController');
const verificarToken = require('../middlewares/authMiddleware');

// Rutas específicas primero (antes de las rutas con parámetros)
router.get('/tarifas/disponibles', verificarToken, obtenerTarifasDisponibles); // Obtener tarifas

// Rutas para admin - gestión de usuarios
router.get('/', verificarToken, obtenerTodosUsuarios); // Obtener todos los usuarios
router.put('/:dni', verificarToken, actualizarUsuario); // Actualizar usuario

// Obtener datos del usuario específico (debe ir después de rutas específicas)
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
