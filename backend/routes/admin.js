const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const requireRole = require('../middlewares/requireRole');
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

// Todas las rutas de este archivo son exclusivas de administradores.
router.use(authMiddleware, requireRole('admin'));

// Rutas para comprobantes
router.get('/comprobantes/pendientes', obtenerComprobantesPendientes);
router.get('/comprobantes', obtenerTodosLosComprobantes);
router.put('/comprobantes/:nroComprobante/validar', validarComprobante);
router.put('/comprobantes/:nroComprobante/rechazar', rechazarComprobante);

// Rutas para gestión de usuarios
router.get('/usuarios', obtenerTodosLosUsuarios);
router.get('/usuarios/desactivados', obtenerUsuariosDesactivados);
router.post('/usuarios/reactivar', reactivarUsuario);
router.put('/usuarios/:dni', modificarUsuario);
router.delete('/usuarios/:dni', eliminarUsuario);

// Rutas para gestión de vehículos
router.get('/vehiculos', obtenerTodosLosVehiculos);
router.post('/vehiculos', agregarVehiculoAdmin);
router.put('/vehiculos/:dominio', modificarVehiculoAdmin);
router.delete('/vehiculos/:dominio', eliminarVehiculoAdmin);

// Rutas para historial de saldos
router.get('/saldos/historial', obtenerHistorialSaldos);
router.get('/saldos/estadisticas', obtenerEstadisticasSaldos);

// Rutas para historial de vehículos
router.get('/vehiculos/historial', obtenerHistorialVehiculos);
router.get('/vehiculos/estadisticas', obtenerEstadisticasVehiculos);

// Rutas para ingresos/egresos del estacionamiento
router.get('/transacciones/ingresos', obtenerIngresos);
router.get('/transacciones/egresos', obtenerEgresos);
router.get('/transacciones/estadisticas', obtenerEstadisticasTransacciones);

// Rutas para historial de configuración de empresa
router.get('/configuracion/historial', require('../controllers/configuracionEmpresaController').obtenerHistorialConfiguracion);
router.get('/configuracion/estadisticas', require('../controllers/configuracionEmpresaController').obtenerEstadisticasConfiguracion);

module.exports = router;
