const Comprobante = require('../models/Comprobante');
const Usuario = require('../models/Usuario');
const ErrorResponse = require('../utils/errorResponse');
const PDFDocument = require('pdfkit');

const crearComprobante = async (req, res, next) => {
  try {
    const { dni, montoAcreditado, usuario } = req.body;
    
    if (!dni || !montoAcreditado || !usuario) {
      return next(new ErrorResponse('Faltan datos requeridos', 400));
    }

    const nroComprobante = 'COMP-' + Date.now();
    
    const comprobante = await Comprobante.create({
      nroComprobante,
      usuario,
      montoAcreditado,
      montoDisponible: usuario.montoDisponible || 0 + montoAcreditado,
      fecha: new Date()
    });

    res.status(200).json({
      success: true,
      comprobante
    });
  } catch (error) {
    next(error);
  }
};

const obtenerComprobantes = async (req, res, next) => {
  try {
    const { dni, rol } = req.usuario;

    let comprobantes;

    // Si es admin, puede ver todos los comprobantes
    // Si es usuario, solo ve los suyos
    if (rol === 'admin') {
      // Admin puede filtrar por estado si lo desea
      const { estado } = req.query;
      const filtro = estado ? { estado } : {};
      comprobantes = await Comprobante.find(filtro).sort({ fecha: -1 });
    } else {
      // Usuario normal solo ve sus comprobantes
      comprobantes = await Comprobante.find({
        'usuario.dni': dni
      }).sort({ fecha: -1 });
    }

    res.status(200).json({
      success: true,
      count: comprobantes.length,
      comprobantes
    });
  } catch (error) {
    next(error);
  }
};

const obtenerComprobantePorNumero = async (req, res, next) => {
  try {
    const { nroComprobante } = req.params;
    const { dni } = req.usuario;

    const comprobante = await Comprobante.findOne({
      nroComprobante,
      'usuario.dni': dni
    });

    if (!comprobante) {
      return next(new ErrorResponse('Comprobante no encontrado', 404));
    }

    res.status(200).json({
      success: true,
      comprobante
    });
  } catch (error) {
    next(error);
  }
};

// Generar PDF del comprobante
const generarPDFComprobante = async (req, res) => {
  try {
    const { nroComprobante } = req.params;
    const { dni, rol } = req.usuario;

    console.log('Generando PDF para comprobante:', nroComprobante);
    console.log('Usuario autenticado:', { dni, rol });

    // Si es admin, puede acceder a cualquier comprobante
    // Si es usuario normal, solo puede acceder a sus propios comprobantes
    const filtroComprobante = rol === 'admin' 
      ? { nroComprobante }
      : { nroComprobante, 'usuario.dni': dni };

    console.log('Filtro aplicado:', filtroComprobante);

    const comprobante = await Comprobante.findOne(filtroComprobante);

    if (!comprobante) {
      console.log('Comprobante no encontrado con filtro:', filtroComprobante);
      return res.status(404).json({ mensaje: 'Comprobante no encontrado' });
    }

    console.log('Comprobante encontrado:', comprobante.nroComprobante);

    // Obtener los vehículos del comprobante y del usuario actual para mayor completitud
    const dominiosVehiculos = comprobante.vehiculos || [];
    let vehiculosActuales = [];
    
    // Si no hay vehículos en el comprobante, obtener los actuales del usuario
    if (dominiosVehiculos.length === 0) {
      try {
        const usuarioActual = await Usuario.findOne({ dni: comprobante.usuario.dni });
        vehiculosActuales = usuarioActual?.vehiculos?.map(v => v.dominio) || [];
      } catch (error) {
        console.log('Error al obtener vehículos actuales:', error);
      }
    }
    
    console.log('Vehículos en el comprobante:', dominiosVehiculos);
    console.log('Vehículos actuales del usuario:', vehiculosActuales);

    const nombreArchivo = `comprobante_${nroComprobante.replace('-', '_')}.pdf`;
    
    // Configurar headers de respuesta
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}"`);

    // Crear documento PDF
    const doc = new PDFDocument({ margin: 50 });
    doc.pipe(res);

    // Encabezado
    doc.fontSize(18).text('COMPROBANTE DE ACREDITACIÓN', { align: 'center' });
    doc.fontSize(14).text('TICKET DE CONSTANCIA DE COBRO', { align: 'center' });
    doc.moveDown(0.5);

    // Número de comprobante destacado
    doc.fontSize(12).text('COMPROBANTE N°:', { continued: true, width: 150 });
    doc.fontSize(14).text(` ${comprobante.nroComprobante}`, { underline: true });
    doc.moveDown(0.5);

    // Datos del propietario
    doc.fontSize(12).text('DATOS DEL PROPIETARIO', { underline: true });
    doc.fontSize(9);
    doc.text(`Apellido y Nombre: ${comprobante.usuario.apellido}, ${comprobante.usuario.nombre}`);
    doc.text(`DNI: ${comprobante.usuario.dni}`);
    doc.moveDown(0.5);

    // Fecha y hora de la transacción
    doc.fontSize(12).text('DATOS DE LA TRANSACCIÓN', { underline: true });
    doc.fontSize(9);
    doc.text(`Fecha y Hora: ${comprobante.fecha.toLocaleString('es-AR', { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit', 
      hour: '2-digit', 
      minute: '2-digit' 
    })}`);
    doc.moveDown(0.5);

    // Información monetaria
    doc.fontSize(12).text('INFORMACIÓN MONETARIA', { underline: true });
    doc.fontSize(9);
    doc.text(`Monto Acreditado: $${comprobante.montoAcreditado.toFixed(2)}`);
    doc.text(`Saldo Disponible en Cuenta: $${comprobante.montoDisponible.toFixed(2)}`);
    doc.moveDown(0.5);

    // Vehículos registrados
    doc.fontSize(12).text('VEHÍCULOS REGISTRADOS', { underline: true });
    doc.fontSize(9);
    
    // Usar vehículos del comprobante si existen, sino los actuales
    const vehiculosParaMostrar = dominiosVehiculos.length > 0 ? dominiosVehiculos : vehiculosActuales;
    
    if (vehiculosParaMostrar.length > 0) {
      if (dominiosVehiculos.length > 0) {
        doc.text('Dominios asociados al momento de la transacción:');
      } else {
        doc.text('Dominios actualmente registrados en la cuenta:');
      }
      vehiculosParaMostrar.forEach((dominio) => {
        doc.text(`• ${dominio}`, { indent: 20 });
      });
    } else {
      doc.text('No hay vehículos registrados en esta cuenta.');
    }
    doc.moveDown(0.5);

    // Información adicional
    doc.fontSize(8);
    doc.text('Este comprobante es válido como constancia de acreditación de fondos.', { align: 'center' });
    doc.text('Conserve este ticket para sus registros contables.', { align: 'center' });
    doc.moveDown(0.5);

    // Pie de página
    doc.fontSize(6);
    doc.text(`Generado el: ${new Date().toLocaleString('es-AR')}`, { align: 'center' });

    doc.end();

  } catch (error) {
    console.error('Error al generar PDF del comprobante:', error);
    res.status(500).json({ mensaje: 'Error al generar PDF del comprobante' });
  }
};

