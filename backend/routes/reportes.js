const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const requireRole = require('../middlewares/requireRole');
const { recaudacion, ocupacion, cierres } = require('../controllers/reporteController');

// Solo admin: acá hay recaudación agregada, que es exactamente lo que la caja ciega le
// oculta al operador mientras su turno está abierto.
router.use(authMiddleware, requireRole('admin'));

router.get('/recaudacion', recaudacion);
router.get('/ocupacion', ocupacion);
// Diferencias de caja por operador/caja/período — el acumulado que ningún operador ve de sí
// mismo mientras opera, y que el dueño necesita ver de todos.
router.get('/cierres', cierres);

module.exports = router;
