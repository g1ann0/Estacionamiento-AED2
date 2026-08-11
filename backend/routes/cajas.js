const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const requireRole = require('../middlewares/requireRole');
const { crearCaja, listarCajas, actualizarCaja } = require('../controllers/cajaController');

router.use(authMiddleware);

// Listar cajas: operador también necesita esto para elegir dónde abrir turno.
router.get('/', requireRole('operador', 'admin'), listarCajas);
router.post('/', requireRole('admin'), crearCaja);
router.put('/:id', requireRole('admin'), actualizarCaja);

module.exports = router;
