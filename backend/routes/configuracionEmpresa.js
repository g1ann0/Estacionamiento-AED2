const express = require('express');
const router = express.Router();
const { 
  obtenerConfiguracion,
  actualizarConfiguracion,
  validarConfiguracionFacturacion,
  obtenerProximoNumero,
  obtenerHistorialConfiguracion,
  obtenerEstadisticasConfiguracion
} = require('../controllers/configuracionEmpresaController');
const authMiddleware = require('../middlewares/authMiddleware');

// Todas las rutas requieren autenticación de admin
router.use(authMiddleware);

// Verificar que el usuario sea admin
const verificarAdmin = (req, res, next) => {
  if (req.usuario.rol !== 'admin') {
    return res.status(403).json({
      success: false,
      mensaje: 'Acceso denegado. Solo administradores pueden gestionar la configuración de empresa.'
    });
  }
  next();
};

router.use(verificarAdmin);

// GET /api/configuracion-empresa - Obtener configuración actual
router.get('/', obtenerConfiguracion);

// PUT /api/configuracion-empresa - Actualizar configuración
router.put('/', actualizarConfiguracion);

// GET /api/configuracion-empresa/validar - Validar configuración para facturación
router.get('/validar', validarConfiguracionFacturacion);

// GET /api/configuracion-empresa/proximo-numero - Obtener próximo número de factura
router.get('/proximo-numero', obtenerProximoNumero);

// GET /api/configuracion-empresa/historial - Obtener historial de cambios
router.get('/historial', obtenerHistorialConfiguracion);

// GET /api/configuracion-empresa/estadisticas - Obtener estadísticas de cambios
router.get('/estadisticas', obtenerEstadisticasConfiguracion);

module.exports = router;
