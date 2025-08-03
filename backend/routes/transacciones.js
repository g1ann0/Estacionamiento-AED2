const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const { obtenerTransacciones, crearTransaccionIngreso, registrarSalida } = require('../controllers/transaccionController');

// GET /api/transacciones
router.get('/', authMiddleware, obtenerTransacciones);

// POST /api/transacciones/ingreso
router.post('/ingreso', authMiddleware, crearTransaccionIngreso);

// PUT /api/transacciones/:transaccionId/salida
router.put('/:transaccionId/salida', authMiddleware, registrarSalida);

module.exports = router;
