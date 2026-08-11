// Catálogos de ARCA. Son códigos numéricos que ARCA define y que no se inventan: mandar uno
// equivocado produce un rechazo cuyo mensaje casi nunca dice cuál de los campos está mal.
//
// Se define solo lo que este sistema usa. Un catálogo completo copiado de otro lado es una
// invitación a elegir un código que no corresponde.

// Tipos de comprobante (FEParamGetTiposCbte).
const TIPO_COMPROBANTE = {
  FACTURA_A: 1,
  NOTA_CREDITO_A: 3,
  FACTURA_B: 6,
  NOTA_CREDITO_B: 8,
  FACTURA_C: 11,
  NOTA_CREDITO_C: 13
};

// Tipos de documento del receptor (FEParamGetTiposDoc).
const TIPO_DOCUMENTO = {
  CUIT: 80,
  DNI: 96,
  // 99 es "consumidor final sin identificar", y va con número 0. Es el caso del cliente
  // ocasional que pagó y se fue: no tenemos DNI y no se inventa uno.
  CONSUMIDOR_FINAL: 99
};

// Condición de IVA del receptor (RG 5616 — obligatorio desde 2024).
const CONDICION_IVA_RECEPTOR = {
  RESPONSABLE_INSCRIPTO: 1,
  EXENTO: 4,
  CONSUMIDOR_FINAL: 5,
  MONOTRIBUTO: 6
};

// Concepto: 1 productos, 2 servicios, 3 ambos. Una estadía es un servicio, y eso obliga a
// informar el período (FchServDesde / FchServHasta) y el vencimiento de pago.
const CONCEPTO = { PRODUCTOS: 1, SERVICIOS: 2, AMBOS: 3 };

const MONEDA_PESOS = 'PES';
const ALICUOTA_IVA_21 = 5; // Id de la alícuota 21% en FEParamGetTiposIva
const PORCENTAJE_IVA_21 = 21;

// El tipo de comprobante lo determina la condición del EMISOR, no la del cliente:
//   - Monotributista emite C, sin discriminar IVA.
//   - Responsable inscripto emite B a consumidor final, con IVA discriminado.
// Emitir A requiere que el receptor sea responsable inscripto y aporte su CUIT, algo que no
// pasa en el mostrador de una playa: no se contempla hasta que exista el caso real.
const tipoComprobantePara = (condicionIvaEmisor) => {
  const emisor = String(condicionIvaEmisor || '').toLowerCase();
  if (emisor.includes('monotributo')) return TIPO_COMPROBANTE.FACTURA_C;
  return TIPO_COMPROBANTE.FACTURA_B;
};

// El receptor puede ser un cliente registrado (tenemos DNI) o un ocasional (no tenemos nada).
// En el segundo caso corresponde 99/0, que es como ARCA representa "consumidor final sin
// identificar" — no un DNI de relleno.
const documentoDe = (receptor) => {
  const dni = receptor?.dni?.toString().replace(/\D/g, '');
  if (!dni) return { tipo: TIPO_DOCUMENTO.CONSUMIDOR_FINAL, numero: 0 };
  // Once dígitos es un CUIT; ocho o menos, un DNI.
  if (dni.length === 11) return { tipo: TIPO_DOCUMENTO.CUIT, numero: Number(dni) };
  return { tipo: TIPO_DOCUMENTO.DNI, numero: Number(dni) };
};

// ARCA quiere las fechas como AAAAMMDD, en hora de Argentina. Usar la fecha del servidor sin
// convertir manda el día equivocado durante las tres primeras horas de cada día.
const fechaArca = (fecha = new Date()) => {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date(fecha));
  return partes.replace(/-/g, '');
};

// Desglose de importes.
//
// El total que cobró la playa es lo que el cliente pagó: es IVA incluido, siempre. Para la
// factura C ese total va como neto y no se discrimina nada. Para la B hay que separarlo, y la
// cuenta se hace hacia atrás desde el total — nunca sumando IVA sobre el total, que daría un
// importe distinto al cobrado.
//
// Todo se redondea a 2 decimales ANTES de enviarse: ARCA valida que la suma de los renglones
// dé exactamente el total, y unas centésimas de diferencia rompen esa igualdad.
const redondear = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

const desglosarImportes = (total, tipoComprobante) => {
  const importeTotal = redondear(total);

  if (tipoComprobante === TIPO_COMPROBANTE.FACTURA_C) {
    // El monotributista no discrimina IVA: neto = total, sin renglones de alícuota.
    return { impTotal: importeTotal, impNeto: importeTotal, impIVA: 0, iva: [] };
  }

  const neto = redondear(importeTotal / (1 + PORCENTAJE_IVA_21 / 100));
  // El IVA se calcula por diferencia y no como neto × 0,21: así neto + iva da exactamente el
  // total cobrado aunque el redondeo del neto haya movido una centésima.
  const iva = redondear(importeTotal - neto);

  return {
    impTotal: importeTotal,
    impNeto: neto,
    impIVA: iva,
    iva: [{ Id: ALICUOTA_IVA_21, BaseImp: neto, Importe: iva }]
  };
};

module.exports = {
  TIPO_COMPROBANTE,
  TIPO_DOCUMENTO,
  CONDICION_IVA_RECEPTOR,
  CONCEPTO,
  MONEDA_PESOS,
  ALICUOTA_IVA_21,
  PORCENTAJE_IVA_21,
  tipoComprobantePara,
  documentoDe,
  fechaArca,
  desglosarImportes,
  redondear
};
