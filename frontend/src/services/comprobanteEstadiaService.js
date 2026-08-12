import CONFIG from '../config/config.js';

const API_URL = `${CONFIG.BACKEND_URL}/api/comprobantes-estadia`;

const authHeaders = () => ({
  'Authorization': `Bearer ${localStorage.getItem('token')}`,
  'Content-Type': 'application/json'
});

export const listarComprobantes = async ({ desde, hasta, medioPago, estado, q, pagina = 1, limite = 25 } = {}) => {
  const params = new URLSearchParams({ pagina: String(pagina), limite: String(limite) });
  if (desde) params.set('desde', desde);
  if (hasta) params.set('hasta', hasta);
  if (medioPago) params.set('medioPago', medioPago);
  if (estado) params.set('estado', estado);
  if (q) params.set('q', q);

  const res = await fetch(`${API_URL}?${params}`, { headers: authHeaders() });
  if (!res.ok) throw new Error((await res.json()).mensaje || 'Error al listar los comprobantes');
  return await res.json();
};

// La descarga no puede ser un <a href> suelto: el endpoint pide el token en la cabecera, así
// que el PDF se trae por fetch y se entrega como blob. El object URL se revoca en cuanto el
// navegador tomó el archivo — si no, cada descarga deja el PDF entero retenido en memoria.
export const descargarComprobante = async (id, nombre) => {
  const res = await fetch(`${API_URL}/${id}/pdf`, { headers: authHeaders() });
  if (!res.ok) throw new Error('No se pudo generar el PDF del comprobante');

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

// Estado de la facturación electrónica: si está configurada, en qué ambiente, y cuántos
// comprobantes esperan CAE o quedaron con error. La emisión es diferida, así que esa cola
// existe siempre — lo que no puede pasar es que crezca sin que nadie la vea.
export const estadoFiscal = async () => {
  const res = await fetch(`${API_URL}/fiscal/estado`, { headers: authHeaders() });
  if (!res.ok) throw new Error((await res.json()).mensaje || 'No se pudo consultar el estado fiscal');
  return await res.json();
};

export const reintentarCae = async (id) => {
  const res = await fetch(`${API_URL}/${id}/reintentar-cae`, { method: 'POST', headers: authHeaders() });
  const data = await res.json();
  // 409 es un rechazo de ARCA, no una falla del sistema: el mensaje es para leer.
  if (!res.ok) throw new Error(data.mensaje || 'ARCA no autorizó el comprobante');
  return data;
};

export const enviarComprobante = async (id, email) => {
  const res = await fetch(`${API_URL}/${id}/enviar`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(email ? { email } : {})
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.mensaje || 'No se pudo enviar el comprobante');
  return data;
};
