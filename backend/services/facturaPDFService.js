/**
 * SERVICIO DE GENERACIÓN DE PDF DE FACTURAS ELECTRÓNICAS
 * 
 * Genera PDFs de facturas según normativa AFIP con templates profesionales
 * Soporta: Factura A, Factura B, Factura C y Remitos
 * 
 * MARCOS LEGALES:
 * - RG 1415/03: Formato y contenido de comprobantes
 * - RG 2904/10: Requisitos de visualización
 * - RG 4290/18: Datos obligatorios
 */

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

class FacturaPDFService {
  
  /**
   * Genera el PDF de una factura electrónica
   * @param {Object} factura - Datos de la factura desde MongoDB
   * @param {String} tipoFactura - 'A', 'B', 'C' o 'REM'
   * @returns {PDFDocument} - Stream del PDF generado
   */
  generarPDF(factura, tipoFactura = 'B') {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 40,
      bufferPages: true
    });

    // Configurar metadata del PDF
    doc.info.Title = `${factura.tipoComprobanteDescripcion} ${factura.nroFactura}`;
    doc.info.Author = factura.emisor.razonSocial;
    doc.info.Subject = 'Factura Electrónica - AFIP';
    doc.info.Creator = 'Sistema de Estacionamiento';

    // Generar contenido según tipo
    switch(tipoFactura.toUpperCase()) {
      case 'A':
        this.generarFacturaA(doc, factura);
        break;
      case 'B':
        this.generarFacturaB(doc, factura);
        break;
      case 'C':
        this.generarFacturaC(doc, factura);
        break;
      case 'REM':
        this.generarRemito(doc, factura);
        break;
      default:
        this.generarFacturaB(doc, factura);
    }

    doc.end();
    return doc;
  }

  /**
   * FACTURA A - Responsable Inscripto
   * Discrimina IVA, incluye CUIT del cliente
   */
  generarFacturaA(doc, factura) {
    // Header con logo y datos de la empresa
    this.dibujarHeaderFactura(doc, factura, 'A');
    
    // Recuadro del tipo de comprobante
    this.dibujarTipoComprobante(doc, 'A', factura.nroFactura);
    
    // Datos del emisor (izquierda)
    this.dibujarDatosEmisor(doc, factura.emisor);
    
    // Datos del cliente (derecha)
    this.dibujarDatosClienteFacturaA(doc, factura.cliente);
    
    // Datos de la factura (fecha, CAE, etc.)
    this.dibujarDatosFactura(doc, factura);
    
    // Detalle de items
    this.dibujarDetalleItems(doc, factura.items, true); // true = discrimina IVA
    
    // Totales con IVA discriminado
    this.dibujarTotalesFacturaA(doc, factura);
    
    // Footer con CAE y código de barras
    this.dibujarFooterConCAE(doc, factura);
  }

  /**
   * FACTURA B - Consumidor Final / Monotributista
   * No discrimina IVA, CUIT del cliente opcional
   */
  generarFacturaB(doc, factura) {
    // Header
    this.dibujarHeaderFactura(doc, factura, 'B');
    
    // Tipo de comprobante
    this.dibujarTipoComprobante(doc, 'B', factura.nroFactura);
    
    // Datos del emisor
    this.dibujarDatosEmisor(doc, factura.emisor);
    
    // Datos del cliente (más simple que Factura A)
    this.dibujarDatosClienteFacturaB(doc, factura.cliente);
    
    // Datos de la factura
    this.dibujarDatosFactura(doc, factura);
    
    // Detalle sin discriminar IVA
    this.dibujarDetalleItems(doc, factura.items, false); // false = IVA incluido
    
    // Totales sin discriminar IVA
    this.dibujarTotalesFacturaB(doc, factura);
    
    // Footer con CAE
    this.dibujarFooterConCAE(doc, factura);
  }

  /**
   * FACTURA C - Operaciones exentas
   */
  generarFacturaC(doc, factura) {
    // Similar a Factura B pero indica "Exento"
    this.generarFacturaB(doc, factura);
  }

  /**
   * REMITO - Comprobante sin valor fiscal
   */
  generarRemito(doc, factura) {
    this.dibujarHeaderRemito(doc, factura);
    this.dibujarDatosRemito(doc, factura);
    this.dibujarDetalleItemsRemito(doc, factura.items);
    this.dibujarFooterRemito(doc, factura);
  }

  // ==================== MÉTODOS DE DIBUJO ====================

  /**
   * Dibuja el header con logo y datos básicos de la empresa
   */
  dibujarHeaderFactura(doc, factura, tipoFactura) {
    const y = 40;
    
    // Logo empresa (si existe)
    // doc.image('logo.png', 50, y, { width: 80 });
    
    // Razón Social grande
    doc.fontSize(16)
       .font('Helvetica-Bold')
       .text(factura.emisor.razonSocial, 50, y, { width: 250 });
    
    // Dirección del emisor
    doc.fontSize(9)
       .font('Helvetica');
    
    let lineaDireccion = y + 25;
    
    // Construir domicilio desde los campos disponibles
    const domicilio = factura.emisor.domicilio;
    
    // Intentar construir domicilio validando que los campos sean strings válidos
    if (domicilio) {
      // Convertir a string y limpiar
      const calle = domicilio.calle ? String(domicilio.calle).trim() : '';
      const numero = domicilio.numero ? String(domicilio.numero).trim() : '';
      const localidad = domicilio.localidad ? String(domicilio.localidad).trim() : '';
      const provincia = domicilio.provincia ? String(domicilio.provincia).trim() : '';
      const cp = domicilio.codigoPostal ? String(domicilio.codigoPostal).trim() : '';
      
      // Línea 1: Calle y número
      if (calle && calle !== '[object Object]') {
        doc.text(`${calle} ${numero}`, 50, lineaDireccion, { width: 250 });
        lineaDireccion += 13;
      }
      
      // Línea 2: Localidad y provincia
      if (localidad && localidad !== '[object Object]') {
        const lineaLoc = provincia ? `${localidad}, ${provincia}` : localidad;
        doc.text(lineaLoc, 50, lineaDireccion, { width: 250 });
        lineaDireccion += 13;
      }
      
      // Línea 3: Código postal
      if (cp && cp !== '[object Object]') {
        doc.text(`CP: ${cp}`, 50, lineaDireccion, { width: 250 });
        lineaDireccion += 13;
      }
    }
    
    // Teléfono y email (si existen en contacto)
    if (factura.emisor.contacto?.telefono) {
      doc.text(`Tel: ${factura.emisor.contacto.telefono}`, 50, lineaDireccion, { width: 250 });
      lineaDireccion += 13;
    }
    if (factura.emisor.contacto?.email) {
      doc.text(`Email: ${factura.emisor.contacto.email}`, 50, lineaDireccion, { width: 250 });
    }
    
    // Línea separadora (más abajo para evitar superposición)
    doc.moveTo(50, 140)
       .lineTo(550, y + 100)
       .stroke();
  }

  /**
   * Dibuja el recuadro central con el tipo de comprobante (A, B, C)
   */
  dibujarTipoComprobante(doc, tipo, nroFactura) {
    const centerX = 297.5; // Centro de A4
    const y = 40; // Alineado con la razón social
    
    // Recuadro grande con borde grueso
    doc.lineWidth(3)
       .rect(centerX - 40, y, 80, 60) // Altura reducida de 80 a 60
       .stroke();
    
    // Letra del tipo (A, B, C)
    doc.fontSize(40) // Reducido de 48 a 40
       .font('Helvetica-Bold')
       .text(tipo, centerX - 40, y + 10, { width: 80, align: 'center' });
    
    // Texto "Código XX" (según tipo AFIP)
    const codigos = { 'A': '001', 'B': '006', 'C': '011' };
    doc.fontSize(9)
       .font('Helvetica')
       .text(`Cód. ${codigos[tipo] || '006'}`, centerX - 40, y + 48, { width: 80, align: 'center' });
    
    // Número de factura debajo del cuadro
    doc.fontSize(11)
       .font('Helvetica-Bold')
       .text(nroFactura, centerX - 60, y + 70, { width: 120, align: 'center' });
    
    // Tipo de comprobante en texto
    doc.fontSize(10)
       .font('Helvetica')
       .text(`FACTURA ${tipo}`, centerX - 60, y + 85, { width: 120, align: 'center' });
  }

  /**
   * Datos del emisor (empresa estacionamiento)
   */
  dibujarDatosEmisor(doc, emisor) {
    const y = 150;
    
    doc.fontSize(10)
       .font('Helvetica-Bold')
       .text('DATOS DEL EMISOR', 50, y);
    
    doc.fontSize(9)
       .font('Helvetica')
       .text(`CUIT: ${emisor.cuit}`, 50, y + 15)
       .text(`Condición IVA: ${emisor.condicionIva || 'N/A'}`, 50, y + 28);
    
    if (emisor.inicioActividades) {
      doc.text(`Inicio Actividades: ${this.formatearFecha(emisor.inicioActividades)}`, 50, y + 41);
    }
    
    if (emisor.ingresosBrutos) {
      doc.text(`Ingresos Brutos: ${emisor.ingresosBrutos}`, 50, y + 54);
    }
  }

  /**
   * Datos del cliente para Factura A (con CUIT obligatorio)
   */
  dibujarDatosClienteFacturaA(doc, cliente) {
    const y = 150;
    const x = 320;
    
    doc.fontSize(10)
       .font('Helvetica-Bold')
       .text('DATOS DEL CLIENTE', x, y);
    
    let lineaY = y + 15;
    doc.fontSize(9)
       .font('Helvetica');
    
    // Nombre completo o razón social
    const nombreCompleto = cliente.razonSocial || `${cliente.nombre || ''} ${cliente.apellido || ''}`.trim();
    doc.text(`Razón Social: ${nombreCompleto}`, x, lineaY, { width: 230 });
    lineaY += 13;
    
    // CUIT/CUIL
    if (cliente.numeroDocumento) {
      doc.text(`${cliente.tipoDocumentoDescripcion || 'DNI'}: ${cliente.numeroDocumento}`, x, lineaY);
      lineaY += 13;
    }
    
    // Condición IVA
    doc.text(`Condición IVA: ${cliente.condicionIva || 'Consumidor Final'}`, x, lineaY);
    lineaY += 13;
    
    // Domicilio
    if (cliente.domicilio) {
      doc.text(`Domicilio: ${cliente.domicilio}`, x, lineaY, { width: 230 });
    }
  }

  /**
   * Datos del cliente para Factura B (CUIT opcional)
   */
  dibujarDatosClienteFacturaB(doc, cliente) {
    const y = 150;
    const x = 320;
    
    doc.fontSize(10)
       .font('Helvetica-Bold')
       .text('DATOS DEL CLIENTE', x, y);
    
    let lineaY = y + 15;
    doc.fontSize(9)
       .font('Helvetica');
    
    // Nombre completo
    const nombreCompleto = `${cliente.nombre || ''} ${cliente.apellido || ''}`.trim();
    if (nombreCompleto) {
      doc.text(`Razón Social: ${nombreCompleto}`, x, lineaY, { width: 230 });
      lineaY += 13;
    }
    
    // Documento
    if (cliente.numeroDocumento) {
      doc.text(`${cliente.tipoDocumentoDescripcion || 'DNI/CUIL'}: ${cliente.numeroDocumento}`, x, lineaY);
      lineaY += 13;
    }
    
    // Condición IVA
    doc.text(`Condición IVA: ${cliente.condicionIva || 'Consumidor Final'}`, x, lineaY);
    lineaY += 13;
    
    // Domicilio
    if (cliente.domicilio) {
      doc.text(`Domicilio: ${cliente.domicilio}`, x, lineaY, { width: 230 });
    }
  }

  /**
   * Datos de la factura (fecha, CAE, vencimiento)
   */
  dibujarDatosFactura(doc, factura) {
    const y = 230;
    
    // Cuadro con fondo gris
    doc.rect(50, y, 500, 40)
       .fillAndStroke('#f0f0f0', '#000000');
    
    doc.fillColor('#000000')
       .fontSize(9)
       .font('Helvetica-Bold')
       .text('Fecha Emisión:', 60, y + 10)
       .text('Punto Venta:', 200, y + 10)
       .text('CAE:', 340, y + 10);
    
    doc.font('Helvetica')
       .text(this.formatearFecha(factura.fechaEmision), 60, y + 23)
       .text(String(factura.puntoVenta).padStart(5, '0'), 200, y + 23)
       .text(factura.cae, 340, y + 23);
  }

  /**
   * Tabla de detalle de items/servicios
   */
  dibujarDetalleItems(doc, items, discriminaIVA) {
    const yInicio = 290;
    let y = yInicio;
    
    // Encabezado de tabla
    doc.rect(50, y, 500, 25)
       .fillAndStroke('#333333', '#000000');
    
    doc.fillColor('#ffffff')
       .fontSize(9)
       .font('Helvetica-Bold')
       .text('Descripción', 60, y + 8, { width: 250 })
       .text('Cant.', 320, y + 8, { width: 40, align: 'center' })
       .text('P. Unit.', 370, y + 8, { width: 60, align: 'right' });
    
    if (discriminaIVA) {
      doc.text('IVA', 440, y + 8, { width: 40, align: 'right' })
         .text('Subtotal', 490, y + 8, { width: 50, align: 'right' });
    } else {
      doc.text('Subtotal', 470, y + 8, { width: 70, align: 'right' });
    }
    
    y += 25;
    
    // Items
    doc.fillColor('#000000')
       .font('Helvetica');
    
    items.forEach((item, index) => {
      const bgColor = index % 2 === 0 ? '#ffffff' : '#f9f9f9';
      doc.rect(50, y, 500, 20)
         .fillAndStroke(bgColor, '#cccccc');
      
      doc.fillColor('#000000')
         .text(item.descripcion || 'Sin descripción', 60, y + 5, { width: 250 })
         .text(String(item.cantidad || 1), 320, y + 5, { width: 40, align: 'center' })
         .text(`$${(item.precioUnitario || 0).toFixed(2)}`, 370, y + 5, { width: 60, align: 'right' });
      
      if (discriminaIVA) {
        const ivaItem = item.iva || 0;
        const subtotalItem = item.subtotal || (item.precioUnitario * item.cantidad);
        doc.text(`$${ivaItem.toFixed(2)}`, 440, y + 5, { width: 40, align: 'right' })
           .text(`$${subtotalItem.toFixed(2)}`, 490, y + 5, { width: 50, align: 'right' });
      } else {
        const subtotalItem = item.subtotal || (item.precioUnitario * item.cantidad);
        doc.text(`$${subtotalItem.toFixed(2)}`, 470, y + 5, { width: 70, align: 'right' });
      }
      
      y += 20;
    });
    
    return y;
  }

  /**
   * Totales para Factura A (discrimina IVA)
   */
  dibujarTotalesFacturaA(doc, factura) {
    const y = 600;
    
    const subtotal = factura.subtotal || factura.montoNeto || 0;
    const iva = factura.importeIVA || factura.montoIVA || 0;
    const total = factura.importeTotal || factura.montoTotal || 0;
    
    doc.fontSize(10)
       .font('Helvetica-Bold')
       .text('Subtotal:', 400, y)
       .text('IVA (21%):', 400, y + 15)
       .text('TOTAL:', 400, y + 35, { underline: true });
    
    doc.font('Helvetica')
       .text(`$${subtotal.toFixed(2)}`, 490, y, { width: 60, align: 'right' })
       .text(`$${iva.toFixed(2)}`, 490, y + 15, { width: 60, align: 'right' });
    
    doc.fontSize(12)
       .font('Helvetica-Bold')
       .text(`$${total.toFixed(2)}`, 490, y + 35, { width: 60, align: 'right' });
  }

  /**
   * Totales para Factura B (no discrimina IVA)
   */
  dibujarTotalesFacturaB(doc, factura) {
    const y = 600;
    
    const total = factura.importeTotal || factura.montoTotal || 0;
    
    doc.fontSize(12)
       .font('Helvetica-Bold')
       .text('TOTAL:', 400, y)
       .text(`$${total.toFixed(2)}`, 490, y, { width: 60, align: 'right' });
    
    doc.fontSize(9)
       .font('Helvetica')
       .text('(IVA incluido)', 400, y + 20);
  }

  /**
   * Footer con CAE, vencimiento y código QR
   */
  dibujarFooterConCAE(doc, factura) {
    const y = 700;
    
    // Recuadro de CAE
    doc.rect(50, y, 500, 60)
       .stroke();
    
    doc.fontSize(8)
       .font('Helvetica-Bold')
       .text('CAE (Código de Autorización Electrónico):', 60, y + 10)
       .fontSize(11)
       .text(factura.cae, 60, y + 23);
    
    doc.fontSize(8)
       .font('Helvetica')
       .text(`Fecha Vto. CAE: ${this.formatearFechaCAE(factura.caeFechaVencimiento)}`, 60, y + 40);
    
    // Leyenda legal
    doc.fontSize(7)
       .text('Comprobante autorizado por AFIP - Ley 25.506', 50, y + 70, { align: 'center', width: 500 });
  }

  /**
   * Header para remito
   */
  dibujarHeaderRemito(doc, factura) {
    doc.fontSize(18)
       .font('Helvetica-Bold')
       .text('REMITO', 50, 50, { align: 'center', width: 500 });
    
    doc.fontSize(10)
       .font('Helvetica')
       .text(`N° ${factura.nroFactura}`, 50, 75, { align: 'center', width: 500 });
  }

  /**
   * Datos específicos del remito
   */
  dibujarDatosRemito(doc, factura) {
    // Similar a factura pero sin datos fiscales
    this.dibujarDatosEmisor(doc, factura.emisor);
    this.dibujarDatosClienteFacturaB(doc, factura.cliente);
  }

  /**
   * Detalle de items para remito (sin precios)
   */
  dibujarDetalleItemsRemito(doc, items) {
    // Similar a detalle normal pero sin columnas de precios
  }

  /**
   * Footer del remito
   */
  dibujarFooterRemito(doc, factura) {
    const y = 700;
    doc.fontSize(8)
       .text('Este documento no tiene valor fiscal', 50, y, { align: 'center', width: 500 });
  }

  // ==================== UTILIDADES ====================

  formatearFecha(fecha) {
    if (!fecha) return '';
    const d = new Date(fecha);
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
  }

  formatearFechaCAE(fechaCAE) {
    // Formato YYYYMMDD -> DD/MM/YYYY
    if (!fechaCAE) return '';
    const str = String(fechaCAE);
    return `${str.substr(6, 2)}/${str.substr(4, 2)}/${str.substr(0, 4)}`;
  }
}

module.exports = new FacturaPDFService();
