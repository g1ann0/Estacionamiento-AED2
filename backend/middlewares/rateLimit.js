// Límite de intentos por IP para los endpoints que no piden token: login, recuperación de
// contraseña y alta de cuenta. Sin esto, el login es un oráculo de contraseñas que se puede
// consultar miles de veces por minuto, y `solicitar-recuperacion` es un botón para inundar
// de mails la casilla de cualquier cliente cuyo email alguien conozca.
//
// Es una ventana fija en memoria, sin dependencias nuevas y sin Redis: alcanza para un
// monolito de una sola instancia, que es exactamente cómo corre este sistema. Si algún día
// hay más de un proceso detrás de un balanceador, el contador deja de ser global y hay que
// mover el estado afuera — está anotado acá para que se descubra leyendo, no depurando.
//
// Detrás de un proxy inverso (nginx, Cloudflare), `req.ip` es el proxy y el límite pasaría a
// ser global en vez de por cliente: en ese despliegue hay que activar `app.set('trust proxy')`.

const LIMPIEZA_CADA = 500; // entradas acumuladas antes de barrer las vencidas

function rateLimit({ ventanaMs, maximo, mensaje = 'Demasiados intentos. Probá de nuevo en un rato.' }) {
  const contadores = new Map();

  const limpiar = (ahora) => {
    for (const [clave, dato] of contadores) {
      if (dato.expira <= ahora) contadores.delete(clave);
    }
  };

  return (req, res, next) => {
    const ahora = Date.now();
    if (contadores.size > LIMPIEZA_CADA) limpiar(ahora);

    // La clave incluye la ruta: gastar los intentos de login pidiendo recuperaciones sería
    // dejar que un endpoint bloquee al otro.
    const clave = `${req.ip}|${req.baseUrl}${req.path}`;
    const dato = contadores.get(clave);

    if (!dato || dato.expira <= ahora) {
      contadores.set(clave, { conteo: 1, expira: ahora + ventanaMs });
      return next();
    }

    dato.conteo += 1;
    if (dato.conteo > maximo) {
      const faltan = Math.ceil((dato.expira - ahora) / 1000);
      res.setHeader('Retry-After', String(faltan));
      // 429 y un mensaje que no distingue entre "usuario inexistente" y "contraseña mala":
      // el límite no tiene que convertirse en el oráculo que vino a cerrar.
      return res.status(429).json({ mensaje });
    }

    return next();
  };
}

module.exports = rateLimit;
