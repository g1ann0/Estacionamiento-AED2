// Feriados: los días con recargo. Alta, baja y listado, nada más.
//
// El recargo en sí vive en la tarifa (`recargos.feriado.porcentaje`): acá solo se dice QUÉ días
// son feriado. Separar las dos cosas permite cambiar el porcentaje una vez sin tocar la lista,
// y cargar el calendario del año sin decidir todavía cuánto se cobra.

const Feriado = require('../models/Feriado');
const auditoriaService = require('../services/auditoriaService');
const { aTexto } = require('../utils/consultas');

const FECHA_VALIDA = /^\d{4}-\d{2}-\d{2}$/;

const listar = async (req, res, next) => {
  try {
    // Por defecto, del año en curso en adelante: la lista completa incluye años viejos que ya
    // no le sirven a nadie, y la pantalla es para cargar los que vienen.
    const desde = aTexto(req.query.desde) || `${new Date().getFullYear()}-01-01`;
    const feriados = await Feriado.find({ fecha: { $gte: desde } }).sort({ fecha: 1 }).lean();
    res.status(200).json({ feriados });
  } catch (error) {
    next(error);
  }
};

const crear = async (req, res, next) => {
  try {
    const fecha = aTexto(req.body?.fecha).trim();
    const descripcion = aTexto(req.body?.descripcion).trim();

    if (!FECHA_VALIDA.test(fecha)) {
      return res.status(400).json({ mensaje: 'La fecha debe tener el formato AAAA-MM-DD' });
    }

    const yaEstaba = await Feriado.findOne({ fecha });
    if (yaEstaba) {
      return res.status(409).json({ mensaje: `El ${fecha} ya está cargado como feriado` });
    }

    const feriado = await Feriado.create({ fecha, descripcion, creadoPor: req.usuarioActual._id });

    await auditoriaService.registrar({
      entidad: 'Feriado',
      entidadId: feriado._id,
      accion: 'feriado_alta',
      usuarioId: req.usuarioActual._id,
      usuarioDni: req.usuario.dni,
      datosNuevos: { fecha, descripcion }
    });

    res.status(201).json({ mensaje: 'Feriado agregado', feriado });
  } catch (error) {
    next(error);
  }
};

const eliminar = async (req, res, next) => {
  try {
    const feriado = await Feriado.findOneAndDelete({ fecha: aTexto(req.params.fecha).trim() });
    if (!feriado) {
      return res.status(404).json({ mensaje: 'Ese feriado no está cargado' });
    }

    await auditoriaService.registrar({
      entidad: 'Feriado',
      entidadId: feriado._id,
      accion: 'feriado_baja',
      usuarioId: req.usuarioActual._id,
      usuarioDni: req.usuario.dni,
      datosAnteriores: { fecha: feriado.fecha, descripcion: feriado.descripcion }
    });

    res.status(200).json({ mensaje: 'Feriado eliminado' });
  } catch (error) {
    next(error);
  }
};

module.exports = { listar, crear, eliminar };
