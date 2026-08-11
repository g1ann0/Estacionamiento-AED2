// Middleware de autorización por rol. Debe usarse SIEMPRE después de authMiddleware (verificarToken).
function requireRole(...rolesPermitidos) {
  return (req, res, next) => {
    const rol = req.usuarioActual?.rol ?? req.usuario?.rol;
    if (!rolesPermitidos.includes(rol)) {
      return res.status(403).json({ mensaje: 'Acceso denegado. Rol insuficiente.' });
    }
    next();
  };
}

module.exports = requireRole;
