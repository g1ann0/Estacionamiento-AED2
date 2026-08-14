import CONFIG from '../config/config.js';

const API = `${CONFIG.BACKEND_URL}/api/feriados`;

// La sesión viaja en una cookie HttpOnly que el navegador adjunta sola.
const authHeaders = () => ({ 'Content-Type': 'application/json' });

const leer = async (res, mensajePorDefecto) => {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.mensaje || mensajePorDefecto);
  return data;
};

export const listarFeriados = async (desde) =>
  (await leer(
    await fetch(`${API}${desde ? `?desde=${encodeURIComponent(desde)}` : ''}`, { credentials: 'include', headers: authHeaders() }),
    'Error al listar los feriados'
  )).feriados;

export const crearFeriado = async ({ fecha, descripcion }) =>
  leer(await fetch(API, {
    method: 'POST', credentials: 'include', headers: authHeaders(), body: JSON.stringify({ fecha, descripcion })
  }), 'No se pudo agregar el feriado');

export const eliminarFeriado = async (fecha) =>
  leer(await fetch(`${API}/${encodeURIComponent(fecha)}`, {
    method: 'DELETE', credentials: 'include', headers: authHeaders()
  }), 'No se pudo eliminar el feriado');
