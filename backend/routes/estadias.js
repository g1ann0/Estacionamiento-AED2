const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const requireRole = require('../middlewares/requireRole');
const { ingresoManual, egresoManual, listarActivas, listarHistorial, listarMias, resolverPatente, egresoExcepcion } = require('../controllers/estadiaManualController');

// El historial propio es del conductor: va antes del guard de rol y se acota por el DNI del
// token, no por un parámetro. El resto del archivo es operación de caja.
router.get('/mias', authMiddleware, listarMias);

// Ver docs/analisis-gap-cgas/07 secciones 3 y 4 para el diseño de estos endpoints.
router.use(authMiddleware, requireRole('operador', 'admin'));

router.get('/activas', listarActivas);
// Historial: lo que ya pasó, con filtros y paginación. `/activas` responde por el presente.
router.get('/historial', listarHistorial);
router.get('/resolver/:dominio', resolverPatente);
router.post('/ingreso-manual', ingresoManual);
router.post('/egreso-manual', egresoManual);
router.post('/egreso-excepcion', egresoExcepcion);

module.exports = router;
