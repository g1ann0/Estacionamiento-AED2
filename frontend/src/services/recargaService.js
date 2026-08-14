import CONFIG from '../config/config.js';

const API = `${CONFIG.BACKEND_URL}/api`;

// La sesión viaja en una cookie HttpOnly que el navegador adjunta sola: el token ya no está
// al alcance de este código, que es todo el punto. Solo queda declarar el tipo de contenido.
const authHeaders = () => ({ 'Content-Type': 'application/json' });

const leer = async (res, mensajePorDefecto) => {
  const data = await res.json();
  if (!res.ok || data.success === false) throw new Error(data.mensaje || mensajePorDefecto);
  return data;
};

// RECARGAS DE SALDO — funcionalidad discontinuada, en modo consulta. El alta está cerrada
// (el endpoint de creación responde 410), pero las recargas que quedaron pendientes se
// siguen pudiendo aprobar o rechazar: hay plata real esperando de un lado del circuito.
export const listarRecargas = async ({ estado, busqueda, fechaDesde, fechaHasta, pagina = 1, limite = 25 } = {}) => {
  const params = new URLSearchParams({ pagina: String(pagina), limite: String(limite) });
  if (estado) params.set('estado', estado);
  if (busqueda) params.set('busqueda', busqueda);
  if (fechaDesde) params.set('fechaDesde', fechaDesde);
  if (fechaHasta) params.set('fechaHasta', fechaHasta);
  return leer(await fetch(`${API}/admin/comprobantes?${params}`, { credentials: 'include', headers: authHeaders() }), 'Error al listar las recargas');
};

export const aprobarRecarga = async (nroComprobante) =>
  leer(await fetch(`${API}/admin/comprobantes/${encodeURIComponent(nroComprobante)}/validar`, {
    method: 'PUT', credentials: 'include', headers: authHeaders()
  }), 'No se pudo aprobar la recarga');

export const rechazarRecarga = async (nroComprobante) =>
  leer(await fetch(`${API}/admin/comprobantes/${encodeURIComponent(nroComprobante)}/rechazar`, {
    method: 'PUT', credentials: 'include', headers: authHeaders()
  }), 'No se pudo rechazar la recarga');

// FACTURAS — las de recarga de saldo. Nada que ver con el comprobante de estadía.
export const listarFacturas = async ({ estado, busqueda, fechaDesde, fechaHasta, pagina = 1, limite = 25 } = {}) => {
  const params = new URLSearchParams({ pagina: String(pagina), limite: String(limite) });
  if (estado) params.set('estado', estado);
  if (busqueda) params.set('busqueda', busqueda);
  if (fechaDesde) params.set('fechaDesde', fechaDesde);
  if (fechaHasta) params.set('fechaHasta', fechaHasta);
  return leer(await fetch(`${API}/facturas?${params}`, { credentials: 'include', headers: authHeaders() }), 'Error al listar las facturas');
};

export const anularFactura = async (nroFactura, motivo) =>
  leer(await fetch(`${API}/facturas/${encodeURIComponent(nroFactura)}/anular`, {
    method: 'PUT', credentials: 'include', headers: authHeaders(), body: JSON.stringify({ motivo })
  }), 'No se pudo anular la factura');

// El PDF pide el token en la cabecera, así que se trae por fetch y se entrega como blob.
export const descargarFactura = async (nroFactura) => {
  const res = await fetch(`${API}/facturas/${encodeURIComponent(nroFactura)}/pdf`, { credentials: 'include', headers: authHeaders() });
  if (!res.ok) throw new Error('No se pudo generar el PDF de la factura');

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = `factura_${nroFactura}.pdf`;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
