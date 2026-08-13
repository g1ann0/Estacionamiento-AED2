// Bloqueo de inyección de operadores de MongoDB.
//
// El problema, con nombre y apellido: los controladores arman consultas con lo que llega del
// request (`Usuario.findOne({ email })`). Si el cuerpo trae `{"email": {"$ne": null}}`, eso ya
// no es un valor: es un operador, y la consulta pasa a significar "cualquier usuario". El caso
// grave era `restablecerPassword`, donde `{"token": {"$ne": null}}` encontraba al primer
// usuario con un token de recuperación vivo y le cambiaba la contraseña — toma de cuenta sin
// saber nada de la víctima.
//
// La defensa va acá y no en cada controlador porque la superficie es toda la API: cualquier
// endpoint nuevo que arme un filtro con `req.body` queda cubierto sin acordarse de nada.
//
// Se rechaza en vez de limpiar en silencio: ningún cliente legítimo de esta API manda claves
// que empiezan con `$` o que contienen un punto, así que un request así es un ataque o un bug,
// y las dos cosas conviene que se vean.

const ErrorResponse = require('../utils/errorResponse');

const PROFUNDIDAD_MAXIMA = 8; // un JSON legítimo de esta API no anida más que esto

// `$algo` es un operador; un punto navega dentro de un subdocumento; y `campo[$ne]` es la
// forma en que llega un operador por la query string. Este último hoy no es explotable —el
// parser de query de Express 5 no anida, así que queda como una clave literal que nadie lee—
// pero se rechaza igual: la diferencia entre inofensivo y explotable es una línea de
// configuración (`app.set('query parser', 'extended')`) que alguien puede tocar mañana.
const esClavePeligrosa = (clave) => clave.startsWith('$') || clave.includes('.') || clave.includes('[$');

function revisar(valor, profundidad = 0) {
  if (valor === null || typeof valor !== 'object') return;
  if (profundidad > PROFUNDIDAD_MAXIMA) {
    throw new ErrorResponse('La estructura enviada es demasiado profunda', 400);
  }

  if (Array.isArray(valor)) {
    for (const elemento of valor) revisar(elemento, profundidad + 1);
    return;
  }

  for (const clave of Object.keys(valor)) {
    if (esClavePeligrosa(clave)) {
      throw new ErrorResponse(`Parámetro inválido: "${clave}"`, 400);
    }
    revisar(valor[clave], profundidad + 1);
  }
}

function sanitizarConsulta(req, res, next) {
  try {
    revisar(req.body);
    revisar(req.query);
    revisar(req.params);
    next();
  } catch (error) {
    next(error);
  }
}

module.exports = sanitizarConsulta;
