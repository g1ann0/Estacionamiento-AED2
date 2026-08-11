// Emisión fiscal de un comprobante de estadía — Etapa 6.
//
// EMISIÓN DIFERIDA. Es la decisión de arquitectura de esta etapa y la que nos separa de CGAS,
// que emite de forma síncrona y falla entero si ARCA no responde. CGAS factura desde una
// oficina; acá se factura en la salida de una playa con el auto esperando, así que ARCA no
// entra al camino crítico del cobro:
//
//   1. El egreso cobra, registra el movimiento de caja y emite el ticket. Siempre. Sin ARCA.
//   2. El comprobante queda en `pendiente_cae`.
//   3. Este servicio le pide el CAE a ARCA después, y reintenta si hace falta.
//
// El cliente se va con un ticket válido como constancia interna; el comprobante fiscal llega
// por mail cuando ARCA lo autoriza.

const ComprobanteEstadia = require('../models/ComprobanteEstadia');
const ConfiguracionEmpresa = require('../models/ConfiguracionEmpresa');
const auditoriaService = require('./auditoriaService');
const { clienteArca, estadoIntegracion, catalogos } = require('./arca');

const {
  CONCEPTO,
  CONDICION_IVA_RECEPTOR,
  MONEDA_PESOS,
  tipoComprobantePara,
  documentoDe,
  fechaArca,
  desglosarImportes
} = catalogos;

// ARCA convierte AAAAMMDD; el vencimiento del CAE vuelve en ese formato y hay que guardarlo
// como fecha real.
const fechaDesdeArca = (aaaammdd) => {
  const texto = String(aaaammdd ?? '');
  if (!/^\d{8}$/.test(texto)) return null;
  return new Date(`${texto.slice(0, 4)}-${texto.slice(4, 6)}-${texto.slice(6, 8)}T00:00:00-03:00`);
};

// Arma el pedido para ARCA a partir de lo que ya está guardado. No decide nada de negocio que
// no esté en la base: el importe es el que se cobró, la fecha del servicio es la de la estadía.
function construirPedido({ comprobante, estadia, configuracion }) {
  const tipoComprobanteFiscal = tipoComprobantePara(configuracion?.condicionIva);
  const importes = desglosarImportes(comprobante.total, tipoComprobanteFiscal);

  // Una estadía es un servicio, y eso obliga a informar el período. Sin las fechas, ARCA
  // rechaza el comprobante de servicios.
  const desde = estadia?.horaInicio ?? comprobante.fechaEmision;
  const hasta = estadia?.horaFin ?? comprobante.fechaEmision;

  return {
    puntoVenta: Number(comprobante.puntoVenta),
    tipoComprobante: tipoComprobanteFiscal,
    concepto: CONCEPTO.SERVICIOS,
    documento: documentoDe(comprobante.receptor),
    fecha: fechaArca(comprobante.fechaEmision),
    importes,
    moneda: MONEDA_PESOS,
    // El receptor de una playa es consumidor final salvo que aporte CUIT, cosa que hoy el
    // mostrador no pide. Cuando exista el caso, se resuelve con el dato, no con un default.
    condicionIvaReceptor: CONDICION_IVA_RECEPTOR.CONSUMIDOR_FINAL,
    periodoServicio: {
      desde: fechaArca(desde),
      hasta: fechaArca(hasta),
      // Se cobró al retirar el vehículo: el pago vence el mismo día de la emisión.
      vencimientoPago: fechaArca(comprobante.fechaEmision)
    }
  };
}

