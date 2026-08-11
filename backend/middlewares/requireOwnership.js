// Middleware de autorización por pertenencia de recurso. Permite la acción si el usuario autenticado
// es dueño del recurso (req.params[paramName] === req.usuario[paramName]) o si es admin.
// Debe usarse SIEMPRE después de authMiddleware (verificarToken).
function requireOwnership(paramName) {
  return (req, res, next) => {
    const rol = req.usuarioActual?.rol ?? req.usuario?.rol;
    if (rol === 'admin') return next();

    if (req.usuario?.[paramName] !== req.params[paramName]) {
      return res.status(403).json({ mensaje: 'No tenés permiso sobre este recurso' });
    }
    next();
  };
}

module.exports = requireOwnership;
