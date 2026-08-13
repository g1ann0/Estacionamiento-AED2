// Filtro compartido por el histórico de cierres (`GET /api/turnos`) y por el reporte de
// diferencias (`GET /api/reportes/cierres`). Vive acá porque las dos pantallas responden la
// misma pregunta con distinto nivel de zoom —las filas y el total— y si cada una arma su
// filtro por separado, tarde o temprano muestran universos distintos bajo los mismos filtros.
//
// Un id mal formado se responde 400 y no CastError: pedir "por operador Juan" con un id que
// no es un id es un error de quien llama, no una falla del servidor.

const mongoose = require('mongoose');
const ErrorResponse = require('./errorResponse');
const { rangoDeFechas } = require('./consultas');

const ESTADOS_VALIDOS = ['abierto', 'cerrado', 'anulado'];

const objectId = (valor, campo) => {
  if (!mongoose.isValidObjectId(valor)) {
    throw new ErrorResponse(`${campo} inválido`, 400);
  }
  return new mongoose.Types.ObjectId(String(valor));
};

// El rango se aplica sobre la apertura: es la fecha con la que el dueño piensa el turno
// ("el turno del martes"), aunque haya cerrado pasada la medianoche. La interpretación en hora
// local —y el día completo para `hasta`— vive en utils/consultas.js, compartida con el resto
// de los listados con filtro de fechas.
const rangoDeApertura = ({ desde, hasta }) => rangoDeFechas({ desde, hasta }, 'apertura');

function construirFiltroDeTurnos({ cajaId, operadorId, estado, desde, hasta } = {}) {
  const filtro = {};

  if (cajaId) filtro.cajaId = objectId(cajaId, 'cajaId');
  if (operadorId) filtro.operadorId = objectId(operadorId, 'operadorId');

  // Acepta uno o varios estados separados por coma: la pantalla de Cierres pide
  // "cerrado,anulado" porque un arqueo anulado es justo el que el dueño quiere revisar,
  // y filtrarlo lo haría desaparecer de la única lista donde se lo puede encontrar.
  if (estado) {
    const estados = String(estado).split(',').map((e) => e.trim()).filter(Boolean);
    const invalido = estados.find((e) => !ESTADOS_VALIDOS.includes(e));
    if (invalido) {
      throw new ErrorResponse(`estado inválido: ${invalido}. Debe ser uno de: ${ESTADOS_VALIDOS.join(', ')}`, 400);
    }
    if (estados.length > 0) filtro.estado = estados.length > 1 ? { $in: estados } : estados[0];
  }

  const rango = rangoDeApertura({ desde, hasta });
  if (rango) filtro.fechaApertura = rango;

  return filtro;
}

module.exports = { construirFiltroDeTurnos, ESTADOS_VALIDOS };
