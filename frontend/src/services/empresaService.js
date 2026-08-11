import CONFIG from '../config/config.js';

const API = `${CONFIG.BACKEND_URL}/api/configuracion-empresa`;

const authHeaders = () => ({
  'Authorization': `Bearer ${localStorage.getItem('token')}`,
  'Content-Type': 'application/json'
});

const leer = async (res, mensajePorDefecto) => {
  const data = await res.json();
  if (!res.ok || data.success === false) throw new Error(data.mensaje || mensajePorDefecto);
  return data;
};

export const obtenerEmpresa = async () =>
  (await leer(await fetch(API, { headers: authHeaders() }), 'Error al obtener la configuración de empresa')).configuracion;

export const guardarEmpresa = async (datos) =>
  leer(await fetch(API, { method: 'PUT', headers: authHeaders(), body: JSON.stringify(datos) }), 'No se pudo guardar la configuración');

// El backend valida lo mismo que exigiría una emisión fiscal real. Se consulta aparte del
// guardado porque responde una pregunta distinta: no "¿se pudo guardar?" sino "¿con estos
// datos se podría facturar?".
export const validarEmpresa = async () =>
  leer(await fetch(`${API}/validar`, { headers: authHeaders() }), 'No se pudo validar la configuración');
