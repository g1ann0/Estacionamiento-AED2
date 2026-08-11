const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const requireRole = require('../middlewares/requireRole');
const {
  abrirTurno,
  obtenerTurnoActual,
  registrarMovimientoManual,
  listarMovimientos,
  contadores,
  resumenCierre,
  cerrarTurno,
  anularTurno,
  listarTurnos
} = require('../controllers/turnoController');

router.use(authMiddleware);

// Ver docs/analisis-gap-cgas/06 sección 6 para el diseño de estos endpoints.
router.post('/abrir', requireRole('operador', 'admin'), abrirTurno);
router.get('/actual', requireRole('operador', 'admin'), obtenerTurnoActual);
router.post('/:id/movimientos', requireRole('operador', 'admin'), registrarMovimientoManual);
// Filas sin totales y cantidades sin importes: los dos endpoints que la caja ciega permite
// consultar con el turno abierto. El resumen con plata solo se pide al cerrar.
router.get('/:id/movimientos', requireRole('operador', 'admin'), listarMovimientos);
router.get('/:id/contadores', requireRole('operador', 'admin'), contadores);
router.get('/:id/resumen-cierre', requireRole('operador', 'admin'), resumenCierre);
router.post('/:id/cerrar', requireRole('operador', 'admin'), cerrarTurno);
router.post('/:id/anular', requireRole('admin'), anularTurno);
router.get('/', requireRole('admin'), listarTurnos);

module.exports = router;
