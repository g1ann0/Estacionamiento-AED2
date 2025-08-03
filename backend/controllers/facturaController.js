const Factura = require('../models/Factura');
const Comprobante = require('../models/Comprobante');
const Usuario = require('../models/Usuario');
const ConfiguracionEmpresa = require('../models/ConfiguracionEmpresa');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// Generar factura al aprobar comprobante
const generarFacturaPorComprobante = async (nroComprobante, adminDni) => {
  try {
    // Buscar el comprobante
    const comprobante = await Comprobante.findOne({ nroComprobante });
    if (!comprobante) {
      throw new Error('Comprobante no encontrado');
    }

    // Buscar datos del usuario
    const usuario = await Usuario.findOne({ dni: comprobante.usuario.dni });
    if (!usuario) {
      throw new Error('Usuario no encontrado');
    }

    // Buscar datos del admin que genera la factura
    const admin = await Usuario.findOne({ dni: adminDni });
    if (!admin) {
      throw new Error('Administrador no encontrado');
    }

    // Generar número de factura
    const nroFactura = await Factura.generarNumeroFactura();

    // Crear factura
    const nuevaFactura = new Factura({
      nroFactura,
      tipoComprobante: 'ticket',
      cliente: {
        dni: usuario.dni,
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        email: usuario.email,
        condicionIva: 'Consumidor Final'
      },
      concepto: {
        descripcion: 'Recarga de saldo - Servicio de estacionamiento',
        cantidad: 1,
        precioUnitario: comprobante.montoAcreditado,
        subtotal: comprobante.montoAcreditado
      },
      comprobanteRelacionado: {
        nroComprobante: comprobante.nroComprobante,
        fechaComprobante: comprobante.fecha,
        montoDisponible: comprobante.montoDisponible
      },
      generadaPor: {
        dni: admin.dni,
        nombre: admin.nombre,
        apellido: admin.apellido
      }
    });

    // Calcular totales
    nuevaFactura.calcularTotales();

    // Guardar factura
    await nuevaFactura.save();

    return nuevaFactura;
  } catch (error) {
    console.error('Error al generar factura:', error);
    throw error;
  }
};

// Obtener facturas con filtros
const obtenerFacturas = async (req, res) => {
  try {
    const { 
      fechaDesde, 
      fechaHasta, 
      busqueda, 
      estado,
      pagina = 1, 
      limite = 20 
    } = req.query;

    // Construir filtros
    let filtros = {};

    if (estado && estado !== 'todos') {
      filtros.estado = estado;
    }

    if (fechaDesde || fechaHasta) {
      filtros.fechaEmision = {};
      if (fechaDesde) {
        filtros.fechaEmision.$gte = new Date(fechaDesde);
      }
      if (fechaHasta) {
        const fechaFin = new Date(fechaHasta);
        fechaFin.setHours(23, 59, 59, 999);
        filtros.fechaEmision.$lte = fechaFin;
      }
    }

    if (busqueda && busqueda.trim() !== '') {
      const termino = busqueda.trim();
      filtros.$or = [
        { nroFactura: { $regex: termino, $options: 'i' } },
        { 'cliente.dni': { $regex: termino, $options: 'i' } },
        { 'cliente.nombre': { $regex: termino, $options: 'i' } },
        { 'cliente.apellido': { $regex: termino, $options: 'i' } },
        { 'comprobanteRelacionado.nroComprobante': { $regex: termino, $options: 'i' } }
      ];
    }

    const skip = (parseInt(pagina) - 1) * parseInt(limite);

    const [facturas, total] = await Promise.all([
      Factura.find(filtros)
        .sort({ fechaEmision: -1 })
        .skip(skip)
        .limit(parseInt(limite)),
      Factura.countDocuments(filtros)
    ]);

    // Estadísticas
    const estadisticas = await Factura.aggregate([
      { $match: filtros },
      {
        $group: {
          _id: null,
          totalFacturado: { 
            $sum: { 
              $cond: [
                { $ne: ['$estado', 'anulada'] }, // Solo sumar si NO está anulada
                '$total', 
                0 
              ] 
            } 
          },
          totalAnulado: { 
            $sum: { 
              $cond: [
                { $eq: ['$estado', 'anulada'] }, // Sumar solo las anuladas
                '$total', 
                0 
              ] 
            } 
          },
          cantidadFacturas: { $sum: 1 },
          emitidas: {
            $sum: { $cond: [{ $eq: ['$estado', 'emitida'] }, 1, 0] }
          },
          anuladas: {
            $sum: { $cond: [{ $eq: ['$estado', 'anulada'] }, 1, 0] }
          }
        }
      }
    ]);

    const stats = estadisticas[0] || {
      totalFacturado: 0,
      totalAnulado: 0,
      cantidadFacturas: 0,
      emitidas: 0,
      anuladas: 0
    };

    res.json({
      success: true,
      facturas,
      paginacion: {
        total,
        pagina: parseInt(pagina),
        limite: parseInt(limite),
        totalPaginas: Math.ceil(total / parseInt(limite))
      },
      estadisticas: stats
    });

  } catch (error) {
    console.error('Error al obtener facturas:', error);
    res.status(500).json({
      success: false,
      mensaje: 'Error al obtener facturas'
    });
  }
};

