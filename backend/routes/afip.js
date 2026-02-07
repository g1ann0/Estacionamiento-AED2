/**
 * RUTAS DE SERVICIOS AFIP
 * 
 * Endpoints para consulta de padrón y validaciones fiscales
 */

const express = require('express');
const router = express.Router();
const afipController = require('../controllers/afipController');
const verificarToken = require('../middlewares/authMiddleware');

/**
 * POST /api/afip/consultar-cuit
 * Consulta datos de un CUIT en el padrón de AFIP
 * Requiere autenticación
 */
router.post('/consultar-cuit', verificarToken, afipController.consultarCUIT);

/**
 * POST /api/afip/validar-cuit
 * Valida formato de CUIT (sin consultar AFIP)
 */
router.post('/validar-cuit', afipController.validarCUIT);

module.exports = router;
