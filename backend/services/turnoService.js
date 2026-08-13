// Apertura/cierre de turno y movimientos de caja (ver docs/analisis-gap-cgas/06/08 Etapa 4).
// A diferencia de CGAS (Turno/Caja/Tesorería en 3 microservicios acoplados por base de
// datos compartida), acá todo vive en transacciones locales — ventaja real de ser un
// monolito, no una limitación a heredar.

const Caja = require('../models/Caja');
const Turno = require('../models/Turno');
const MovimientoCaja = require('../models/MovimientoCaja');
const Estacionamiento = require('../models/Estacionamiento');
const ErrorResponse = require('../utils/errorResponse');
const { MEDIOS_PAGO } = require('../utils/mediosPago');

// El guard real es el índice parcial único {cajaId, estado:'abierto'} del modelo Turno —
// este catch solo traduce el error de Mongo (11000) a un 409 legible.
async function abrirTurno({ cajaId, operadorId, montoInicial, session }) {
  const caja = await Caja.findOne({ _id: cajaId, activa: true }).session(session);
  if (!caja) {
    throw new ErrorResponse('Caja no encontrada o inactiva', 404);
  }
  if (typeof montoInicial !== 'number' || montoInicial < 0) {
    throw new ErrorResponse('montoInicial debe ser un número mayor o igual a 0', 400);
  }

  const cajaActualizada = await Caja.findOneAndUpdate(
    { _id: cajaId },
    { $inc: { proximoNumeroTurno: 1 } },
    { returnDocument: 'before', session }
  );
  const numero = cajaActualizada.proximoNumeroTurno;

  try {
    const [turno] = await Turno.create(
      [{ cajaId, numero, operadorId, montoInicial, estado: 'abierto' }],
      { session }
    );
    return turno;
  } catch (error) {
    if (error.code === 11000) {
      // Los dos índices únicos de Turno chocan con el mismo código. Decir siempre "ya hay un
      // turno abierto" ante una colisión de numeración manda a buscar un turno que no existe:
      // el mensaje tiene que nombrar el problema real.
      if (error.keyPattern?.numero) {
        throw new ErrorResponse(`Ya existe el turno N° ${numero} en esta caja (numeración desincronizada)`, 409);
      }
      throw new ErrorResponse('Ya existe un turno abierto para esta caja', 409);
    }
    throw error;
  }
}

async function obtenerTurnoAbierto({ cajaId, session }) {
  return Turno.findOne({ cajaId, estado: 'abierto' }).session(session);
}

async function registrarMovimiento({ turnoId, tipo, origen, medioPago, monto, motivo = '', estadiaId = null, comprobanteId = null, usuarioId, session }) {
  const turno = await Turno.findOne({ _id: turnoId, estado: 'abierto' }).session(session);
  if (!turno) {
    throw new ErrorResponse('No hay un turno abierto con ese id', 409);
  }
  if (!MEDIOS_PAGO.includes(medioPago)) {
    throw new ErrorResponse(`medioPago inválido. Debe ser uno de: ${MEDIOS_PAGO.join(', ')}`, 400);
  }
  if (typeof monto !== 'number' || monto <= 0) {
    throw new ErrorResponse('monto debe ser un número mayor a 0', 400);
  }

  const [movimiento] = await MovimientoCaja.create(
    [{ turnoId, tipo, origen, medioPago, monto, motivo, estadiaId, comprobanteId, usuarioId }],
    { session }
  );
  return movimiento;
}

// Agregaciones sobre MovimientoCaja del turno — no persistidas, se recalculan siempre
// (ver doc 06 sección 3, tabla "campos del cierre").
async function calcularResumenCierre({ turnoId, session }) {
  const turno = await Turno.findById(turnoId).session(session);
  if (!turno) {
    throw new ErrorResponse('Turno no encontrado', 404);
  }

  const movimientos = await MovimientoCaja.find({ turnoId, anulado: false }).session(session);

  const totalPorMedioPago = {};
  for (const medio of MEDIOS_PAGO) totalPorMedioPago[medio] = 0;

  let totalCobrado = 0;
  let totalEstadias = 0;
  let efectivoNeto = 0;

  for (const mov of movimientos) {
    const signo = mov.tipo === 'ingreso' ? 1 : -1;
    totalPorMedioPago[mov.medioPago] = (totalPorMedioPago[mov.medioPago] || 0) + signo * mov.monto;
    if (mov.medioPago === 'efectivo') efectivoNeto += signo * mov.monto;
    if (mov.origen === 'cobro_estadia') {
      totalCobrado += signo * mov.monto;
      if (mov.tipo === 'ingreso') totalEstadias += 1;
    }
  }

  const efectivoEsperado = turno.montoInicial + efectivoNeto;

  return {
    turno,
    montoInicial: turno.montoInicial,
    totalPorMedioPago,
    totalCobrado,
    totalEstadias,
    efectivoEsperado
  };
}