// Pide el CAE de un comprobante. Idempotente: si ya lo tiene, no vuelve a llamar a ARCA.
//
// Un CAE no se borra —se anula con nota de crédito—, así que pedir dos para el mismo
// comprobante es un problema que después hay que resolver con papeles.
async function emitirComprobante(comprobanteId) {
  const comprobante = await ComprobanteEstadia.findById(comprobanteId)
    .populate('estadiaId', 'vehiculoDominio horaInicio horaFin duracionHoras');

  if (!comprobante) throw new Error('Comprobante no encontrado');

  if (comprobante.cae) {
    return { yaEmitido: true, comprobante };
  }

  if (comprobante.estado === 'anulado') {
    throw new Error('No se puede pedir CAE de un comprobante anulado');
  }

  const estado = estadoIntegracion();
  if (!estado.habilitada) {
    throw new Error(`La facturación electrónica no está configurada: falta ${estado.faltantes.join(', ')}`);
  }

  const configuracion = await ConfiguracionEmpresa.obtenerConfiguracionActiva();
  const pedido = construirPedido({ comprobante, estadia: comprobante.estadiaId, configuracion });

  try {
    const respuesta = await clienteArca().solicitarCAE(pedido);

    comprobante.cae = respuesta.cae;
    comprobante.caeFchVto = fechaDesdeArca(respuesta.caeFchVto);
    comprobante.numeroFiscal = respuesta.numero;
    comprobante.tipoComprobanteFiscal = pedido.tipoComprobante;
    comprobante.fechaAutorizacion = new Date();
    comprobante.simulado = Boolean(respuesta.simulado);
    comprobante.observacionesArca = respuesta.observaciones ?? [];
    comprobante.erroresArca = [];
    comprobante.estado = 'emitido';
    comprobante.intentosArca += 1;
    await comprobante.save();

    await auditoriaService.registrar({
      entidad: 'ComprobanteEstadia',
      entidadId: comprobante._id,
      accion: 'cae_obtenido',
      datosNuevos: {
        cae: respuesta.cae,
        numeroFiscal: respuesta.numero,
        tipoComprobanteFiscal: pedido.tipoComprobante,
        simulado: Boolean(respuesta.simulado)
      }
    });

    return { comprobante, cae: respuesta.cae, simulado: Boolean(respuesta.simulado) };
  } catch (error) {
    // El comprobante NO se pierde ni se marca como emitido: queda con el error a la vista para
    // que el worker reintente o para que alguien lo mire. La estadía y el cobro ya están
    // firmes desde antes: nada de esto afecta la plata.
    comprobante.estado = 'error_arca';
    comprobante.erroresArca = error.erroresArca ?? [{ codigo: '', mensaje: error.message }];
    comprobante.intentosArca += 1;
    await comprobante.save();

    await auditoriaService.registrar({
      entidad: 'ComprobanteEstadia',
      entidadId: comprobante._id,
      accion: 'cae_rechazado',
      motivo: error.message,
      datosNuevos: { intentos: comprobante.intentosArca }
    });

    throw error;
  }
}

// Worker: toma los comprobantes que esperan CAE y los emite, de a uno.
//
// De a uno y no en paralelo, a propósito: ARCA numera de forma correlativa por punto de venta,
// y dos pedidos simultáneos se pisan produciendo el error 10016 que después hay que reintentar.
// La cola serializada es más rápida que la carrera.
const MAX_INTENTOS = 10;

async function procesarPendientes({ limite = 20 } = {}) {
  const pendientes = await ComprobanteEstadia.find({
    cae: null,
    estado: { $in: ['pendiente_cae', 'error_arca'] },
    intentosArca: { $lt: MAX_INTENTOS }
  })
    .sort({ fechaEmision: 1 })
    .limit(limite)
    .select('_id');

  const resultado = { procesados: 0, emitidos: 0, fallidos: 0, errores: [] };

  for (const { _id } of pendientes) {
    resultado.procesados += 1;
    try {
      await emitirComprobante(_id);
      resultado.emitidos += 1;
    } catch (error) {
      resultado.fallidos += 1;
      resultado.errores.push({ comprobanteId: String(_id), mensaje: error.message });
      // Un rechazo por datos no se arregla reintentando el resto de la cola con más ganas,
      // pero tampoco justifica frenarla: cada comprobante es independiente.
    }
  }

  return resultado;
}

module.exports = { emitirComprobante, procesarPendientes, construirPedido, fechaDesdeArca, MAX_INTENTOS };
