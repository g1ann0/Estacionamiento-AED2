const express = require('express');
const router = express.Router();
const { 
  obtenerPrecios,
  crearPrecio, 
  actualizarPrecio,
  eliminarPrecio, 
  obtenerPrecioPorTipo,
  obtenerHistorialPrecios,
  obtenerEstadisticasPrecios
} = require('../controllers/precioController');
const authMiddleware = require('../middlewares/authMiddleware');

// Middleware para verificar que el usuario es admin
const verificarAdmin = (req, res, next) => {
  if (req.usuario.rol !== 'admin') {
    return res.status(403).json({
      success: false,
      mensaje: 'Acceso denegado. Solo administradores pueden gestionar precios.'
    });
  }
  next();
};

// Obtener todos los precios (solo admin)
router.get('/', authMiddleware, verificarAdmin, obtenerPrecios);

// Crear nueva configuración de precio (solo admin)
router.post('/', authMiddleware, verificarAdmin, crearPrecio);

// Obtener precio específico por tipo de usuario (acceso público para cálculos)
router.get('/:tipoUsuario', obtenerPrecioPorTipo);

// Actualizar precio específico (solo admin)
router.put('/:tipoUsuario', authMiddleware, verificarAdmin, actualizarPrecio);

// Eliminar precio específico (solo admin)
router.delete('/:tipoUsuario', authMiddleware, verificarAdmin, eliminarPrecio);

// Obtener historial de cambios de precios (solo admin)
router.get('/historial/cambios', authMiddleware, verificarAdmin, obtenerHistorialPrecios);

// Obtener estadísticas de cambios de precios (solo admin)
router.get('/historial/estadisticas', authMiddleware, verificarAdmin, obtenerEstadisticasPrecios);

module.exports = router;