/**
 * Aprobar o rechazar un comprobante (solo admin)
 * NUEVO FLUJO: Solo aprueba o rechaza, NO genera factura
 * La factura se genera después desde el facturador
 */
const aprobarComprobante = async (req, res, next) => {
  try {
    const { nroComprobante } = req.params;
    const { estado, observaciones } = req.body;
    const { dni, nombre, apellido, rol } = req.usuario;

    // Verificar que sea admin
    if (rol !== 'admin') {
      return next(new ErrorResponse('No tiene permisos para aprobar comprobantes', 403));
    }

    // Validar estado
    if (!['aprobado', 'rechazado'].includes(estado)) {
      return next(new ErrorResponse('Estado inválido. Debe ser "aprobado" o "rechazado"', 400));
    }

    // Buscar el comprobante
    const comprobante = await Comprobante.findOne({ nroComprobante });

    if (!comprobante) {
      return next(new ErrorResponse('Comprobante no encontrado', 404));
    }

    // Verificar que esté pendiente
    if (comprobante.estado !== 'pendiente') {
      return next(new ErrorResponse(`El comprobante ya fue ${comprobante.estado}`, 400));
    }

    // Si se aprueba, actualizar el saldo del usuario
    if (estado === 'aprobado') {
      const usuario = await Usuario.findOne({ dni: comprobante.usuario.dni });
      if (!usuario) {
        return next(new ErrorResponse('Usuario no encontrado', 404));
      }

      // Actualizar saldo del usuario
      usuario.montoDisponible = (usuario.montoDisponible || 0) + comprobante.montoAcreditado;
      await usuario.save();
    }

    // Actualizar estado y datos
    comprobante.estado = estado;
    comprobante.aprobadoPor = {
      dni,
      nombre,
      apellido,
      fecha: new Date()
    };
    comprobante.observaciones = observaciones || '';
    
    await comprobante.save();

    return res.status(200).json({
      success: true,
      mensaje: estado === 'aprobado' 
        ? 'Comprobante aprobado exitosamente. El saldo del usuario ha sido actualizado.'
        : 'Comprobante rechazado',
      comprobante
    });

  } catch (error) {
    console.error('Error al aprobar/rechazar comprobante:', error);
    next(error);
  }
};

module.exports = {
  crearComprobante,
  obtenerComprobantes,
  obtenerComprobantePorNumero,
  generarPDFComprobante,
  aprobarComprobante
};
