// Sucursales. El modelo existía desde la Etapa 2 y sostiene decisiones que ya están en
// producción —capacidad de la playa y tarifa de excepción— pero NO tenía ninguna API: los dos
// valores solo se podían cambiar entrando a la base a mano.
//
// Sin capacidad, la Terminal no puede decir "32 de 40" ni detectar playa completa. Sin tarifa
// de excepción, el cobro de ticket perdido queda deshabilitado. Que eso dependa de un acceso
// a Mongo es lo que esta ruta viene a arreglar.

const Sucursal = require('../models/Sucursal');
const auditoriaService = require('../services/auditoriaService');

// `null` es un valor con significado en los dos campos: capacidad sin definir se muestra sin
// denominador, y tarifa de excepción sin definir deshabilita el flujo. Por eso el vacío se
// guarda como null y no se convierte en 0, que significaría "cobrar cero".
const numeroONulo = (valor) => {
  if (valor === '' || valor === null || valor === undefined) return null;
  const numero = Number(valor);
  return Number.isFinite(numero) && numero >= 0 ? numero : null;
};

const listar = async (req, res, next) => {
  try {
    const sucursales = await Sucursal.find().sort({ esPrincipal: -1, nombre: 1 }).lean();
    res.status(200).json({ sucursales });
  } catch (error) {
    next(error);
  }
};

const crear = async (req, res, next) => {
  try {
    const { nombre, direccion = '', capacidad = {}, tarifaExcepcion } = req.body;
    if (!nombre?.trim()) {
      return res.status(400).json({ mensaje: 'El nombre de la sucursal es obligatorio' });
    }

    const sucursal = await Sucursal.create({
      nombre: nombre.trim(),
      direccion: direccion.trim(),
      capacidad: {
        total: numeroONulo(capacidad.total),
        auto: numeroONulo(capacidad.auto),
        moto: numeroONulo(capacidad.moto)
      },
      tarifaExcepcion: numeroONulo(tarifaExcepcion)
    });

    await auditoriaService.registrar({
      entidad: 'Sucursal',
      entidadId: sucursal._id,
      accion: 'sucursal_creacion',
      usuarioId: req.usuarioActual?._id,
      usuarioDni: req.usuario?.dni,
      datosNuevos: { nombre: sucursal.nombre, capacidad: sucursal.capacidad, tarifaExcepcion: sucursal.tarifaExcepcion }
    });

    res.status(201).json({ mensaje: 'Sucursal creada', sucursal });
  } catch (error) {
    next(error);
  }
};

const actualizar = async (req, res, next) => {
  try {
    const anterior = await Sucursal.findById(req.params.id).lean();
    if (!anterior) return res.status(404).json({ mensaje: 'Sucursal no encontrada' });

    const { nombre, direccion, activa, capacidad, tarifaExcepcion } = req.body;
    const cambios = {};
    if (nombre !== undefined) cambios.nombre = String(nombre).trim();
    if (direccion !== undefined) cambios.direccion = String(direccion).trim();
    if (activa !== undefined) cambios.activa = Boolean(activa);
    if (capacidad !== undefined) {
      cambios.capacidad = {
        total: numeroONulo(capacidad.total),
        auto: numeroONulo(capacidad.auto),
        moto: numeroONulo(capacidad.moto)
      };
    }
    if (tarifaExcepcion !== undefined) cambios.tarifaExcepcion = numeroONulo(tarifaExcepcion);

    const sucursal = await Sucursal.findByIdAndUpdate(req.params.id, { $set: cambios }, { returnDocument: 'after' });

    // La capacidad y la tarifa de excepción cambian lo que el sistema cobra y lo que muestra
    // en la playa: el rastro guarda el antes y el después, no solo que "alguien editó".
    await auditoriaService.registrar({
      entidad: 'Sucursal',
      entidadId: sucursal._id,
      accion: 'sucursal_modificacion',
      usuarioId: req.usuarioActual?._id,
      usuarioDni: req.usuario?.dni,
      datosAnteriores: { capacidad: anterior.capacidad, tarifaExcepcion: anterior.tarifaExcepcion, nombre: anterior.nombre },
      datosNuevos: { capacidad: sucursal.capacidad, tarifaExcepcion: sucursal.tarifaExcepcion, nombre: sucursal.nombre },
      motivo: req.body?.motivo ?? ''
    });

    res.status(200).json({ mensaje: 'Sucursal actualizada', sucursal });
  } catch (error) {
    next(error);
  }
};

module.exports = { listar, crear, actualizar };
