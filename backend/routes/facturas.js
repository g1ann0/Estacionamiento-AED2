const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const {
  obtenerFacturas,
  generarPDFFactura,
  anularFactura
} = require('../controllers/facturaController');

// Rutas para facturas (solo admin)
router.get('/', authMiddleware, obtenerFacturas);
router.get('/:nroFactura/pdf', authMiddleware, generarPDFFactura);
router.put('/:nroFactura/anular', authMiddleware, anularFactura);

module.exports = router;