// Generar PDF de factura
const generarPDFFactura = async (req, res) => {
  try {
    const { nroFactura } = req.params;

    const factura = await Factura.findOne({ nroFactura });
    if (!factura) {
      return res.status(404).json({ mensaje: 'Factura no encontrada' });
    }

    // Obtener configuración de empresa
    const configuracion = await ConfiguracionEmpresa.obtenerConfiguracionActiva();
    if (!configuracion) {
      return res.status(500).json({ mensaje: 'No hay configuración de empresa establecida' });
    }

    const nombreArchivo = `factura_${nroFactura.replace('-', '_')}.pdf`;
    
    // Configurar headers de respuesta
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}"`);

    // Crear documento PDF
    const doc = new PDFDocument({ margin: 50 });
    doc.pipe(res);

    // Encabezado
    doc.fontSize(18).text('TICKET - CONSUMIDOR FINAL', { align: 'center' });
    doc.moveDown(0.5);

    // Datos del emisor (usar configuración de empresa)
    doc.fontSize(12).text('DATOS DEL EMISOR', { underline: true });
    doc.fontSize(9);
    doc.text(`Razón Social: ${configuracion.razonSocial}`);
    doc.text(`CUIT: ${configuracion.cuit}`);
    doc.text(`Domicilio: ${configuracion.getDomicilioCompleto()}`);
    doc.text(`Condición IVA: ${configuracion.condicionIva} | Inicio: ${configuracion.inicioActividades.toLocaleDateString('es-AR')}`);
    if (configuracion.contacto.telefono || configuracion.contacto.email) {
      let contactoTexto = '';
      if (configuracion.contacto.telefono) contactoTexto += `Tel: ${configuracion.contacto.telefono}`;
      if (configuracion.contacto.email) {
        if (contactoTexto) contactoTexto += ' | ';
        contactoTexto += `Email: ${configuracion.contacto.email}`;
      }
      doc.text(contactoTexto);
    }
    doc.moveDown(0.5);

    // Datos de la factura
    doc.fontSize(12).text('DATOS DEL COMPROBANTE', { underline: true });
    doc.fontSize(9);
    doc.text(`Número: ${factura.nroFactura} | Fecha: ${factura.fechaEmision.toLocaleString('es-AR')} | Tipo: ${factura.tipoComprobante.toUpperCase()}`);
    doc.moveDown(0.5);

    // Datos del cliente
    doc.fontSize(12).text('DATOS DEL CLIENTE', { underline: true });
    doc.fontSize(9);
    doc.text(`Apellido y Nombre: ${factura.cliente.apellido}, ${factura.cliente.nombre}`);
    doc.text(`DNI: ${factura.cliente.dni}`);
    doc.text(`Condición IVA: ${factura.cliente.condicionIva}${factura.cliente.email ? ` | Email: ${factura.cliente.email}` : ''}`);
    doc.moveDown(0.5);

    // Vehículos registrados del cliente
    doc.fontSize(12).text('VEHÍCULOS REGISTRADOS', { underline: true });
    doc.fontSize(9);
    
    // Obtener vehículos del usuario de la factura
    try {
      const Usuario = require('../models/Usuario');
      const usuarioFactura = await Usuario.findOne({ dni: factura.cliente.dni });
      const vehiculosCliente = usuarioFactura?.vehiculos || [];
      
      if (vehiculosCliente.length > 0) {
        doc.text('Dominios registrados en la cuenta:');
        vehiculosCliente.forEach((vehiculo) => {
          doc.text(`• ${vehiculo.dominio}`, { indent: 20 });
        });
      } else {
        doc.text('No hay vehículos registrados en esta cuenta.');
      }
    } catch (error) {
      console.log('Error al obtener vehículos del cliente:', error);
      doc.text('Error al obtener información de vehículos.');
    }
    doc.moveDown(0.5);

    // Detalle
    doc.fontSize(12).text('DETALLE', { underline: true });
    doc.fontSize(9);
    
    // Encabezados de tabla
    const startY = doc.y;
    doc.text('Descripción', 50, startY);
    doc.text('Cant.', 350, startY);
    doc.text('P. Unit.', 400, startY);
    doc.text('Subtotal', 450, startY);
    
    doc.moveTo(50, doc.y + 3).lineTo(500, doc.y + 3).stroke();
    doc.moveDown(0.3);

    // Fila de datos
    const itemY = doc.y;
    doc.text(factura.concepto.descripcion, 50, itemY);
    doc.text(factura.concepto.cantidad.toString(), 350, itemY);
    doc.text(`$${factura.concepto.precioUnitario.toFixed(2)}`, 400, itemY);
    doc.text(`$${factura.concepto.subtotal.toFixed(2)}`, 450, itemY);
    
    doc.moveDown(1);

    // Totales
    doc.moveTo(50, doc.y).lineTo(500, doc.y).stroke();
    doc.moveDown(0.5);
    
    doc.fontSize(12);
    doc.text(`Subtotal: $${factura.subtotal.toFixed(2)}`, { align: 'right' });
    
    if (factura.iva.monto > 0) {
      doc.text(`IVA (${factura.iva.porcentaje}%): $${factura.iva.monto.toFixed(2)}`, { align: 'right' });
    }
    
    doc.fontSize(14).text(`TOTAL: $${factura.total.toFixed(2)}`, { align: 'right' });
    doc.moveDown(0.5);

    // Información del saldo (si está disponible del comprobante relacionado)
    if (factura.comprobanteRelacionado && factura.comprobanteRelacionado.montoDisponible !== undefined) {
      doc.fontSize(10);
      doc.text(`Saldo disponible después de la transacción: $${factura.comprobanteRelacionado.montoDisponible.toFixed(2)}`, { align: 'right' });
      doc.moveDown(0.3);
    }

    // Información adicional (más compacta)
    doc.fontSize(8);
    doc.text(`Comprobante relacionado: ${factura.comprobanteRelacionado.nroComprobante} | Fecha: ${factura.comprobanteRelacionado.fechaComprobante.toLocaleDateString('es-AR')}`, { align: 'left' });
    doc.moveDown(0.3);
    
    doc.text('Este ticket es válido como comprobante de pago. Gracias por utilizar nuestros servicios.', { align: 'center' });
    doc.moveDown(0.5);

    // Pie de página compacto en una línea
    doc.fontSize(6);
    doc.text(`Generado por: ${factura.generadaPor.nombre} ${factura.generadaPor.apellido} | ${new Date().toLocaleString('es-AR')}`, { align: 'center' });

    doc.end();

  } catch (error) {
    console.error('Error al generar PDF:', error);
    res.status(500).json({ mensaje: 'Error al generar PDF de factura' });
  }
};

