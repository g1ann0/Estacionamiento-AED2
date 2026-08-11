import CONFIG from '../config/config.js';

const API = `${CONFIG.BACKEND_URL}/api/auth`;

const json = { 'Content-Type': 'application/json' };

const leer = async (res, mensajePorDefecto) => {
  const data = await res.json();
  if (!res.ok) throw new Error(data.mensaje || mensajePorDefecto);
  return data;
};

// Todo el bloque de acceso pasa por acá. Antes cada pantalla tenía `http://localhost:3000`
// escrito a mano —registro no, pero sí las tres de contraseña—, así que el circuito de
// verificación de cuenta y el de recuperación **no funcionaban fuera de la máquina del
// desarrollador**: el usuario recibía el mail, hacía clic, y la pantalla no podía confirmar
// nada. La URL sale de config.js como en el resto del sistema.

export const registrar = async ({ dni, nombre, apellido, email }) =>
  leer(await fetch(`${API}/registrar-con-email`, {
    method: 'POST', headers: json, body: JSON.stringify({ dni, nombre, apellido, email })
  }), 'No pudimos crear tu cuenta');

export const solicitarRecuperacion = async (email) =>
  leer(await fetch(`${API}/solicitar-recuperacion`, {
    method: 'POST', headers: json, body: JSON.stringify({ email })
  }), 'No pudimos enviar el correo de recuperación');

export const validarTokenRecuperacion = async (token) =>
  leer(await fetch(`${API}/validar-recuperacion/${encodeURIComponent(token)}`), 'El enlace no es válido o ya venció');

export const restablecerPassword = async ({ token, nuevaPassword }) =>
  leer(await fetch(`${API}/restablecer-password`, {
    method: 'POST', headers: json, body: JSON.stringify({ token, nuevaPassword })
  }), 'No pudimos cambiar tu contraseña');

export const confirmarCuenta = async (token) =>
  leer(await fetch(`${API}/confirmar/${encodeURIComponent(token)}`), 'El enlace no es válido o ya venció');

export const setearPassword = async ({ dni, password, token }) =>
  leer(await fetch(`${API}/setear-password`, {
    method: 'POST', headers: json, body: JSON.stringify({ dni, password, token })
  }), 'No pudimos establecer tu contraseña');
