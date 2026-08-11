import CONFIG from '../config/config.js';

const API = `${CONFIG.BACKEND_URL}/api`;

const authHeaders = () => ({
  'Authorization': `Bearer ${localStorage.getItem('token')}`,
  'Content-Type': 'application/json'
});

const leer = async (res, mensajePorDefecto) => {
  const data = await res.json();
  if (!res.ok || data.success === false) throw new Error(data.mensaje || mensajePorDefecto);
  return data;
};

export const obtenerCuenta = async (dni) =>
  leer(await fetch(`${API}/usuarios/${encodeURIComponent(dni)}`, { headers: authHeaders() }), 'No pudimos cargar tu cuenta');

// El estado de un vehículo se pregunta por `/estacionamiento/estado/:dominio`. El servicio
// anterior pegaba a `/vehiculos/estado/:dominio`, que **no existe**: `routes/vehiculoEstado.js`
// nunca se montó en server.js. La app del conductor pedía ese estado en cada carga y recibía
// un 404, así que nunca podía decirle a nadie si su auto estaba adentro.
export const estadoDeVehiculo = async (dominio) => {
  const res = await fetch(`${API}/estacionamiento/estado/${encodeURIComponent(dominio)}`, { headers: authHeaders() });
  if (res.status === 404) return null;
  const data = await leer(res, 'No pudimos consultar el estado del vehículo');
  return data.estacionamiento ?? null;
};

export const agregarVehiculo = async ({ dni, dominio, tipo, marca, modelo }) =>
  leer(await fetch(`${API}/vehiculos/agregar`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ dni, dominio, tipo, marca, modelo })
  }), 'No pudimos agregar el vehículo');

export const misEstadias = async ({ pagina = 1, limite = 20 } = {}) =>
  leer(await fetch(`${API}/estadias/mias?pagina=${pagina}&limite=${limite}`, { headers: authHeaders() }), 'No pudimos cargar tu historial');

// El PDF pide el token en la cabecera, así que se trae por fetch y se entrega como blob. El
// backend verifica que el comprobante sea tuyo antes de generarlo.
export const descargarMiComprobante = async (id, nombre) => {
  const res = await fetch(`${API}/comprobantes-estadia/${id}/pdf`, { headers: authHeaders() });
  if (!res.ok) throw new Error('No pudimos generar tu comprobante');

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

export const miPerfil = async () =>
  leer(await fetch(`${API}/perfil`, { headers: authHeaders() }), 'No pudimos cargar tu perfil');

export const actualizarDatosBasicos = async (datos) =>
  leer(await fetch(`${API}/perfil/datos-basicos`, { method: 'PUT', headers: authHeaders(), body: JSON.stringify(datos) }), 'No pudimos guardar tus datos');

export const cambiarContrasena = async (datos) =>
  leer(await fetch(`${API}/perfil/cambiar-contrasena`, { method: 'PUT', headers: authHeaders(), body: JSON.stringify(datos) }), 'No pudimos cambiar tu contraseña');
