import CONFIG from '../config/config.js';

const API_URL = `${CONFIG.BACKEND_URL}/api`;

const authHeaders = () => ({
  'Authorization': `Bearer ${localStorage.getItem('token')}`,
  'Content-Type': 'application/json'
});

export const listarCajas = async () => {
  const res = await fetch(`${API_URL}/cajas`, { headers: authHeaders() });
  if (!res.ok) throw new Error((await res.json()).mensaje || 'Error al listar cajas');
  return (await res.json()).cajas;
};

export const obtenerTurnoActual = async (cajaId) => {
  const res = await fetch(`${API_URL}/turnos/actual?cajaId=${cajaId}`, { headers: authHeaders() });
  if (!res.ok) throw new Error((await res.json()).mensaje || 'Error al obtener el turno actual');
  return (await res.json()).turno;
};

export const abrirTurno = async (cajaId, montoInicial) => {
  const res = await fetch(`${API_URL}/turnos/abrir`, {
    method: 'POST', headers: authHeaders(), body: JSON.stringify({ cajaId, montoInicial })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.mensaje || 'Error al abrir el turno');
  return data.turno;
};

export const registrarMovimientoManual = async (turnoId, { tipo, medioPago, monto, motivo }) => {
  const res = await fetch(`${API_URL}/turnos/${turnoId}/movimientos`, {
    method: 'POST', headers: authHeaders(), body: JSON.stringify({ tipo, medioPago, monto, motivo })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.mensaje || 'Error al registrar el movimiento');
  return data.movimiento;
};

// Las dos consultas que la caja ciega permite con el turno abierto: filas sin totales y
// cantidades sin importes. `obtenerResumenCierre` —el que sí trae plata— se llama recién
// en el paso 2 del cierre, después de que el operador declaró el conteo.
export const listarMovimientos = async (turnoId) => {
  const res = await fetch(`${API_URL}/turnos/${turnoId}/movimientos`, { headers: authHeaders() });
  if (!res.ok) throw new Error((await res.json()).mensaje || 'Error al listar los movimientos');
  return (await res.json()).movimientos;
};

export const obtenerContadores = async (turnoId) => {
  const res = await fetch(`${API_URL}/turnos/${turnoId}/contadores`, { headers: authHeaders() });
  if (!res.ok) throw new Error((await res.json()).mensaje || 'Error al obtener los contadores del turno');
  return await res.json();
};

export const listarTurnos = async ({ estado, pagina = 1, limite = 20 } = {}) => {
  const params = new URLSearchParams({ pagina: String(pagina), limite: String(limite) });
  if (estado) params.set('estado', estado);
  const res = await fetch(`${API_URL}/turnos?${params}`, { headers: authHeaders() });
  if (!res.ok) throw new Error((await res.json()).mensaje || 'Error al listar los turnos');
  return await res.json();
};

export const obtenerResumenCierre = async (turnoId) => {
  const res = await fetch(`${API_URL}/turnos/${turnoId}/resumen-cierre`, { headers: authHeaders() });
  if (!res.ok) throw new Error((await res.json()).mensaje || 'Error al obtener el resumen de cierre');
  return await res.json();
};

export const cerrarTurno = async (turnoId, { montoDeclaradoCierre, observacionCierre }) => {
  const res = await fetch(`${API_URL}/turnos/${turnoId}/cerrar`, {
    method: 'POST', headers: authHeaders(), body: JSON.stringify({ montoDeclaradoCierre, observacionCierre })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.mensaje || 'Error al cerrar el turno');
  return data;
};
