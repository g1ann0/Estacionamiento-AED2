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

  // Solo entran a ARCA los que están en la cola. Un comprobante en estado `emitido` sin CAE es
  // un ticket anterior a la integración: pedirle un CAE ahora emitiría un comprobante fiscal
  // con fecha de hoy por una estadía de hace días, y un CAE no se borra — se anula con nota de
  // crédito. La interfaz ya no lo ofrece; esto lo impide aunque alguien llame al endpoint.
  if (comprobante.estado !== 'pendiente_cae' && comprobante.estado !== 'error_arca') {
    throw new Error(
      'Este comprobante se emitió como ticket antes de que la facturación electrónica estuviera ' +
      'activa: no corresponde pedirle un CAE ahora.'
    );
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

async function procesarPendientes({ limite = 20, puntoVenta } = {}) {
  const filtro = {
    cae: null,
    estado: { $in: ['pendiente_cae', 'error_arca'] },
    intentosArca: { $lt: MAX_INTENTOS }
  };
  // Acotar por punto de venta importa con más de una sucursal: cada punto de venta tiene su
  // propia correlatividad en ARCA, y mezclarlos en una misma corrida es pedir el 10016.
  if (puntoVenta) filtro.puntoVenta = puntoVenta;

  const pendientes = await ComprobanteEstadia.find(filtro)
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

// RECONCILIACIÓN — el caso feo.
//
// ARCA otorgó el CAE y la persistencia local falló: un corte de red justo después de la
// respuesta, un proceso que murió, un timeout. Para ARCA el comprobante existe y está
// autorizado; para nosotros no existe. Nadie se entera hasta que alguien cruza los números.
//
// CGAS lo resuelve con `RecuperarFacturasFaltantes` y es la parte de su diseño que más
// conviene copiar, porque el problema no se puede evitar: el CAE y el commit local no pueden
// ser atómicos, están en dos sistemas.
//
// Lo que esto NO hace es inventar datos. Cuando encuentra un comprobante autorizado que no
// tenemos, intenta vincularlo con un comprobante local que esté esperando CAE y cuyo importe
// coincida. Si no hay candidato, lo reporta como huérfano para que alguien lo mire. Fabricar
// una estadía para que los números cierren sería mentirle a la contabilidad.
async function reconciliar({ puntoVenta, tipoComprobante } = {}) {
  const configuracion = await ConfiguracionEmpresa.obtenerConfiguracionActiva();
  const pv = Number(puntoVenta ?? configuracion?.puntoVenta ?? 1);
  const tipo = tipoComprobante ?? tipoComprobantePara(configuracion?.condicionIva);

  const cliente = clienteArca();
  const ultimoEnArca = await cliente.ultimoNumeroAutorizado(pv, tipo);

  const masAlto = await ComprobanteEstadia
    .findOne({ puntoVenta: String(pv).padStart(5, '0'), tipoComprobanteFiscal: tipo, numeroFiscal: { $ne: null } })
    .sort({ numeroFiscal: -1 })
    .select('numeroFiscal');

  const ultimoLocal = masAlto?.numeroFiscal ?? 0;
  const resultado = {
    puntoVenta: pv,
    tipoComprobante: tipo,
    ultimoEnArca,
    ultimoLocal,
    faltantes: Math.max(0, ultimoEnArca - ultimoLocal),
    vinculados: [],
    huerfanos: []
  };

  if (resultado.faltantes === 0) return resultado;

  for (let numero = ultimoLocal + 1; numero <= ultimoEnArca; numero += 1) {
    // ¿Ya lo tenemos con otro número? Si aparece, no falta: se saltea.
    const yaLoTenemos = await ComprobanteEstadia.exists({
      puntoVenta: String(pv).padStart(5, '0'),
      tipoComprobanteFiscal: tipo,
      numeroFiscal: numero
    });
    if (yaLoTenemos) continue;

    const enArca = await cliente.consultarComprobante(pv, tipo, numero);
    if (!enArca) continue;

    // El candidato es un comprobante que quedó esperando y cuyo importe coincide exactamente.
    // El importe es el vínculo más confiable que tenemos: el número fiscal todavía no existía
    // de este lado cuando se cortó.
    const candidato = await ComprobanteEstadia.findOne({
      cae: null,
      estado: { $in: ['pendiente_cae', 'error_arca'] },
      total: enArca.importeTotal
    }).sort({ fechaEmision: 1 });

    if (!candidato) {
      resultado.huerfanos.push({
        numero,
        cae: enArca.cae,
        importeTotal: enArca.importeTotal,
        fecha: enArca.fecha
      });
      continue;
    }

    candidato.cae = enArca.cae;
    candidato.caeFchVto = fechaDesdeArca(enArca.caeFchVto);
    candidato.numeroFiscal = numero;
    candidato.tipoComprobanteFiscal = tipo;
    candidato.fechaAutorizacion = new Date();
    candidato.estado = 'emitido';
    candidato.erroresArca = [];
    await candidato.save();

    resultado.vinculados.push({ comprobanteId: String(candidato._id), numero, cae: enArca.cae });

    await auditoriaService.registrar({
      entidad: 'ComprobanteEstadia',
      entidadId: candidato._id,
      accion: 'cae_reconciliado',
      motivo: 'ARCA lo tenía autorizado y localmente faltaba',
      datosNuevos: { numeroFiscal: numero, cae: enArca.cae }
    });
  }

  return resultado;
}

module.exports = {
  emitirComprobante,
  procesarPendientes,
  construirPedido,
  fechaDesdeArca,
  reconciliar,
  MAX_INTENTOS
};
