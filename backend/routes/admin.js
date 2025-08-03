const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const {
  obtenerComprobantesPendientes,
  obtenerTodosLosComprobantes,
  validarComprobante,
  rechazarComprobante,
  obtenerTodosLosUsuarios,
  obtenerUsuariosDesactivados,
  reactivarUsuario,
  obtenerTodosLosVehiculos,
  modificarUsuario,
  eliminarUsuario,
  agregarVehiculoAdmin,
  modificarVehiculoAdmin,
  eliminarVehiculoAdmin,
  obtenerHistorialSaldos,
  obtenerEstadisticasSaldos,
  obtenerHistorialVehiculos,
  obtenerEstadisticasVehiculos,
  obtenerIngresos,
  obtenerEgresos,
  obtenerEstadisticasTransacciones
} = require('../controllers/adminController');

// Rutas para comprobantes
router.get('/comprobantes/pendientes', authMiddleware, obtenerComprobantesPendientes);
router.get('/comprobantes', authMiddleware, obtenerTodosLosComprobantes);
router.put('/comprobantes/:nroComprobante/validar', authMiddleware, validarComprobante);
router.put('/comprobantes/:nroComprobante/rechazar', authMiddleware, rechazarComprobante);

// Rutas para gestión de usuarios
router.get('/usuarios', authMiddleware, obtenerTodosLosUsuarios);
router.get('/usuarios/desactivados', authMiddleware, obtenerUsuariosDesactivados);
router.post('/usuarios/reactivar', authMiddleware, reactivarUsuario);
router.put('/usuarios/:dni', authMiddleware, modificarUsuario);
router.delete('/usuarios/:dni', authMiddleware, eliminarUsuario);

// Rutas para gestión de vehículos
router.get('/vehiculos', authMiddleware, obtenerTodosLosVehiculos);
router.post('/vehiculos', authMiddleware, agregarVehiculoAdmin);
router.put('/vehiculos/:dominio', authMiddleware, modificarVehiculoAdmin);
router.delete('/vehiculos/:dominio', authMiddleware, eliminarVehiculoAdmin);

// Rutas para historial de saldos
router.get('/saldos/historial', authMiddleware, obtenerHistorialSaldos);
router.get('/saldos/estadisticas', authMiddleware, obtenerEstadisticasSaldos);

// Rutas para historial de vehículos
router.get('/vehiculos/historial', authMiddleware, obtenerHistorialVehiculos);
router.get('/vehiculos/estadisticas', authMiddleware, obtenerEstadisticasVehiculos);

// Rutas para ingresos/egresos del estacionamiento
router.get('/transacciones/ingresos', authMiddleware, obtenerIngresos);
router.get('/transacciones/egresos', authMiddleware, obtenerEgresos);
router.get('/transacciones/estadisticas', authMiddleware, obtenerEstadisticasTransacciones);

// Rutas para historial de configuración de empresa
router.get('/configuracion/historial', authMiddleware, require('../controllers/configuracionEmpresaController').obtenerHistorialConfiguracion);
router.get('/configuracion/estadisticas', authMiddleware, require('../controllers/configuracionEmpresaController').obtenerEstadisticasConfiguracion);

module.exports = router;
