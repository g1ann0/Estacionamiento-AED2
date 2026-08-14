const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const requireRole = require('../middlewares/requireRole');
const { listar, crear, eliminar } = require('../controllers/feriadoController');

router.use(authMiddleware);

// El operador los lee —la terminal muestra el recargo antes de cobrar y tiene que poder
// explicarlo—, pero cargarlos y borrarlos cambia lo que se le cobra a la gente: eso es del dueño.
router.get('/', requireRole('operador', 'admin'), listar);
router.post('/', requireRole('admin'), crear);
router.delete('/:fecha', requireRole('admin'), eliminar);

module.exports = router;
