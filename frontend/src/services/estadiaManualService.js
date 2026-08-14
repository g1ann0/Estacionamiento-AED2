import CONFIG from '../config/config.js';

const API_URL = `${CONFIG.BACKEND_URL}/api`;

// La sesión viaja en una cookie HttpOnly que el navegador adjunta sola: el token ya no está
// al alcance de este código, que es todo el punto. Solo queda declarar el tipo de contenido.
const authHeaders = () => ({ 'Content-Type': 'application/json' });

// Los errores del backend ya vienen redactados en castellano y con la regla de negocio
// adentro ("AB123CD ya registra una estadía activa desde las 14:32", "No hay turno abierto…").
// Se propagan tal cual: reescribirlos acá los empeoraría.
const leer = async (res, mensajePorDefecto) => {
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.mensaje || mensajePorDefecto);
  return data;
};

// Un solo request contesta las cuatro preguntas que el cajero necesita antes de tocar un
// botón: ¿está adentro?, ¿el vehículo es conocido?, ¿hay cliente registrado?, ¿cuánto se
// cobra. Es lo que hace posible "un campo, dos verbos".
export const resolverPatente = async (dominio) => {
  const res = await fetch(`${API_URL}/estadias/resolver/${encodeURIComponent(dominio)}`, {
    credentials: 'include', headers: authHeaders()
  });
  return leer(res, 'No se pudo resolver la patente');
};

export const listarActivas = async () => {
  const res = await fetch(`${API_URL}/estadias/activas`, { credentials: 'include', headers: authHeaders() });
  const data = await leer(res, 'Error al listar estadías activas');
  return { activas: data.activas, ocupacion: data.ocupacion };
};

export const ingresoManual = async ({ dominio, tipoVehiculo, clienteOcasional }) => {
  const res = await fetch(`${API_URL}/estadias/ingreso-manual`, {
    method: 'POST', credentials: 'include', headers: authHeaders(),
    body: JSON.stringify({ dominio, tipoVehiculo, clienteOcasional })
  });
  return leer(res, 'Error al registrar el ingreso');
};

// Ticket perdido. El monto no viaja en el request a propósito: lo pone el servidor desde la
// configuración de la sucursal, para que no se pueda negociar en el mostrador.
export const egresoExcepcion = async ({ dominio, medioPago, motivo }) => {
  const res = await fetch(`${API_URL}/estadias/egreso-excepcion`, {
    method: 'POST', credentials: 'include', headers: authHeaders(),
    body: JSON.stringify({ dominio, medioPago, motivo })
  });
  return leer(res, 'Error al cobrar la estadía no registrada');
};

export const egresoManual = async ({ dominio, medioPago }) => {
  const res = await fetch(`${API_URL}/estadias/egreso-manual`, {
    method: 'POST', credentials: 'include', headers: authHeaders(),
    body: JSON.stringify({ dominio, medioPago })
  });
  return leer(res, 'Error al registrar el egreso');
};
