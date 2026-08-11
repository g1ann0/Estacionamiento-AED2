const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const { obtenerTransacciones } = require('../controllers/transaccionController');

// Consulta del historial de transacciones del usuario autenticado.
//
// El ingreso y el egreso ya no entran por acá: eran la tercera copia de un flujo que la
// Tarea 0.2 unificó en estadiaService, y quedaron sin llamadores. Hoy el ingreso/egreso
// entra por /api/estacionamiento (app) o /api/estadias (caja).
router.get('/', authMiddleware, obtenerTransacciones);

module.exports = router;
