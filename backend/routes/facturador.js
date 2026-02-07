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
  obtenerFacturaCompleta,
  obtenerFacturasAnulables,
  obtenerHistorialCompleto,
  generarNotaCredito
} = require('../controllers/facturadorController');

// Middleware de autenticación para todas las rutas
router.use(authMiddleware);

// Obtener comprobantes aprobados pendientes de facturación
router.get('/comprobantes-aprobados', obtenerComprobantesAprobados);

// Validar CUIT con AFIP y obtener datos del contribuyente
router.post('/validar-cuit', validarCUITConAFIP);

// Generar factura (admin elige tipo A o B)
router.post('/generar-factura', generarFactura);

// Generar nota de crédito para anular factura
router.post('/generar-nota-credito', generarNotaCredito);

// Obtener facturas generadas con filtros
router.get('/facturas', obtenerFacturas);

// Obtener facturas anulables (últimos 15 días)
router.get('/facturas-anulables', obtenerFacturasAnulables);

// Obtener historial completo (facturas y notas de crédito)
router.get('/historial-completo', obtenerHistorialCompleto);

// Obtener factura completa con comprobante asociado
router.get('/facturas/:nroFactura/completa', obtenerFacturaCompleta);

// Generar PDF de factura o nota de crédito
router.get('/facturas/:nroFactura/pdf', generarPDFFactura);

// Alias para notas de crédito (usa el mismo endpoint)
router.get('/notas-credito/:nroFactura/pdf', generarPDFFactura);

module.exports = router;
