// Lectura y escritura de la cookie de sesión, sin dependencias nuevas.
//
// El token vivía en `localStorage` del navegador, o sea al alcance de cualquier JavaScript que
// llegue a correr en la página: un XSS no roba "una sesión", roba el token entero y opera como
// esa persona hasta que vence. Una cookie `HttpOnly` no la puede leer JavaScript — el navegador
// la manda solo, y el ataque tiene que pasar por el navegador de la víctima en vez de llevarse
// la credencial.
//
// `SameSite=Lax` es la defensa contra CSRF: el navegador no adjunta la cookie en peticiones
// que nacen en otro sitio, así que un formulario en una página cualquiera no puede disparar
// un cobro con la sesión del cajero. Los `GET` de navegación de primer nivel sí la llevan, y
// esta API no cambia estado con GET.

const NOMBRE_COOKIE = 'token';
const DOS_HORAS_MS = 2 * 60 * 60 * 1000; // igual que el `expiresIn` del JWT

// Parser mínimo: solo hace falta leer una cookie propia, no el estándar completo.
function leerCookies(cabecera = '') {
  const cookies = {};
  for (const parte of String(cabecera).split(';')) {
    const separador = parte.indexOf('=');
    if (separador < 0) continue;
    const nombre = parte.slice(0, separador).trim();
    if (!nombre) continue;
    try {
      cookies[nombre] = decodeURIComponent(parte.slice(separador + 1).trim());
    } catch {
      // Una cookie mal codificada no puede tumbar el request: se ignora.
    }
  }
  return cookies;
}

// El token puede venir por cabecera `Authorization` (scripts de verificación, integraciones)
// o por la cookie (el navegador). La cabecera gana, porque es explícita.
function tokenDelRequest(req) {
  const cabecera = req.headers?.authorization;
  if (cabecera?.startsWith('Bearer ')) {
    const token = cabecera.slice(7).trim();
    if (token) return token;
  }
  return leerCookies(req.headers?.cookie)[NOMBRE_COOKIE] || null;
}

const opcionesCookie = () => ({
  httpOnly: true,
  sameSite: 'lax',
  // `Secure` solo en producción: en desarrollo se sirve por http y el navegador la descartaría.
  secure: process.env.NODE_ENV === 'production',
  path: '/'
});

const guardarSesion = (res, token) =>
  res.cookie(NOMBRE_COOKIE, token, { ...opcionesCookie(), maxAge: DOS_HORAS_MS });

const borrarSesion = (res) => res.clearCookie(NOMBRE_COOKIE, opcionesCookie());

module.exports = { NOMBRE_COOKIE, leerCookies, tokenDelRequest, guardarSesion, borrarSesion };
