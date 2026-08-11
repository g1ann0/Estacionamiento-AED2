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
async function escribirPdf(comprobante, destino) {
  const configuracion = await ConfiguracionEmpresa.obtenerConfiguracionActiva();
  const estadia = comprobante.estadiaId;

  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  doc.pipe(destino);

  const linea = () => {
    doc.moveTo(50, doc.y + 2).lineTo(545, doc.y + 2).strokeColor('#cccccc').stroke();
    doc.moveDown(0.6);
  };

  doc.fontSize(16).fillColor('#000000').text('COMPROBANTE DE ESTADÍA', { align: 'center' });
  doc.fontSize(9).fillColor('#666666').text('DOCUMENTO NO FISCAL — no válido como factura', { align: 'center' });
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
  doc.text(`Número: ${numeroFormateado(comprobante)}`);
  doc.text(`Emitido: ${fechaHora(comprobante.fechaEmision)}`);
  doc.text(`Tipo: ${comprobante.tipoComprobante} (no fiscal, sin CAE)`);
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

  doc.fontSize(8).fillColor('#666666').text(
    'Este documento no tiene validez fiscal: es el comprobante interno de la estadía. ' +
    'La emisión de comprobantes fiscales electrónicos todavía no está habilitada en este sistema.',
    { align: 'left' }
  );

  doc.end();
}

// Devuelve el PDF completo en memoria. Se usa para adjuntarlo a un mail, donde no hay stream
// de respuesta al que escribir.
async function generarBuffer(comprobante) {
  const { PassThrough } = require('stream');
  const stream = new PassThrough();
  const partes = [];

  const listo = new Promise((resolver, rechazar) => {
    stream.on('data', (parte) => partes.push(parte));
    stream.on('end', () => resolver(Buffer.concat(partes)));
    stream.on('error', rechazar);
  });

  await escribirPdf(comprobante, stream);
  return listo;
}

module.exports = { escribirPdf, generarBuffer, nombreArchivo, numeroFormateado };
