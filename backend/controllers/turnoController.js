const mongoose = require('mongoose');
const Turno = require('../models/Turno');
const turnoService = require('../services/turnoService');
const auditoriaService = require('../services/auditoriaService');
const { runInTransaction } = require('../services/txHelper');
const ErrorResponse = require('../utils/errorResponse');
const { construirFiltroDeTurnos } = require('../utils/filtroTurnos');

// El turno tiene dueño. Un operador solo opera y mira el suyo: registrar un movimiento en la
// caja de otro, o leer su resumen de cierre —que trae los importes que la caja ciega le
// oculta hasta el conteo—, sería mirar el cajón ajeno con un id en la URL. El admin sí pasa:
// es quien revisa después.
const asegurarTurnoPropio = async (turnoId, req) => {
  if (!mongoose.isValidObjectId(turnoId)) {
    throw new ErrorResponse('Turno no encontrado', 404);
  }
  const rol = req.usuarioActual?.rol ?? req.usuario?.rol;
  if (rol === 'admin') return;

  const turno = await Turno.findById(turnoId).select('operadorId');
  if (!turno) {
    throw new ErrorResponse('Turno no encontrado', 404);
  }
  if (String(turno.operadorId) !== String(req.usuarioActual._id)) {
    throw new ErrorResponse('Este turno es de otro operador', 403);
  }
};

const abrirTurno = async (req, res, next) => {
  try {
    const { cajaId, montoInicial } = req.body;
    const operadorId = req.usuarioActual._id;

    const turno = await runInTransaction((session) =>
      turnoService.abrirTurno({ cajaId, operadorId, montoInicial, session })
    );

    await auditoriaService.registrar({
      entidad: 'Turno',
      entidadId: turno._id,
      accion: 'abrir_turno',
      usuarioId: operadorId,
      usuarioDni: req.usuario.dni,
      datosNuevos: { cajaId, montoInicial, numero: turno.numero }
    });

    res.status(201).json({ mensaje: 'Turno abierto correctamente', turno });
  } catch (error) {
    next(error);
  }
};

const obtenerTurnoActual = async (req, res, next) => {
  try {
    const { cajaId } = req.query;
    if (!cajaId) {
      return res.status(400).json({ mensaje: 'cajaId es requerido' });
    }
    const turno = await turnoService.obtenerTurnoAbierto({ cajaId });
    // El panel muestra "abierto por <operador>": el turno tiene dueño y la interfaz lo
    // nombra, porque la diferencia de caja también va a tenerlo.
    const conOperador = turno ? await turno.populate('operadorId', 'nombre apellido dni') : null;
    res.status(200).json({ turno: conOperador });
  } catch (error) {
    next(error);
  }
};

const registrarMovimientoManual = async (req, res, next) => {
  try {
    const { id: turnoId } = req.params;
    const { tipo, medioPago, monto, motivo } = req.body;
    const usuarioId = req.usuarioActual._id;

    await asegurarTurnoPropio(turnoId, req);

    if (!motivo || !motivo.trim()) {
      return res.status(400).json({ mensaje: 'motivo es obligatorio para movimientos manuales' });
    }

    const movimiento = await runInTransaction((session) =>
      turnoService.registrarMovimiento({ turnoId, tipo, origen: 'manual', medioPago, monto, motivo, usuarioId, session })
    );

    await auditoriaService.registrar({
      entidad: 'MovimientoCaja',
      entidadId: movimiento._id,
      accion: 'movimiento_manual',
      usuarioId,
      usuarioDni: req.usuario.dni,
      motivo,
      datosNuevos: { turnoId, tipo, medioPago, monto }
    });

    res.status(201).json({ mensaje: 'Movimiento registrado correctamente', movimiento });
  } catch (error) {
    next(error);
  }
};

const listarMovimientos = async (req, res, next) => {
  try {
    const { id: turnoId } = req.params;
    await asegurarTurnoPropio(turnoId, req);
    const movimientos = await turnoService.listarMovimientos({ turnoId });
    res.status(200).json({ movimientos });
  } catch (error) {
    next(error);
  }
};

const contadores = async (req, res, next) => {
  try {
    const { id: turnoId } = req.params;
    await asegurarTurnoPropio(turnoId, req);
    const datos = await turnoService.calcularContadores({ turnoId });
    res.status(200).json(datos);
  } catch (error) {
    next(error);
  }
};

const resumenCierre = async (req, res, next) => {
  try {
    const { id: turnoId } = req.params;
    await asegurarTurnoPropio(turnoId, req);
    const resumen = await turnoService.calcularResumenCierre({ turnoId });
    res.status(200).json(resumen);
  } catch (error) {
    next(error);
  }
};

const cerrarTurno = async (req, res, next) => {
  try {
    const { id: turnoId } = req.params;
    const { montoDeclaradoCierre, observacionCierre } = req.body;
    const cerradoPor = req.usuarioActual._id;

    await asegurarTurnoPropio(turnoId, req);

    const resultado = await runInTransaction((session) =>
      turnoService.cerrarTurno({ turnoId, montoDeclaradoCierre, observacionCierre, cerradoPor, session })
    );

    await auditoriaService.registrar({
      entidad: 'Turno',
      entidadId: turnoId,
      accion: 'cerrar_turno',
      usuarioId: cerradoPor,
      usuarioDni: req.usuario.dni,
      datosNuevos: { montoDeclaradoCierre, diferencia: resultado.turno.diferencia }
    });

    res.status(200).json({ mensaje: 'Turno cerrado correctamente', ...resultado });
  } catch (error) {
    next(error);
  }
};

const anularTurno = async (req, res, next) => {
  try {
    const { id: turnoId } = req.params;
    const { motivo } = req.body;

    const turno = await runInTransaction((session) =>
      turnoService.anularTurno({ turnoId, motivo, session })
    );

    await auditoriaService.registrar({
      entidad: 'Turno',
      entidadId: turnoId,
      accion: 'anular_turno',
      usuarioId: req.usuarioActual._id,
      usuarioDni: req.usuario.dni,
      motivo
    });

    res.status(200).json({ mensaje: 'Turno anulado correctamente', turno });
  } catch (error) {
    next(error);
  }
};

const listarTurnos = async (req, res, next) => {
  try {
    const { cajaId, operadorId, estado, desde, hasta, pagina, limite } = req.query;
    const filtro = construirFiltroDeTurnos({ cajaId, operadorId, estado, desde, hasta });

    // Página y límite acotados: `limite=999999` en la URL convierte una pantalla paginada en
    // un volcado de la colección entera, y el costo lo paga el servidor, no quien lo pidió.
    const paginaNumero = Math.max(1, parseInt(pagina, 10) || 1);
    const limiteNumero = Math.min(100, Math.max(1, parseInt(limite, 10) || 20));
    const skip = (paginaNumero - 1) * limiteNumero;

    const [turnos, total] = await Promise.all([
      Turno.find(filtro).sort({ fechaApertura: -1 }).skip(skip).limit(limiteNumero).populate('operadorId', 'nombre apellido dni'),
      Turno.countDocuments(filtro)
    ]);

    res.status(200).json({
      turnos,
      total,
      pagina: paginaNumero,
      limite: limiteNumero,
      totalPaginas: Math.max(1, Math.ceil(total / limiteNumero))
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  abrirTurno,
  obtenerTurnoActual,
  registrarMovimientoManual,
  listarMovimientos,
  contadores,
  resumenCierre,
  cerrarTurno,
  anularTurno,
  listarTurnos
};
