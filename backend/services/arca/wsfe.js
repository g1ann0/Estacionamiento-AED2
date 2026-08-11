// WSFE — emisión de comprobantes electrónicos.
//
// Dos operaciones y una regla que las gobierna:
//
//   FECompUltimoAutorizado  ¿cuál fue el último número que autorizaste?
//   FECAESolicitar          autorizame el siguiente
//
// **El número lo pone ARCA, no nosotros.** Se pregunta cuál fue el último y se emite el
// siguiente. El talonario local sigue numerando los tickets no fiscales, pero para un
// comprobante fiscal la fuente de verdad está del otro lado. Es lo que hace CGAS y es la
// única forma de no romper la correlatividad.
//
// Los reintentos están diferenciados por tipo de error, copiando lo que CGAS aprendió en
// producción (ver docs/analisis-gap-cgas/04, sección 4). El detalle que importa del error
// 10016: no se arregla esperando y reintentando con el mismo número — hay que volver a
// preguntar cuál es el último, porque el motivo probable es que otro proceso facturó mientras
// tanto.

const soap = require('soap');
const { leerConfig } = require('./config');
const { obtenerTicket } = require('./wsaa');

// Códigos de error de ARCA que valen un reintento. El resto son errores de datos: reintentar
// con los mismos datos daría el mismo rechazo.
const ERROR_CORRELATIVIDAD = '10016';
const ERROR_BD_INTERNA = '502';

const REINTENTOS = {
  [ERROR_CORRELATIVIDAD]: 10,
  [ERROR_BD_INTERNA]: 5,
  conectividad: 3
};

const DEMORA_BASE_MS = 50;
const DEMORA_MAXIMA_MS = 2000;

// Backoff exponencial con jitter. El jitter existe para que dos cajas que fallan en el mismo
// segundo no reintenten en el mismo segundo.
const demoraPara = (intento) => {
  const exponencial = Math.min(DEMORA_BASE_MS * 2 ** intento, DEMORA_MAXIMA_MS);
  return Math.floor(exponencial / 2 + Math.random() * (exponencial / 2));
};

const esperar = (ms) => new Promise((resolver) => setTimeout(resolver, ms));

const esErrorDeRed = (error) => /ECONNRESET|ETIMEDOUT|ENOTFOUND|EPROTO|socket hang up|network/i.test(
  error?.code || error?.message || ''
);

let clienteCache = null;

const obtenerCliente = async () => {
  if (clienteCache) return clienteCache;
  const config = leerConfig();
  clienteCache = await soap.createClientAsync(config.urls.wsfe);
  return clienteCache;
};

const olvidarCliente = () => { clienteCache = null; };

// Todas las llamadas al WSFE llevan la misma autenticación: token y sign del WSAA más el CUIT.
const construirAuth = async () => {
  const config = leerConfig();
  const ticket = await obtenerTicket();
  return { Token: ticket.token, Sign: ticket.sign, Cuit: Number(config.cuit) };
};

const listaDe = (nodo) => {
  if (!nodo) return [];
  const valores = nodo.Err ?? nodo.Obs ?? nodo;
  return Array.isArray(valores) ? valores : [valores];
};

const formatearErrores = (nodo) =>
  listaDe(nodo).map((e) => ({ codigo: String(e?.Code ?? e?.code ?? ''), mensaje: e?.Msg ?? e?.msg ?? '' }));

// Envuelve una llamada SOAP con reintentos por fallo de red. Los errores de negocio de ARCA
// no pasan por acá: vienen dentro de una respuesta exitosa.
const conReintentosDeRed = async (operacion, nombre) => {
  let ultimoError;
  for (let intento = 0; intento < REINTENTOS.conectividad; intento += 1) {
    try {
      return await operacion();
    } catch (error) {
      if (!esErrorDeRed(error)) throw error;
      ultimoError = error;
      olvidarCliente();
      if (intento < REINTENTOS.conectividad - 1) await esperar(2000 * (intento + 1));
    }
  }
  throw new Error(`No se pudo contactar a ARCA en ${nombre}: ${ultimoError?.message ?? 'error de red'}`);
};

// ¿Cuál fue el último número autorizado para este punto de venta y tipo de comprobante?
async function ultimoNumeroAutorizado(puntoVenta, tipoComprobante) {
  const auth = await construirAuth();
  const cliente = await obtenerCliente();

  const [respuesta] = await conReintentosDeRed(
    () => cliente.FECompUltimoAutorizadoAsync({ Auth: auth, PtoVta: puntoVenta, CbteTipo: tipoComprobante }),
    'FECompUltimoAutorizado'
  );

  const resultado = respuesta?.FECompUltimoAutorizadoResult;
  const errores = formatearErrores(resultado?.Errors);
  if (errores.length) {
    throw new Error(`ARCA rechazó la consulta del último número: ${errores.map((e) => `(${e.codigo}) ${e.mensaje}`).join(', ')}`);
  }

  return Number(resultado?.CbteNro ?? 0);
}

