const Turno = require('../models/Turno');
const turnoService = require('../services/turnoService');
const auditoriaService = require('../services/auditoriaService');
const { runInTransaction } = require('../services/txHelper');

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
    const movimientos = await turnoService.listarMovimientos({ turnoId });
    res.status(200).json({ movimientos });
  } catch (error) {
    next(error);
  }
};

const contadores = async (req, res, next) => {
  try {
    const { id: turnoId } = req.params;
    const datos = await turnoService.calcularContadores({ turnoId });
    res.status(200).json(datos);
  } catch (error) {
    next(error);
  }
};

const resumenCierre = async (req, res, next) => {
  try {
    const { id: turnoId } = req.params;
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
    const { cajaId, estado, pagina = 1, limite = 20 } = req.query;
    const filtro = {};
    if (cajaId) filtro.cajaId = cajaId;
    // Acepta uno o varios estados separados por coma: la pantalla de Cierres pide
    // "cerrado,anulado" porque un arqueo anulado es justo el que el dueño quiere revisar,
    // y filtrarlo lo haría desaparecer de la única lista donde se lo puede encontrar.
    if (estado) {
      const estados = String(estado).split(',').map((e) => e.trim()).filter(Boolean);
      filtro.estado = estados.length > 1 ? { $in: estados } : estados[0];
    }

    const skip = (parseInt(pagina) - 1) * parseInt(limite);
    const [turnos, total] = await Promise.all([
      Turno.find(filtro).sort({ fechaApertura: -1 }).skip(skip).limit(parseInt(limite)).populate('operadorId', 'nombre apellido dni'),
      Turno.countDocuments(filtro)
    ]);

    res.status(200).json({ turnos, total, pagina: parseInt(pagina), totalPaginas: Math.ceil(total / limite) });
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
