const Transaccion = require('../models/Transaccion');

// @desc    Obtener todas las transacciones
// @route   GET /api/transacciones
// @access  Private
const obtenerTransacciones = async (req, res, next) => {
  try {
    const { id } = req.usuario;

    const transacciones = await Transaccion.find({ usuario: id })
      .populate('usuario', 'dni nombre apellido activo')
      .sort('-fechaHora');

    const transaccionesActivas = transacciones.filter(t =>
      t.usuario && t.usuario.activo === true
    );

    res.status(200).json({
      success: true,
      transacciones: transaccionesActivas
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  obtenerTransacciones
};
