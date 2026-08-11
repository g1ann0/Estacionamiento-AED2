const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const requireRole = require('../middlewares/requireRole');
const { listar, crear, actualizar } = require('../controllers/sucursalController');

router.use(authMiddleware);

// El operador necesita leer la sucursal (capacidad, nombre); configurarla es del admin.
router.get('/', requireRole('operador', 'admin'), listar);
router.post('/', requireRole('admin'), crear);
router.put('/:id', requireRole('admin'), actualizar);

module.exports = router;
