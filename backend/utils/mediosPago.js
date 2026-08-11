// Catálogo compartido de medios de pago (ver docs/analisis-gap-cgas/05/08 Etapa 3).
// Reducido respecto al de CGAS (MedioPago/CierresTurnosCobros) — alcanza para el
// dominio del estacionamiento. Usado por Transaccion, ComprobanteEstadia, y MovimientoCaja
// (Etapa 4) para no duplicar el enum en cada schema.
const MEDIOS_PAGO = ['efectivo', 'tarjeta', 'qr_transferencia', 'saldo_prepago'];

module.exports = { MEDIOS_PAGO };
