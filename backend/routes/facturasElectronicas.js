/**
 * RUTAS DE FACTURACIÓN ELECTRÓNICA AFIP/ARCA
 * 
 * Todas las rutas están protegidas por autenticación
 * Las operaciones de creación requieren rol de administrador
 */

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const {
  crearFacturaElectronica,
  obtenerFacturasElectronicas,
  obtenerFacturaPorId,
  verificarEstadoAFIP,
  obtenerPuntosVentaAFIP,
  obtenerTiposComprobanteAFIP,
  validarCUIT
} = require('../controllers/facturaElectronicaController');

// Middleware de autenticación para todas las rutas
router.use(authMiddleware);

// ========== RUTAS DE FACTURAS ELECTRÓNICAS ==========

/**
 * POST /api/facturas-electronicas/crear
 * Crea una factura electrónica con autorización de AFIP
 * REQUISITOS: Admin, Comprobante aprobado
 */
router.post('/crear', crearFacturaElectronica);

/**
 * GET /api/facturas-electronicas
 * Obtiene todas las facturas electrónicas (con filtros y paginación)
 * Query params: page, limit, estado, desde, hasta, clienteDNI
 */
router.get('/', obtenerFacturasElectronicas);

/**
 * GET /api/facturas-electronicas/:id
 * Obtiene una factura electrónica por ID
 */
router.get('/:id', obtenerFacturaPorId);

// ========== RUTAS DE CONSULTA AFIP ==========

/**
 * GET /api/facturas-electronicas/afip/estado
 * Verifica el estado del servidor de AFIP
 */
router.get('/afip/estado', verificarEstadoAFIP);

/**
 * GET /api/facturas-electronicas/afip/puntos-venta
 * Obtiene los puntos de venta autorizados por AFIP
 */
router.get('/afip/puntos-venta', obtenerPuntosVentaAFIP);

/**
 * GET /api/facturas-electronicas/afip/tipos-comprobante
 * Obtiene los tipos de comprobante disponibles en AFIP
 */
router.get('/afip/tipos-comprobante', obtenerTiposComprobanteAFIP);

// ========== RUTAS DE UTILIDADES ==========

/**
 * POST /api/facturas-electronicas/validar-cuit
 * Valida un CUIT según normativa AFIP
 */
router.post('/validar-cuit', validarCUIT);

module.exports = router;
