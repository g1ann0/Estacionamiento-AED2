const express = require('express');
const router = express.Router();
const { 
    agregarVehiculo, 
    obtenerVehiculosPorUsuario,
    eliminarVehiculo,
    modificarVehiculo,
    limpiarDuplicadosVehiculos
} = require('../controllers/vehiculoController');
const authMiddleware = require('../middlewares/authMiddleware');

// Agregar vehículo
router.post('/agregar', authMiddleware, agregarVehiculo);

// Obtener vehículos de un usuario
router.get('/usuario/:dni', authMiddleware, obtenerVehiculosPorUsuario);

// Eliminar vehículo
router.delete('/usuario/:dni/vehiculo/:dominio', authMiddleware, eliminarVehiculo);

// Modificar vehículo
router.put('/usuario/:dni/vehiculo/:dominio', authMiddleware, modificarVehiculo);

// Limpiar duplicados de vehículos
router.post('/usuario/:dni/limpiar-duplicados', authMiddleware, limpiarDuplicadosVehiculos);

module.exports = router;
