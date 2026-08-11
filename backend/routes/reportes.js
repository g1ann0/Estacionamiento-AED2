const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const requireRole = require('../middlewares/requireRole');
const { recaudacion, ocupacion } = require('../controllers/reporteController');

// Solo admin: acá hay recaudación agregada, que es exactamente lo que la caja ciega le
// oculta al operador mientras su turno está abierto.
router.use(authMiddleware, requireRole('admin'));

router.get('/recaudacion', recaudacion);
router.get('/ocupacion', ocupacion);

module.exports = router;
