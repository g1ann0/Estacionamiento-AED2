// PDF del comprobante de estadía (ver docs/rediseno-admin/00 sección D: la entrega es
// digital, sin hardware de impresión).
//
// REGLA QUE NO SE NEGOCIA: hoy el comprobante es un `ticket` NO FISCAL, sin CAE. El PDF lo
// dice en el encabezado y al pie. Mientras no exista la integración con ARCA (Etapa 6),
// ningún documento puede parecer una factura ni mostrar un CAE inventado.

const PDFDocument = require('pdfkit');
const ConfiguracionEmpresa = require('../models/ConfiguracionEmpresa');

const pesos = (n) => `$${Number(n ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;

const fechaHora = (valor) =>
  valor ? new Date(valor).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }) : '—';

const fecha = (valor) =>
  valor ? new Date(valor).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

// Los códigos de ARCA, escritos como los conoce el cliente.
const TITULO_FISCAL = { 6: 'FACTURA B', 11: 'FACTURA C', 8: 'NOTA DE CRÉDITO B', 13: 'NOTA DE CRÉDITO C' };

// QUÉ DICE EL DOCUMENTO, decidido aparte de cómo se dibuja.
//
// Es la parte delicada del PDF: un comprobante que dice "no fiscal" teniendo CAE, o que se
// presenta como factura llevando un CAE de prueba, es el tipo de error que después hay que
// explicarle a ARCA. Vive en una función pura para poder verificarlo de verdad — el texto
// dentro de un PDF generado va codificado con la fuente embebida y buscarlo como string da
// falsos positivos en los dos sentidos.
function leyendaFiscal(comprobante) {
  const autorizado = Boolean(comprobante.cae) && !comprobante.simulado;
  const esPrueba = Boolean(comprobante.simulado);
  const esperandoCae = !comprobante.cae && comprobante.estado === 'pendiente_cae';

  if (autorizado) {
    return {
      estado: 'autorizado',
      titulo: TITULO_FISCAL[comprobante.tipoComprobanteFiscal] ?? 'COMPROBANTE',
      subtitulo: 'Comprobante autorizado electrónicamente por ARCA',
      pie: `Comprobante autorizado por ARCA con CAE ${comprobante.cae}` +
        `${comprobante.caeFchVto ? `, con vencimiento el ${fecha(comprobante.caeFchVto)}` : ''}.`,
      resaltado: false
    };
  }

  if (esPrueba) {
    return {
      estado: 'prueba',
      titulo: 'COMPROBANTE DE ESTADÍA',
      subtitulo: 'DOCUMENTO DE PRUEBA — CAE simulado, sin validez alguna',
      pie: 'DOCUMENTO DE PRUEBA. El CAE de este comprobante fue generado por el modo de ' +
        'simulación del sistema y no proviene de ARCA: no tiene validez de ningún tipo.',
      resaltado: true
    };
  }

  if (esperandoCae) {
    return {
      estado: 'pendiente',
      titulo: 'COMPROBANTE DE ESTADÍA',
      subtitulo: 'DOCUMENTO NO FISCAL — el comprobante fiscal está en trámite',
      pie: 'Este documento es el comprobante interno de la estadía. El comprobante fiscal está ' +
        'en trámite ante ARCA y se envía por correo cuando queda autorizado.',
      resaltado: false
    };
  }

  return {
    estado: 'no_fiscal',
    titulo: 'COMPROBANTE DE ESTADÍA',
    subtitulo: 'DOCUMENTO NO FISCAL — no válido como factura',
    pie: 'Este documento no tiene validez fiscal: es el comprobante interno de la estadía. ' +
      'La emisión de comprobantes fiscales electrónicos todavía no está habilitada en este sistema.',
    resaltado: false
  };
}

const ETIQUETA_MEDIO = {
  efectivo: 'Efectivo',
  tarjeta: 'Tarjeta',
  qr_transferencia: 'QR / Transferencia',
  saldo_prepago: 'Saldo prepago'
};

const duracion = (desde, hasta) => {
  if (!desde || !hasta) return '—';
  const minutos = Math.max(0, Math.round((new Date(hasta) - new Date(desde)) / 60000));
  return `${Math.floor(minutos / 60)} h ${String(minutos % 60).padStart(2, '0')} min`;
};

const numeroFormateado = (comprobante) =>
  `${comprobante.puntoVenta}-${String(comprobante.numero).padStart(8, '0')}`;

const nombreArchivo = (comprobante) => `comprobante_estadia_${numeroFormateado(comprobante)}.pdf`;

// Escribe el documento sobre cualquier stream: `res` para la descarga directa, un buffer en
// memoria para adjuntarlo a un mail. Una sola definición del documento para los dos caminos.
// `comprimir: false` deja el texto legible dentro del PDF. Solo lo usan las verificaciones:
// un test que solo comprueba que el archivo empiece con "%PDF" no prueba que el documento
// diga lo que tiene que decir, y lo que dice es justamente lo delicado acá.
async function escribirPdf(comprobante, destino, { comprimir = true } = {}) {
  const configuracion = await ConfiguracionEmpresa.obtenerConfiguracionActiva();
  const estadia = comprobante.estadiaId;

  const doc = new PDFDocument({ margin: 50, size: 'A4', compress: comprimir });
  doc.pipe(destino);

  const linea = () => {
    doc.moveTo(50, doc.y + 2).lineTo(545, doc.y + 2).strokeColor('#cccccc').stroke();
    doc.moveDown(0.6);
  };

  // El encabezado dice lo que el documento ES en este momento, y eso cambia con el CAE.
  const leyenda = leyendaFiscal(comprobante);

  doc.fontSize(16).fillColor('#000000').text(leyenda.titulo, { align: 'center' });
  doc.fontSize(9).fillColor(leyenda.resaltado ? '#b45309' : '#666666');
  doc.text(leyenda.subtitulo, { align: 'center' });

  doc.moveDown(0.8);
  doc.fillColor('#000000');

  if (configuracion) {
    doc.fontSize(11).text('Emisor');
    doc.fontSize(9);
    doc.text(`Razón social: ${configuracion.razonSocial}`);
    doc.text(`CUIT: ${configuracion.cuit}`);
    doc.text(`Domicilio: ${configuracion.getDomicilioCompleto()}`);
    doc.text(`Condición IVA: ${configuracion.condicionIva}`);
  } else {
    // Sin configuración de empresa no se inventan datos del emisor.
    doc.fontSize(9).fillColor('#666666').text('Sin configuración de empresa cargada.').fillColor('#000000');
  }
  doc.moveDown(0.6);
  linea();

  doc.fontSize(11).text('Comprobante');
  doc.fontSize(9);
  doc.text(`Número interno: ${numeroFormateado(comprobante)}`);
  doc.text(`Emitido: ${fechaHora(comprobante.fechaEmision)}`);

  if (comprobante.cae) {
    // La numeración fiscal es la de ARCA y es distinta de la del ticket: se muestran las dos,
    // porque el cliente puede tener en la mano el ticket con el número interno.
    if (comprobante.numeroFiscal) {
      doc.text(`Número fiscal: ${comprobante.puntoVenta}-${String(comprobante.numeroFiscal).padStart(8, '0')}`);
    }
    doc.text(`CAE: ${comprobante.cae}`);
    if (comprobante.caeFchVto) doc.text(`Vencimiento del CAE: ${fecha(comprobante.caeFchVto)}`);
  } else {
    doc.text(`Tipo: ${comprobante.tipoComprobante} (sin CAE)`);
  }
  if (comprobante.estado === 'anulado') {
    doc.fillColor('#b45309').text(`ANULADO — ${comprobante.motivoAnulacion || 'sin motivo registrado'}`).fillColor('#000000');
  }
  doc.moveDown(0.6);
  linea();

  doc.fontSize(11).text('Receptor');
  doc.fontSize(9);
  // El apellido solo es un apellido cuando el receptor es un usuario registrado. Para el
  // cliente ocasional el modelo guarda 'Final' como relleno, y escribir "Final, Juan" en un
  // comprobante que el cliente se lleva es un error que se ve.
  doc.text(
    comprobante.receptor.tipo === 'usuario'
      ? `${comprobante.receptor.apellido}, ${comprobante.receptor.nombre}`
      : (comprobante.receptor.nombre?.trim() || 'Consumidor final')
  );
  if (comprobante.receptor.dni) doc.text(`DNI: ${comprobante.receptor.dni}`);
  doc.text(`Condición IVA: ${comprobante.receptor.condicionIva}`);
  doc.moveDown(0.6);
  linea();

  doc.fontSize(11).text('Estadía');
  doc.fontSize(9);
  if (estadia) {
    doc.text(`Patente: ${estadia.vehiculoDominio}`);
    doc.text(`Ingreso: ${fechaHora(estadia.horaInicio)}`);
    doc.text(`Egreso: ${fechaHora(estadia.horaFin)}`);
    doc.text(`Tiempo: ${duracion(estadia.horaInicio, estadia.horaFin)}`);
    if (estadia.duracionHoras) doc.text(`Horas cobradas: ${estadia.duracionHoras} (fracción hacia arriba)`);
    if (estadia.origen === 'excepcion') {
      doc.fillColor('#b45309').text(`Estadía no registrada — ${estadia.motivoExcepcion || 'sin motivo'}`).fillColor('#000000');
    }
  } else {
    doc.fillColor('#666666').text('La estadía asociada ya no está disponible.').fillColor('#000000');
  }
  doc.moveDown(0.6);
  linea();

  doc.fontSize(9);
  doc.text(`Medio de pago: ${ETIQUETA_MEDIO[comprobante.medioPago] ?? comprobante.medioPago}`);
  doc.moveDown(0.4);
  doc.fontSize(14).text(`TOTAL: ${pesos(comprobante.total)}`, { align: 'right' });
  doc.moveDown(1);

  // El pie repite el estado real del documento. Es lo último que lee alguien que lo revisa, y
  // tiene que coincidir con el encabezado: un comprobante no puede decir dos cosas.
  doc.fontSize(8).fillColor(leyenda.resaltado ? '#b45309' : '#666666');
  doc.text(leyenda.pie, { align: 'left' });

  doc.end();
}

// Devuelve el PDF completo en memoria. Se usa para adjuntarlo a un mail, donde no hay stream
// de respuesta al que escribir.
async function generarBuffer(comprobante, opciones = {}) {
  const { PassThrough } = require('stream');
  const stream = new PassThrough();
  const partes = [];

  const listo = new Promise((resolver, rechazar) => {
    stream.on('data', (parte) => partes.push(parte));
    stream.on('end', () => resolver(Buffer.concat(partes)));
    stream.on('error', rechazar);
  });

  await escribirPdf(comprobante, stream, opciones);
  return listo;
}

module.exports = { escribirPdf, generarBuffer, nombreArchivo, numeroFormateado, leyendaFiscal };
