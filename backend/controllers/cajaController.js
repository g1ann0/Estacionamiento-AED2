const Caja = require('../models/Caja');

const crearCaja = async (req, res, next) => {
  try {
    const { nombre, sucursalId } = req.body;
    if (!nombre || !nombre.trim()) {
      return res.status(400).json({ mensaje: 'nombre es obligatorio' });
    }
    const caja = await Caja.create({ nombre, sucursalId: sucursalId || null });
    res.status(201).json({ mensaje: 'Caja creada correctamente', caja });
  } catch (error) {
    next(error);
  }
};

const listarCajas = async (req, res, next) => {
  try {
    const cajas = await Caja.find({}).populate('sucursalId', 'nombre').sort({ nombre: 1 });
    res.status(200).json({ cajas });
  } catch (error) {
    next(error);
  }
};

const actualizarCaja = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { nombre, activa, sucursalId } = req.body;

    const cambios = {};
    if (nombre !== undefined) cambios.nombre = nombre;
    if (activa !== undefined) cambios.activa = activa;
    if (sucursalId !== undefined) cambios.sucursalId = sucursalId || null;

    const caja = await Caja.findByIdAndUpdate(id, { $set: cambios }, { returnDocument: 'after' });
    if (!caja) {
      return res.status(404).json({ mensaje: 'Caja no encontrada' });
    }
    res.status(200).json({ mensaje: 'Caja actualizada correctamente', caja });
  } catch (error) {
    next(error);
  }
};

module.exports = { crearCaja, listarCajas, actualizarCaja };
