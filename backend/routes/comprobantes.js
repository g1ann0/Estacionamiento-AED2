const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const {
  crearComprobante,
  obtenerComprobantes,
  obtenerComprobantePorNumero,
  generarPDFComprobante,
  aprobarComprobante
} = require('../controllers/comprobanteController');

// Rutas para comprobantes
router.get('/', authMiddleware, obtenerComprobantes);
router.post('/', authMiddleware, crearComprobante);
router.put('/:nroComprobante/aprobar', authMiddleware, aprobarComprobante); // Solo admin
router.get('/:nroComprobante/pdf', authMiddleware, generarPDFComprobante);
router.get('/:nroComprobante', authMiddleware, obtenerComprobantePorNumero);

module.exports = router;