// Movimientos del turno, sin agregación de ningún tipo. La caja ciega prohíbe totales
// antes del conteo, y esta lista la consume el operador mientras opera: devuelve las filas
// y nada más. Los totales viven en calcularResumenCierre, que solo se llama al cerrar.
async function listarMovimientos({ turnoId, session }) {
  const turno = await Turno.findById(turnoId).session(session);
  if (!turno) {
    throw new ErrorResponse('Turno no encontrado', 404);
  }

  return MovimientoCaja.find({ turnoId })
    .sort({ fecha: -1 })
    .populate('usuarioId', 'nombre apellido')
    .populate('estadiaId', 'vehiculoDominio origen')
    .session(session);
}

// Contadores del turno: CANTIDADES, nunca importes. Es lo único que la Terminal y la
// pantalla de turno pueden mostrar mientras el turno está abierto sin romper la caja
// ciega — el ritmo del turno es información operativa, la recaudación no.
async function calcularContadores({ turnoId, session }) {
  const turno = await Turno.findById(turnoId).session(session);
  if (!turno) {
    throw new ErrorResponse('Turno no encontrado', 404);
  }

  const desde = turno.fechaApertura;
  const hasta = turno.fechaCierre ?? new Date();

  // La playa se cuenta por sucursal solo si la caja tiene una asignada. Con `sucursalId`
  // opcional en ambos modelos, filtrar siempre dejaría en cero las instalaciones que
  // todavía no la cargaron: se cuenta lo que hay, no lo que debería haber.
  const caja = await Caja.findById(turno.cajaId).session(session);
  const alcance = caja?.sucursalId ? { sucursalId: caja.sucursalId } : {};

  const [estadiasCobradas, ingresosPlaya, egresosPlaya] = await Promise.all([
    MovimientoCaja.countDocuments({ turnoId, origen: 'cobro_estadia', tipo: 'ingreso', anulado: false }).session(session),
    Estacionamiento.countDocuments({ ...alcance, horaInicio: { $gte: desde, $lte: hasta } }).session(session),
    Estacionamiento.countDocuments({ ...alcance, horaFin: { $gte: desde, $lte: hasta } }).session(session)
  ]);

  return { estadiasCobradas, ingresosPlaya, egresosPlaya, alcanceSucursal: Boolean(caja?.sucursalId) };
}

async function cerrarTurno({ turnoId, montoDeclaradoCierre, observacionCierre = '', cerradoPor, session }) {
  if (typeof montoDeclaradoCierre !== 'number') {
    throw new ErrorResponse('montoDeclaradoCierre es obligatorio y debe ser un número', 400);
  }

  const resumen = await calcularResumenCierre({ turnoId, session });
  if (resumen.turno.estado !== 'abierto') {
    throw new ErrorResponse('El turno no está abierto', 409);
  }

  const diferencia = montoDeclaradoCierre - resumen.efectivoEsperado;
  if (diferencia !== 0 && !observacionCierre.trim()) {
    throw new ErrorResponse('observacionCierre es obligatoria cuando hay diferencia de caja', 400);
  }

  const turno = await Turno.findOneAndUpdate(
    { _id: turnoId, estado: 'abierto' },
    {
      $set: {
        estado: 'cerrado',
        fechaCierre: new Date(),
        montoDeclaradoCierre,
        montoEsperadoCierre: resumen.efectivoEsperado,
        diferencia,
        observacionCierre,
        cerradoPor
      }
    },
    { returnDocument: 'after', session }
  );
  if (!turno) {
    throw new ErrorResponse('El turno ya no está abierto (posible cierre concurrente)', 409);
  }

  // `resumen` también trae un `turno` (el leído ANTES del cierre, todavía 'abierto',
  // sin diferencia) — va primero en el spread para que el `turno` recién cerrado
  // (después, explícito) sea el que gane, no al revés.
  return { ...resumen, turno };
}

// El diagrama de estados (doc 06 sección 4) solo permite Cerrado -> Anulado, nunca
// Abierto -> Anulado directamente ni reapertura — un turno abierto se cierra primero.
async function anularTurno({ turnoId, motivo, session }) {
  if (!motivo || !motivo.trim()) {
    throw new ErrorResponse('El motivo de anulación es obligatorio', 400);
  }
  const turno = await Turno.findOneAndUpdate(
    { _id: turnoId, estado: 'cerrado' },
    { $set: { estado: 'anulado', observacionCierre: `${motivo} (anulado)` } },
    { returnDocument: 'after', session }
  );
  if (!turno) {
    throw new ErrorResponse('Solo se puede anular un turno cerrado', 409);
  }
  return turno;
}

module.exports = {
  abrirTurno,
  obtenerTurnoAbierto,
  registrarMovimiento,
  listarMovimientos,
  calcularContadores,
  calcularResumenCierre,
  cerrarTurno,
  anularTurno
};