// Pide el CAE para un comprobante. `datos` ya viene armado por el servicio de facturación:
// esta función no decide importes ni tipos, solo habla con ARCA.
//
// Devuelve { cae, caeFchVto, numero, observaciones } o lanza con el detalle del rechazo.
async function solicitarCAE(datos) {
  const { puntoVenta, tipoComprobante } = datos;
  let ultimoError = null;

  for (let intento = 0; intento < REINTENTOS[ERROR_CORRELATIVIDAD]; intento += 1) {
    // El número se vuelve a pedir en CADA intento. Ese es el punto: si el rechazo fue por
    // correlatividad, el número correcto cambió mientras esperábamos.
    const numero = (await ultimoNumeroAutorizado(puntoVenta, tipoComprobante)) + 1;

    const auth = await construirAuth();
    const cliente = await obtenerCliente();

    const detalle = {
      Concepto: datos.concepto,
      DocTipo: datos.documento.tipo,
      DocNro: datos.documento.numero,
      CbteDesde: numero,
      CbteHasta: numero,
      CbteFch: datos.fecha,
      ImpTotal: datos.importes.impTotal,
      ImpTotConc: 0,
      ImpNeto: datos.importes.impNeto,
      ImpOpEx: 0,
      ImpIVA: datos.importes.impIVA,
      ImpTrib: 0,
      MonId: datos.moneda,
      MonCotiz: 1,
      CondicionIVAReceptorId: datos.condicionIvaReceptor
    };

    // Un comprobante de servicios obliga a informar el período y el vencimiento de pago.
    if (datos.periodoServicio) {
      detalle.FchServDesde = datos.periodoServicio.desde;
      detalle.FchServHasta = datos.periodoServicio.hasta;
      detalle.FchVtoPago = datos.periodoServicio.vencimientoPago;
    }

    if (datos.importes.iva?.length) {
      detalle.Iva = { AlicIva: datos.importes.iva };
    }

    const pedido = {
      Auth: auth,
      FeCAEReq: {
        FeCabReq: { CantReg: 1, PtoVta: puntoVenta, CbteTipo: tipoComprobante },
        FeDetReq: { FECAEDetRequest: detalle }
      }
    };

    const [respuesta] = await conReintentosDeRed(
      () => cliente.FECAESolicitarAsync(pedido),
      'FECAESolicitar'
    );

    const resultado = respuesta?.FECAESolicitarResult;
    const erroresGenerales = formatearErrores(resultado?.Errors);
    const cabecera = resultado?.FeCabResp;
    const detalleRespuesta = resultado?.FeDetResp?.FECAEDetResponse ?? resultado?.FeDetResp;
    const registro = Array.isArray(detalleRespuesta) ? detalleRespuesta[0] : detalleRespuesta;

    const observaciones = formatearErrores(registro?.Observaciones);
    const todos = [...erroresGenerales, ...observaciones];
    const recuperable = todos.find((e) => e.codigo === ERROR_CORRELATIVIDAD || e.codigo === ERROR_BD_INTERNA);

    // Resultado 'A' = aprobado, 'R' = rechazado, 'P' = parcial.
    if (cabecera?.Resultado === 'A' && registro?.CAE) {
      return {
        cae: String(registro.CAE),
        caeFchVto: String(registro.CAEFchVto ?? ''),
        numero,
        // Las observaciones no impiden la emisión, pero se guardan: ARCA avisa por acá cosas
        // que conviene mirar antes de que se vuelvan un rechazo.
        observaciones
      };
    }

    if (recuperable && intento < REINTENTOS[ERROR_CORRELATIVIDAD] - 1) {
      ultimoError = todos;
      await esperar(demoraPara(intento));
      continue;
    }

    const descripcion = todos.length
      ? todos.map((e) => `(${e.codigo}) ${e.mensaje}`).join(', ')
      : `ARCA respondió "${cabecera?.Resultado ?? 'sin resultado'}" sin detalle`;

    const error = new Error(`ARCA no autorizó el comprobante: ${descripcion}`);
    error.erroresArca = todos;
    error.rechazadoPorArca = true;
    throw error;
  }

  const error = new Error(
    `ARCA rechazó el comprobante por correlatividad después de ${REINTENTOS[ERROR_CORRELATIVIDAD]} intentos: ` +
    (ultimoError ?? []).map((e) => `(${e.codigo}) ${e.mensaje}`).join(', ')
  );
  error.erroresArca = ultimoError ?? [];
  error.rechazadoPorArca = true;
  throw error;
}

module.exports = { ultimoNumeroAutorizado, solicitarCAE, olvidarCliente, demoraPara, esErrorDeRed };
