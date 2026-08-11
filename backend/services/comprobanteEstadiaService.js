// Generación del comprobante de una estadía cobrada (ver docs/analisis-gap-cgas/08 Etapa 3).
// Distinto de Factura.js/Comprobante.js, que son exclusivos de la recarga de saldo.
//
// El comprobante se numera SIEMPRE con el talonario local y se emite como 'ticket': eso es lo
// que el cliente se lleva en el momento, y no depende de que ARCA esté disponible.
//
// El estado en que nace depende de si la facturación electrónica está configurada (Etapa 6):
//
//   sin configurar  -> 'emitido'       el ticket es todo lo que hay, y es no fiscal
//   configurada     -> 'pendiente_cae' un worker le pide el CAE a ARCA después
//
// La emisión es diferida a propósito: el cobro nunca se bloquea esperando a ARCA. Ver
// services/facturacionElectronicaService.js.

const Talonario = require('../models/Talonario');
const ComprobanteEstadia = require('../models/ComprobanteEstadia');
const ConfiguracionEmpresa = require('../models/ConfiguracionEmpresa');
const ErrorResponse = require('../utils/errorResponse');

// `pendiente_cae` solo tiene sentido si hay alguien que vaya a resolverlo. Si la integración
// no está configurada, marcar comprobantes como pendientes sería dejar una cola que nadie
// atiende y una promesa que la interfaz no puede cumplir.
function estadoInicial() {
  try {
    return require('./arca').estadoIntegracion().habilitada ? 'pendiente_cae' : 'emitido';
  } catch {
    return 'emitido';
  }
}

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
      // El desglose de IVA lo calcula la emisión fiscal, cuando se sabe qué tipo de
      // comprobante corresponde según la condición del emisor. El ticket muestra el total,
      // que es lo que el cliente pagó.
      iva: { porcentaje: 0, monto: 0 },
      total: montoTotal,
      estado: estadoInicial()
    }],
    { session }
  );

  return comprobante;
}

module.exports = { generarComprobante };
