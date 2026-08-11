const express = require('express');
const router = express.Router();
const {
    agregarVehiculo,
    obtenerVehiculosPorUsuario,
    eliminarVehiculo,
    modificarVehiculo
} = require('../controllers/vehiculoController');
const authMiddleware = require('../middlewares/authMiddleware');
const requireOwnership = require('../middlewares/requireOwnership');

// Agregar vehículo (dni viaja en el body; el controller valida pertenencia)
router.post('/agregar', authMiddleware, agregarVehiculo);

// Obtener vehículos de un usuario
router.get('/usuario/:dni', authMiddleware, requireOwnership('dni'), obtenerVehiculosPorUsuario);

// Eliminar vehículo
router.delete('/usuario/:dni/vehiculo/:dominio', authMiddleware, requireOwnership('dni'), eliminarVehiculo);

// Modificar vehículo
router.put('/usuario/:dni/vehiculo/:dominio', authMiddleware, requireOwnership('dni'), modificarVehiculo);

// `POST /usuario/:dni/limpiar-duplicados` se eliminó junto con el array embebido: existía solo
// para reparar los duplicados que generaba mantener el catálogo en dos lugares a la vez. Con
// una sola colección y su índice único de dominio, el problema no puede ocurrir.

module.exports = router;
