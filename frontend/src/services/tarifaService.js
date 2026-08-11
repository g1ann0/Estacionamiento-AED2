import CONFIG from '../config/config.js';

const API_URL = `${CONFIG.BACKEND_URL}/api/precios`;

const authHeaders = () => ({
  'Authorization': `Bearer ${localStorage.getItem('token')}`,
  'Content-Type': 'application/json'
});

const leer = async (res, mensajePorDefecto) => {
  const data = await res.json();
  if (!res.ok || data.success === false) throw new Error(data.mensaje || mensajePorDefecto);
  return data;
};

export const listarTarifas = async () =>
  (await leer(await fetch(API_URL, { headers: authHeaders() }), 'Error al listar las tarifas')).precios;

// Devuelve la respuesta entera y no solo el precio: el backend avisa con `requiereAsignacion`
// cuando la tarifa creada no entra sola en la cascada, y ese aviso es lo más importante de
// la operación.
export const crearTarifa = async ({ tipoUsuario, precioPorHora, descripcion }) =>
  leer(await fetch(API_URL, {
    method: 'POST', headers: authHeaders(), body: JSON.stringify({ tipoUsuario, precioPorHora, descripcion })
  }), 'Error al crear la tarifa');

export const actualizarTarifa = async (tipoUsuario, { precioPorHora, descripcion, motivo }) =>
  leer(await fetch(`${API_URL}/${encodeURIComponent(tipoUsuario)}`, {
    method: 'PUT', headers: authHeaders(), body: JSON.stringify({ precioPorHora, descripcion, motivo })
  }), 'Error al actualizar la tarifa');

export const eliminarTarifa = async (tipoUsuario) =>
  leer(await fetch(`${API_URL}/${encodeURIComponent(tipoUsuario)}`, {
    method: 'DELETE', headers: authHeaders()
  }), 'Error al eliminar la tarifa');

export const listarHistorialTarifas = async ({ pagina = 1, limite = 25 } = {}) => {
  const params = new URLSearchParams({ pagina: String(pagina), limite: String(limite) });
  return leer(await fetch(`${API_URL}/historial/cambios?${params}`, { headers: authHeaders() }), 'Error al listar el historial');
};
