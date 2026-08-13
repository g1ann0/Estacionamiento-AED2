// Helpers de consulta compartidos: escape de regex, paginación acotada y coerción a texto.
//
// Los tres nacen del mismo hallazgo repetido: los filtros de las pantallas de listado toman
// valores del request y los meten en la consulta tal cual. Cada uno tiene su forma de doler.

const ErrorResponse = require('./errorResponse');

// Una búsqueda por patente terminaba en `new RegExp(termino)`. Un término como `(a+)+$` es una
// expresión regular con retroceso catastrófico: el servidor se queda calculando minutos por un
// request de una línea. Escapando los metacaracteres, la búsqueda sigue siendo "contiene esto"
// y deja de ser "ejecutá este programa".
const escaparRegex = (texto) => String(texto).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Regex de "contiene", insensible a mayúsculas, sobre texto ya escapado.
const regexContiene = (texto) => new RegExp(escaparRegex(texto), 'i');

// Coerción a texto para valores que se usan como escalares en un filtro. La sanitización global
// ya rechaza los operadores; esto cubre lo que queda: un array o un número donde el modelo
// espera una cadena.
const aTexto = (valor) => (valor === undefined || valor === null ? '' : String(valor));

// Paginación con techo. Sin él, `?limite=999999` convierte cualquier listado en un volcado de
// la colección entera y el costo lo paga el servidor, no quien lo pidió. Las páginas negativas
// o NaN (`?pagina=abc` producía `skip: NaN`, que Mongo rechaza con un 500) caen en la primera.
function paginar({ pagina, limite } = {}, { porDefecto = 20, maximo = 100 } = {}) {
  const paginaNumero = Math.max(1, parseInt(pagina, 10) || 1);
  const limiteNumero = Math.min(maximo, Math.max(1, parseInt(limite, 10) || porDefecto));
  return { pagina: paginaNumero, limite: limiteNumero, salto: (paginaNumero - 1) * limiteNumero };
}

const totalPaginas = (total, limite) => Math.max(1, Math.ceil(total / limite));

// Rango de fechas de un día completo en hora local. `new Date('2026-08-11')` es medianoche UTC
// —el 10 a las 21:00 en Argentina—, así que un filtro "hasta el 11" perdía el día pedido.
const SOLO_DIA = /^\d{4}-\d{2}-\d{2}$/;
function fechaLocal(valor, campo, finDelDia = false) {
  const texto = aTexto(valor).trim();
  const fecha = SOLO_DIA.test(texto)
    ? new Date(`${texto}T${finDelDia ? '23:59:59.999' : '00:00:00.000'}`)
    : new Date(texto);
  if (Number.isNaN(fecha.getTime())) throw new ErrorResponse(`${campo} inválido`, 400);
  return fecha;
}

function rangoDeFechas({ desde, hasta }, campo = 'fecha') {
  const rango = {};
  if (desde) rango.$gte = fechaLocal(desde, `${campo} desde`, false);
  if (hasta) rango.$lte = fechaLocal(hasta, `${campo} hasta`, true);
  return Object.keys(rango).length > 0 ? rango : null;
}

// Un campo de ordenamiento que viene del request tiene que existir en el modelo: ordenar por un
// campo arbitrario es un escaneo completo sin índice, o sea un botón de lentitud a pedido.
const ordenSeguro = (campo, permitidos, porDefecto) =>
  (permitidos.includes(campo) ? campo : porDefecto);

module.exports = { escaparRegex, regexContiene, aTexto, paginar, totalPaginas, fechaLocal, rangoDeFechas, ordenSeguro };
