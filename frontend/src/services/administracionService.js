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

const query = (params) => {
  const busqueda = new URLSearchParams();
  for (const [clave, valor] of Object.entries(params)) {
    if (valor !== undefined && valor !== null && valor !== '') busqueda.set(clave, String(valor));
  }
  return busqueda.toString();
};

// ------------------------------------------------------------------ Estadías --

export const listarHistorialEstadias = async (filtros = {}) =>
  leer(await fetch(`${API}/estadias/historial?${query(filtros)}`, { headers: authHeaders() }), 'Error al listar el historial de estadías');

export const listarActivas = async () =>
  leer(await fetch(`${API}/estadias/activas`, { headers: authHeaders() }), 'Error al listar los vehículos dentro');

// ------------------------------------------------------------------ Clientes --

// `/admin/usuarios` devuelve la colección entera, sin paginar. Es la forma que ya tiene el
// backend y para el volumen de clientes de una playa alcanza: el filtrado vive en la pantalla.
export const listarClientes = async () =>
  (await leer(await fetch(`${API}/admin/usuarios`, { headers: authHeaders() }), 'Error al listar los clientes')).usuarios;

export const actualizarCliente = async (dni, cambios) =>
  leer(await fetch(`${API}/admin/usuarios/${encodeURIComponent(dni)}`, {
    method: 'PUT', headers: authHeaders(), body: JSON.stringify(cambios)
  }), 'No se pudo actualizar el cliente');

// Rol, condición de asociado y tarifa asignada viajan por `/usuarios/:dni`, que es el que
// valida que la tarifa exista antes de asignarla. `/admin/usuarios/:dni` cubre los datos
// personales y el saldo, que son otra cosa.
export const actualizarRolYTarifa = async (dni, { rol, asociado, tarifaAsignada }) =>
  leer(await fetch(`${API}/usuarios/${encodeURIComponent(dni)}`, {
    method: 'PUT', headers: authHeaders(), body: JSON.stringify({ rol, asociado, tarifaAsignada })
  }), 'No se pudo actualizar el usuario');

export const listarTarifasAsignables = async () => {
  const res = await fetch(`${API}/usuarios/tarifas/disponibles`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Error al listar las tarifas asignables');
  return await res.json();
};

// La baja es lógica: el usuario queda `activo: false` y su historia intacta. Un cliente que
// dejó estadías, comprobantes y movimientos de caja no se puede borrar sin romper el rastro.
export const darDeBajaCliente = async (dni) =>
  leer(await fetch(`${API}/admin/usuarios/${encodeURIComponent(dni)}`, {
    method: 'DELETE', headers: authHeaders()
  }), 'No se pudo dar de baja al cliente');

export const listarClientesDeBaja = async () =>
  (await leer(await fetch(`${API}/admin/usuarios/desactivados`, { headers: authHeaders() }), 'Error al listar las bajas')).usuarios;

export const reactivarCliente = async (dni, nuevoEmail) =>
  leer(await fetch(`${API}/admin/usuarios/reactivar`, {
    method: 'POST', headers: authHeaders(), body: JSON.stringify(nuevoEmail ? { dni, nuevoEmail } : { dni })
  }), 'No se pudo reactivar al cliente');

export const listarVehiculos = async () =>
  (await leer(await fetch(`${API}/admin/vehiculos`, { headers: authHeaders() }), 'Error al listar los vehículos')).vehiculos;

// Las tres acciones sobre vehículos exigen motivo en el backend, y con razón: cambiar el
// dominio de un vehículo reescribe a qué auto apuntan las estadías que ya se cobraron.
export const crearVehiculoAdmin = async (datos) =>
  leer(await fetch(`${API}/admin/vehiculos`, { method: 'POST', headers: authHeaders(), body: JSON.stringify(datos) }), 'No se pudo agregar el vehículo');

export const actualizarVehiculoAdmin = async (dominio, datos) =>
  leer(await fetch(`${API}/admin/vehiculos/${encodeURIComponent(dominio)}`, {
    method: 'PUT', headers: authHeaders(), body: JSON.stringify(datos)
  }), 'No se pudo modificar el vehículo');

export const eliminarVehiculoAdmin = async (dominio, motivo) =>
  leer(await fetch(`${API}/admin/vehiculos/${encodeURIComponent(dominio)}`, {
    method: 'DELETE', headers: authHeaders(), body: JSON.stringify({ motivo })
  }), 'No se pudo eliminar el vehículo');

export const listarHistorialSaldos = async (filtros = {}) =>
  leer(await fetch(`${API}/admin/saldos/historial?${query(filtros)}`, { headers: authHeaders() }), 'Error al listar el historial de saldos');

// --------------------------------------------------------------- Sucursales --

export const listarSucursales = async () =>
  (await leer(await fetch(`${API}/sucursales`, { headers: authHeaders() }), 'Error al listar las sucursales')).sucursales;

export const crearSucursal = async (datos) =>
  leer(await fetch(`${API}/sucursales`, { method: 'POST', headers: authHeaders(), body: JSON.stringify(datos) }), 'No se pudo crear la sucursal');

export const actualizarSucursal = async (id, datos) =>
  leer(await fetch(`${API}/sucursales/${id}`, { method: 'PUT', headers: authHeaders(), body: JSON.stringify(datos) }), 'No se pudo actualizar la sucursal');

// -------------------------------------------------------------------- Cajas --

export const crearCaja = async (datos) =>
  leer(await fetch(`${API}/cajas`, { method: 'POST', headers: authHeaders(), body: JSON.stringify(datos) }), 'No se pudo crear la caja');

export const actualizarCaja = async (id, datos) =>
  leer(await fetch(`${API}/cajas/${id}`, { method: 'PUT', headers: authHeaders(), body: JSON.stringify(datos) }), 'No se pudo actualizar la caja');

// ----------------------------------------------------------------- Reportes --

export const reporteRecaudacion = async (rango = {}) =>
  leer(await fetch(`${API}/reportes/recaudacion?${query(rango)}`, { headers: authHeaders() }), 'Error al calcular la recaudación');

export const reporteOcupacion = async (rango = {}) =>
  leer(await fetch(`${API}/reportes/ocupacion?${query(rango)}`, { headers: authHeaders() }), 'Error al calcular la ocupación');

// Diferencias de caja acumuladas, con los mismos filtros que el histórico de cierres: la
// pantalla muestra las filas y este endpoint el total de esas mismas filas.
export const reporteCierres = async (filtros = {}) =>
  leer(await fetch(`${API}/reportes/cierres?${query(filtros)}`, { headers: authHeaders() }), 'Error al calcular las diferencias de caja');

// ---------------------------------------------------------------- Auditoría --

export const listarAuditoria = async (filtros = {}) =>
  leer(await fetch(`${API}/admin/auditoria?${query(filtros)}`, { headers: authHeaders() }), 'Error al listar la auditoría');
