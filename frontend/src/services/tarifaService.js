import CONFIG from '../config/config.js';

const API_URL = `${CONFIG.BACKEND_URL}/api/precios`;

// La sesión viaja en una cookie HttpOnly que el navegador adjunta sola: el token ya no está
// al alcance de este código, que es todo el punto. Solo queda declarar el tipo de contenido.
const authHeaders = () => ({ 'Content-Type': 'application/json' });

const leer = async (res, mensajePorDefecto) => {
  const data = await res.json();
  if (!res.ok || data.success === false) throw new Error(data.mensaje || mensajePorDefecto);
  return data;
};

export const listarTarifas = async () =>
  (await leer(await fetch(API_URL, { credentials: 'include', headers: authHeaders() }), 'Error al listar las tarifas')).precios;

// Devuelve la respuesta entera y no solo el precio: el backend avisa con `requiereAsignacion`
// cuando la tarifa creada no entra sola en la cascada, y ese aviso es lo más importante de
// la operación.
// El cuerpo viaja completo: además del precio, una tarifa lleva sus reglas de cobro (tipo de
// vehículo, fracción, tope diario y recargos). Enumerar los campos acá hacía que cualquier
// regla nueva se perdiera en el camino sin un solo error visible: el formulario la mostraba,
// el usuario la guardaba, y el sistema seguía cobrando como antes.
export const crearTarifa = async (tarifa) =>
  leer(await fetch(API_URL, {
    method: 'POST', credentials: 'include', headers: authHeaders(), body: JSON.stringify(tarifa)
  }), 'Error al crear la tarifa');

export const actualizarTarifa = async (tipoUsuario, tarifa) =>
  leer(await fetch(`${API_URL}/${encodeURIComponent(tipoUsuario)}`, {
    method: 'PUT', credentials: 'include', headers: authHeaders(), body: JSON.stringify(tarifa)
  }), 'Error al actualizar la tarifa');

export const eliminarTarifa = async (tipoUsuario) =>
  leer(await fetch(`${API_URL}/${encodeURIComponent(tipoUsuario)}`, {
    method: 'DELETE', credentials: 'include', headers: authHeaders()
  }), 'Error al eliminar la tarifa');

export const listarHistorialTarifas = async ({ pagina = 1, limite = 25 } = {}) => {
  const params = new URLSearchParams({ pagina: String(pagina), limite: String(limite) });
  return leer(await fetch(`${API_URL}/historial/cambios?${params}`, { credentials: 'include', headers: authHeaders() }), 'Error al listar el historial');
};
