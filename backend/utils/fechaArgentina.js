/**
 * Utilidades para manejo de fechas en zona horaria de Argentina (UTC-3)
 */

/**
 * Obtiene la fecha y hora actual en Argentina
 * @returns {Date} Fecha ajustada a zona horaria de Argentina
 */
function obtenerFechaArgentina() {
  // Crear fecha con zona horaria de Argentina (America/Argentina/Buenos_Aires)
  const opciones = { timeZone: 'America/Argentina/Buenos_Aires' };
  const fechaStr = new Date().toLocaleString('en-US', opciones);
  return new Date(fechaStr);
}

/**
 * Convierte cualquier fecha a formato AFIP (YYYYMMDD) usando hora de Argentina
 * @param {Date} fecha - Fecha a convertir (opcional, default: ahora)
 * @returns {string} Fecha en formato AFIP
 */
function formatearFechaAFIP(fecha = null) {
  const fechaArgentina = fecha || obtenerFechaArgentina();
  const year = fechaArgentina.getFullYear();
  const month = String(fechaArgentina.getMonth() + 1).padStart(2, '0');
  const day = String(fechaArgentina.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

/**
 * Obtiene la fecha de inicio del día en Argentina (00:00:00)
 * @returns {Date}
 */
function obtenerInicioDiaArgentina() {
  const fecha = obtenerFechaArgentina();
  fecha.setHours(0, 0, 0, 0);
  return fecha;
}

/**
 * Obtiene la fecha de fin del día en Argentina (23:59:59)
 * @returns {Date}
 */
function obtenerFinDiaArgentina() {
  const fecha = obtenerFechaArgentina();
  fecha.setHours(23, 59, 59, 999);
  return fecha;
}

module.exports = {
  obtenerFechaArgentina,
  formatearFechaAFIP,
  obtenerInicioDiaArgentina,
  obtenerFinDiaArgentina
};