// Anular factura
const anularFactura = async (req, res) => {
  try {
    const { nroFactura } = req.params;
    const { motivo } = req.body;

    if (!motivo || motivo.trim() === '') {
      return res.status(400).json({ mensaje: 'El motivo de anulación es obligatorio' });
    }

    const factura = await Factura.findOne({ nroFactura });
    if (!factura) {
      return res.status(404).json({ mensaje: 'Factura no encontrada' });
    }

    if (factura.estado === 'anulada') {
      return res.status(400).json({ mensaje: 'La factura ya está anulada' });
    }

    // Validación ARCA: No se puede anular después de 15 días
    const fechaEmision = new Date(factura.fechaEmision);
    const fechaActual = new Date();
    const diferenciaDias = Math.floor((fechaActual - fechaEmision) / (1000 * 60 * 60 * 24));

    if (diferenciaDias > 15) {
      return res.status(400).json({ 
        mensaje: `No se puede anular la factura. Han transcurrido ${diferenciaDias} días desde su emisión. Según regulaciones ARCA, solo se pueden anular facturas dentro de los 15 días posteriores a su emisión.`,
        diasTranscurridos: diferenciaDias,
        fechaEmision: factura.fechaEmision.toLocaleDateString('es-AR'),
        fechaLimiteAnulacion: new Date(fechaEmision.getTime() + (15 * 24 * 60 * 60 * 1000)).toLocaleDateString('es-AR')
      });
    }

    factura.estado = 'anulada';
    factura.motivoAnulacion = motivo;
    factura.fechaAnulacion = new Date();
    
    await factura.save();

    res.json({
      success: true,
      mensaje: 'Factura anulada correctamente',
      diasTranscurridos: diferenciaDias,
      factura
    });

  } catch (error) {
    console.error('Error al anular factura:', error);
    res.status(500).json({ mensaje: 'Error al anular factura' });
  }
};

module.exports = {
  generarFacturaPorComprobante,
  obtenerFacturas,
  generarPDFFactura,
  anularFactura
};
