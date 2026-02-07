/**
 * RUTAS DEL FACTURADOR
 * 
 * Maneja la generación de facturas electrónicas desde comprobantes aprobados
 */

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const {
  obtenerComprobantesAprobados,
  validarCUITConAFIP,
  generarFactura,
  obtenerFacturas,
  generarPDFFactura,
  obtenerFacturaCompleta
} = require('../controllers/facturadorController');

// Middleware de autenticación para todas las rutas
router.use(authMiddleware);

// Obtener comprobantes aprobados pendientes de facturación
router.get('/comprobantes-aprobados', obtenerComprobantesAprobados);

// Validar CUIT con AFIP y obtener datos del contribuyente
router.post('/validar-cuit', validarCUITConAFIP);

// Generar factura (admin elige tipo A o B)
router.post('/generar-factura', generarFactura);

// Obtener facturas generadas con filtros
router.get('/facturas', obtenerFacturas);

// Obtener factura completa con comprobante asociado
router.get('/facturas/:nroFactura/completa', obtenerFacturaCompleta);

// Generar PDF de factura
router.get('/facturas/:nroFactura/pdf', generarPDFFactura);

module.exports = router;
