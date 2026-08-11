const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const requireRole = require('../middlewares/requireRole');
const {
  obtenerFacturas,
  generarPDFFactura,
  anularFactura
} = require('../controllers/facturaController');

// Rutas para facturas (solo admin)
router.use(authMiddleware, requireRole('admin'));
router.get('/', obtenerFacturas);
router.get('/:nroFactura/pdf', generarPDFFactura);
router.put('/:nroFactura/anular', anularFactura);

module.exports = router;
