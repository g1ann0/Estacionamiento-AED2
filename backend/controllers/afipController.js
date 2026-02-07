/**
 * CONTROLADOR DE SERVICIOS AFIP
 * 
 * Endpoints para consulta de datos fiscales y validaciones AFIP
 */

const afipPadronService = require('../services/afipPadronService');
const logger = require('../utils/logger');

/**
 * Consulta datos de un CUIT en el padrón de AFIP
 * POST /api/afip/consultar-cuit
 */
exports.consultarCUIT = async (req, res) => {
  try {
    const { cuit } = req.body;

    // Validar que se envió el CUIT
    if (!cuit) {
      logger.logWarning('⚠️  Intento de consulta sin CUIT');
      return res.status(400).json({
        success: false,
        error: 'El CUIT es requerido'
      });
    }

    // Validar formato básico
    if (!afipPadronService.validarCUIT(cuit)) {
      logger.logWarning(`⚠️  CUIT inválido recibido: ${cuit}`);
      return res.status(400).json({
        success: false,
        error: 'El CUIT ingresado no es válido'
      });
    }

    // Consultar en AFIP
    const resultado = await afipPadronService.consultarContribuyente(cuit);

    if (!resultado.success) {
      return res.status(404).json(resultado);
    }

    logger.logSuccess(`✅ CUIT ${cuit} consultado exitosamente`);
    
    res.json(resultado);

  } catch (error) {
    logger.logError('❌ Error al consultar CUIT en AFIP', error);
    res.status(500).json({
      success: false,
      error: 'Error al consultar el padrón de AFIP. Intente nuevamente.'
    });
  }
};

/**
 * Valida un CUIT sin consultar AFIP
 * POST /api/afip/validar-cuit
 */
exports.validarCUIT = async (req, res) => {
  try {
    const { cuit } = req.body;

    if (!cuit) {
      return res.status(400).json({
        success: false,
        error: 'El CUIT es requerido'
      });
    }

    const esValido = afipPadronService.validarCUIT(cuit);

    res.json({
      success: true,
      data: {
        cuit: cuit,
        valido: esValido
      }
    });

  } catch (error) {
    logger.logError('❌ Error al validar CUIT', error);
    res.status(500).json({
      success: false,
      error: 'Error al validar el CUIT'
    });
  }
};
