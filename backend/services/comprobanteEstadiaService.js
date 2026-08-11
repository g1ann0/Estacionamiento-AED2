// Generación del comprobante de una estadía cobrada (ver docs/analisis-gap-cgas/08 Etapa 3).
// Distinto de Factura.js/Comprobante.js, que son exclusivos de la recarga de saldo.
//
// Por ahora todo comprobante se emite como 'ticket' (no fiscal, sin CAE) en estado
// 'emitido' — la decisión de alcance es ARCA real sin modo mock permanente, pero esa
// integración es Etapa 6; hasta entonces no corresponde marcar nada como 'pendiente_cae'
// porque no hay ningún proceso que vaya a resolver ese estado todavía.

const Talonario = require('../models/Talonario');
const ComprobanteEstadia = require('../models/ComprobanteEstadia');
const ConfiguracionEmpresa = require('../models/ConfiguracionEmpresa');
const ErrorResponse = require('../utils/errorResponse');

async function obtenerPuntoVenta(session) {
  const configuracion = await ConfiguracionEmpresa.findOne({ activa: true }).session(session);
  return configuracion?.puntoVenta || '00001';
}

// Reserva atómicamente el próximo número del talonario (findOneAndUpdate + $inc, un solo
// round-trip — ver el comentario de concurrencia en models/Talonario.js).
async function reservarNumero({ sucursalId, puntoVenta, tipoComprobante, session }) {
  const talonario = await Talonario.findOneAndUpdate(
    { sucursalId, puntoVenta, tipoComprobante },
    { $inc: { proximoNumero: 1 } },
    { returnDocument: 'before', session }
  );
  if (!talonario) {
    throw new ErrorResponse(
      `No hay talonario configurado para esta sucursal/punto de venta/tipo (${tipoComprobante}) — ver utils/seedData.js`,
      500
    );
  }
  return talonario.proximoNumero; // valor previo al incremento = número que se asigna ahora
}

function resolverReceptor({ usuario, clienteOcasional }) {
  if (usuario) {
    return {
      tipo: 'usuario',
      dni: usuario.dni,
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      condicionIva: 'Consumidor Final'
    };
  }
  if (clienteOcasional && (clienteOcasional.nombre || clienteOcasional.documento)) {
    return {
      tipo: 'clienteOcasional',
      dni: clienteOcasional.documento || null,
      nombre: clienteOcasional.nombre || 'Consumidor',
      apellido: 'Final',
      condicionIva: 'Consumidor Final'
    };
  }
  return { tipo: 'consumidor_final', dni: null, nombre: 'Consumidor', apellido: 'Final', condicionIva: 'Consumidor Final' };
}

async function generarComprobante({ estacionamiento, transaccion, usuario, clienteOcasional, medioPago, montoTotal, sucursalId, session }) {
  const tipoComprobante = 'ticket';
  const puntoVenta = await obtenerPuntoVenta(session);
  const numero = await reservarNumero({ sucursalId, puntoVenta, tipoComprobante, session });

  const [comprobante] = await ComprobanteEstadia.create(
    [{
      numero,
      puntoVenta,
      tipoComprobante,
      sucursalId,
      estadiaId: estacionamiento._id,
      transaccionId: transaccion._id,
      receptor: resolverReceptor({ usuario, clienteOcasional }),
      medioPago,
      subtotal: montoTotal,
      iva: { porcentaje: 0, monto: 0 },
      total: montoTotal,
      estado: 'emitido'
    }],
    { session }
  );

  return comprobante;
}

module.exports = { generarComprobante };
