/**
 * CONTROLADOR DEL FACTURADOR
 * 
 * Maneja la generación de facturas electrónicas desde comprobantes aprobados
 * Permite elegir entre Factura A o B y valida con ARCA/AFIP
 */

const Comprobante = require('../models/Comprobante');
const Factura = require('../models/Factura');
const Usuario = require('../models/Usuario');
const ConfiguracionEmpresa = require('../models/ConfiguracionEmpresa');
const afipFacturacionService = require('../services/afipFacturacionService');
const facturaPDFService = require('../services/facturaPDFService');
const ErrorResponse = require('../utils/errorResponse');

/**
 * Listar comprobantes aprobados pendientes de facturación
 * @route GET /api/facturador/comprobantes-aprobados
 * @access Private (Admin)
 */
const obtenerComprobantesAprobados = async (req, res, next) => {
  try {
    console.log('\n🔍 [FACTURADOR] Iniciando obtenerComprobantesAprobados');
    console.log('📋 [FACTURADOR] Usuario autenticado:', req.usuario);
    
    // Buscar comprobantes aprobados que NO estén facturados
    const query = {
      estado: 'aprobado',
      'facturaGenerada.nroFactura': { $exists: false }
    };
    
    console.log('🔎 [FACTURADOR] Query:', JSON.stringify(query, null, 2));
    
    const comprobantes = await Comprobante.find(query).sort({ fecha: -1 });
    
    console.log(`✅ [FACTURADOR] Comprobantes encontrados: ${comprobantes.length}`);
    
    if (comprobantes.length > 0) {
      console.log('📄 [FACTURADOR] Primeros 3 comprobantes:');
      comprobantes.slice(0, 3).forEach(c => {
        console.log(`   - ${c.nroComprobante} | ${c.usuario.nombre} | $${c.montoAcreditado} | Estado: ${c.estado}`);
      });
    }

    res.status(200).json({
      success: true,
      count: comprobantes.length,
      comprobantes
    });
    
    console.log('✅ [FACTURADOR] Respuesta enviada exitosamente\n');
  } catch (error) {
    console.error('❌ [FACTURADOR] Error al obtener comprobantes aprobados:', error);
    next(error);
  }
};

/**
 * Validar CUIT con AFIP/ARCA y obtener datos del contribuyente
 * @route POST /api/facturador/validar-cuit
 * @access Private (Admin)
 */
const validarCUITConAFIP = async (req, res, next) => {
  try {
    const { cuit } = req.body;

    if (!cuit) {
      return next(new ErrorResponse('CUIT es requerido', 400));
    }

    // Validar formato del CUIT
    const cuitLimpio = cuit.replace(/-/g, '');
    if (!/^\d{11}$/.test(cuitLimpio)) {
      return next(new ErrorResponse('CUIT inválido. Debe tener 11 dígitos', 400));
    }

    // Validar dígito verificador
    const esValido = afipFacturacionService.validarCUIT(cuitLimpio);
    if (!esValido) {
      return next(new ErrorResponse('CUIT inválido (dígito verificador incorrecto)', 400));
    }

    // Consultar datos del contribuyente en AFIP/ARCA
    let datosContribuyente = null;
    try {
      datosContribuyente = await afipFacturacionService.consultarContribuyente(cuitLimpio);
    } catch (error) {
      console.warn('No se pudieron obtener datos del contribuyente desde AFIP:', error.message);
      // Continuar aunque no se puedan obtener los datos
    }

    res.status(200).json({
      success: true,
      cuit: cuitLimpio,
      valido: true,
      datosContribuyente: datosContribuyente || {
        mensaje: 'CUIT válido pero no se pudieron obtener datos adicionales de AFIP'
      }
    });

  } catch (error) {
    console.error('Error al validar CUIT:', error);
    next(error);
  }
};

/**
 * Generar factura desde el facturador
 * Admin elige el tipo (A o B) y proporciona datos si es necesario
 * @route POST /api/facturador/generar-factura
 * @access Private (Admin)
 */
const generarFactura = async (req, res, next) => {
  try {
    const { 
      nroComprobante, 
      tipoFactura, // 'A' o 'B'
      cuit, // Requerido para Factura A
      razonSocial, // Opcional, se puede obtener de AFIP
      domicilioFiscal, // Opcional
      condicionIVA, // Opcional, se puede obtener de AFIP
      puntoVenta = 2 // Punto de venta 2 (testing limpio)
    } = req.body;
    
    const { dni: adminDni, nombre: adminNombre, apellido: adminApellido } = req.usuario;

    // Validaciones
    if (!nroComprobante) {
      return next(new ErrorResponse('Número de comprobante es requerido', 400));
    }

    if (!['A', 'B'].includes(tipoFactura)) {
      return next(new ErrorResponse('Tipo de factura debe ser "A" o "B"', 400));
    }

    if (tipoFactura === 'A' && !cuit) {
      return next(new ErrorResponse('CUIT es requerido para Factura A', 400));
    }

    // Buscar comprobante
    const comprobante = await Comprobante.findOne({ nroComprobante });

    if (!comprobante) {
      return next(new ErrorResponse('Comprobante no encontrado', 404));
    }

    if (comprobante.estado !== 'aprobado') {
      return next(new ErrorResponse('El comprobante debe estar aprobado para facturar', 400));
    }

    if (comprobante.facturado) {
      return next(new ErrorResponse('El comprobante ya fue facturado', 400));
    }

    // Verificar si ya existe una factura
    const facturaExistente = await Factura.findOne({
      'comprobanteRelacionado.nroComprobante': nroComprobante,
      estado: { $ne: 'anulada' }
    });

    if (facturaExistente) {
      return next(new ErrorResponse('Ya existe una factura para este comprobante', 400));
    }

    // Obtener cliente
    const cliente = await Usuario.findOne({ dni: comprobante.usuario.dni });
    if (!cliente) {
      return next(new ErrorResponse('Cliente no encontrado', 404));
    }

    // Obtener configuración de empresa
    const configEmpresa = await ConfiguracionEmpresa.findOne();
    if (!configEmpresa) {
      return next(new ErrorResponse('Configuración de empresa no encontrada', 500));
    }

    // Preparar datos del cliente según tipo de factura
    let datosCliente = {};
    let tipoComprobanteAFIP;
    let condicionIVACliente;

    if (tipoFactura === 'A') {
      // Factura A - Responsable Inscripto
      const cuitLimpio = cuit.replace(/-/g, '');
      
      // Validar CUIT
      const esValido = afipFacturacionService.validarCUIT(cuitLimpio);
      if (!esValido) {
        return next(new ErrorResponse('CUIT inválido', 400));
      }

      // Intentar obtener datos de AFIP
      let datosAFIP = null;
      try {
        datosAFIP = await afipFacturacionService.consultarContribuyente(cuitLimpio);
      } catch (error) {
        console.warn('No se pudieron obtener datos de AFIP:', error.message);
      }

      tipoComprobanteAFIP = 1; // Factura A
      condicionIVACliente = condicionIVA || datosAFIP?.condicionIVA || 'Responsable Inscripto';

      datosCliente = {
        tipoDocumento: 80, // CUIT
        tipoDocumentoDescripcion: 'CUIT',
        numeroDocumento: cuitLimpio,
        nombre: cliente.nombre,
        apellido: cliente.apellido,
        razonSocial: razonSocial || datosAFIP?.razonSocial || `${cliente.apellido}, ${cliente.nombre}`,
        email: cliente.email,
        domicilio: domicilioFiscal || datosAFIP?.domicilio || '',
        condicionIva: condicionIVACliente
      };

      // Actualizar datos fiscales del cliente en la BD
      cliente.cuit = cuitLimpio;
      cliente.condicionIVA = condicionIVACliente;
      await cliente.save();

    } else {
      // Factura B - Consumidor Final / Monotributo
      tipoComprobanteAFIP = 6; // Factura B
      condicionIVACliente = condicionIVA || 'Consumidor Final'; // Usar la condición proporcionada o default

      datosCliente = {
        tipoDocumento: 96, // DNI
        tipoDocumentoDescripcion: 'DNI',
        numeroDocumento: cliente.dni,
        nombre: cliente.nombre,
        apellido: cliente.apellido,
        email: cliente.email,
        condicionIva: condicionIVACliente
      };
      
      // Actualizar condición IVA en la BD si se proporcionó
      if (condicionIVA) {
        cliente.condicionIVA = condicionIVA;
        await cliente.save();
      }
    }

    const tipoComprobanteDescripcion = afipFacturacionService.getDescripcionTipoComprobante(tipoComprobanteAFIP);

    // Calcular montos según tipo de factura
    let importeNeto, importeIVA, importeTotal;
    
    if (tipoFactura === 'A') {
      // Factura A - discrimina IVA
      importeNeto = comprobante.montoAcreditado / 1.21;
      importeIVA = comprobante.montoAcreditado - importeNeto;
      importeTotal = comprobante.montoAcreditado;
    } else {
      // Factura B - IVA incluido
      importeNeto = comprobante.montoAcreditado;
      importeIVA = 0;
      importeTotal = comprobante.montoAcreditado;
    }

    // Preparar datos para AFIP
    const datosFacturaAFIP = {
      puntoVenta: puntoVenta,
      tipoComprobante: tipoComprobanteAFIP,
      concepto: 2, // Servicios
      cliente: {
        tipoDocumento: datosCliente.tipoDocumento,
        numeroDocumento: datosCliente.numeroDocumento,
        nombre: datosCliente.nombre,
        apellido: datosCliente.apellido,
        condicionIVA: datosCliente.condicionIva,
        email: datosCliente.email
      },
      items: [{
        descripcion: `Acreditación de saldo - Comprobante ${nroComprobante}`,
        cantidad: 1,
        precioUnitario: comprobante.montoAcreditado,
        alicuotaIVA: tipoFactura === 'A' ? 21 : 0,
      }],
      montoTotal: importeTotal,
      montoNeto: importeNeto,
      montoIVA: importeIVA,
      fechaServicioDesde: comprobante.fecha,
      fechaServicioHasta: comprobante.fecha
    };

    // Generar factura en AFIP
    console.log(`📤 Generando ${tipoComprobanteDescripcion} en AFIP para comprobante ${nroComprobante}...`);
    
    const respuestaAFIP = await afipFacturacionService.crearFacturaElectronica(datosFacturaAFIP);

    console.log(`✅ CAE recibido: ${respuestaAFIP.CAE}`);

    // Crear factura en base de datos
    // Normalizar condición IVA del emisor
    let condicionIvaEmisor = configEmpresa.condicionIva || 'Responsable Inscripto';
    // Normalizar valores (quitar "IVA" del inicio si existe)
    condicionIvaEmisor = condicionIvaEmisor.replace(/^IVA\s+/i, '');
    
    const factura = await Factura.create({
      cae: respuestaAFIP.CAE,
      caeFechaVencimiento: respuestaAFIP.CAEFchVto,
      puntoVenta: puntoVenta,
      tipoComprobante: tipoComprobanteAFIP,
      tipoComprobanteDescripcion: tipoComprobanteDescripcion,
      numeroComprobante: respuestaAFIP.CbteDesde,
      nroFactura: `${String(puntoVenta).padStart(5, '0')}-${String(respuestaAFIP.CbteDesde).padStart(8, '0')}`,
      concepto: 2,
      emisor: {
        razonSocial: configEmpresa.razonSocial,
        cuit: configEmpresa.cuit,
        domicilio: {
          calle: configEmpresa.domicilio.calle,
          numero: configEmpresa.domicilio.numero,
          piso: configEmpresa.domicilio.piso,
          departamento: configEmpresa.domicilio.departamento,
          localidad: configEmpresa.domicilio.localidad,
          provincia: configEmpresa.domicilio.provincia,
          codigoPostal: configEmpresa.domicilio.codigoPostal,
          domicilioCompleto: configEmpresa.getDomicilioCompleto()
        },
        condicionIva: condicionIvaEmisor
      },
      cliente: datosCliente,
      items: [{
        descripcion: `Acreditación de saldo - Comprobante ${nroComprobante}`,
        cantidad: 1,
        precioUnitario: comprobante.montoAcreditado,
        alicuotaIVA: tipoFactura === 'A' ? 21 : 0,
        importeIVA: importeIVA,
        subtotal: comprobante.montoAcreditado
      }],
      importeNeto: importeNeto,
      importeIVA: importeIVA,
      importeTotal: importeTotal,
      observaciones: `Factura ${tipoFactura} generada desde facturador`,
      estado: 'emitida',
      comprobanteRelacionado: {
        nroComprobante: comprobante.nroComprobante,
        fecha: comprobante.fecha,
        monto: comprobante.montoAcreditado
      },
      generadaPor: {
        dni: adminDni,
        nombre: adminNombre,
        apellido: adminApellido,
        rol: 'admin'
      }
    });

    // Actualizar comprobante - mantener estado aprobado pero marcar como facturado
    comprobante.facturado = true;
    comprobante.facturaGenerada = {
      nroFactura: factura.nroFactura,
      cae: factura.cae,
      fechaEmision: factura.fechaEmision,
      tipoComprobante: factura.tipoComprobante,
      tipoComprobanteDescripcion: factura.tipoComprobanteDescripcion
    };
    await comprobante.save();

    res.status(200).json({
      success: true,
      mensaje: `${tipoComprobanteDescripcion} generada exitosamente`,
      factura: {
        nroFactura: factura.nroFactura,
        cae: factura.cae,
        tipoComprobante: factura.tipoComprobanteDescripcion,
        importeNeto: factura.importeNeto,
        importeIVA: factura.importeIVA,
        importeTotal: factura.importeTotal,
        cliente: {
          documento: datosCliente.numeroDocumento,
          tipoDocumento: datosCliente.tipoDocumentoDescripcion,
          razonSocial: datosCliente.razonSocial || `${datosCliente.apellido}, ${datosCliente.nombre}`,
          condicionIVA: datosCliente.condicionIva
        }
      }
    });

  } catch (error) {
    console.error('Error al generar factura:', error);
    next(error);
  }
};

/**
 * Obtener facturas generadas con filtros
 * @route GET /api/facturador/facturas
 * @access Private (Admin)
 */
const obtenerFacturas = async (req, res, next) => {
  try {
    const { 
      fechaDesde, 
      fechaHasta, 
      tipoFactura, 
      estado, 
      busqueda,
      limite = 50,
      pagina = 1
    } = req.query;

    // Construir filtro
    const filtro = {};

    if (fechaDesde || fechaHasta) {
      filtro.fechaEmision = {};
      if (fechaDesde) filtro.fechaEmision.$gte = new Date(fechaDesde);
      if (fechaHasta) filtro.fechaEmision.$lte = new Date(fechaHasta);
    }

    if (tipoFactura) {
      const tipoMap = {
        'A': 1,
        'B': 6,
        'C': 11
      };
      filtro.tipoComprobante = tipoMap[tipoFactura];
    }

    if (estado) {
      filtro.estado = estado;
    }

    if (busqueda) {
      filtro.$or = [
        { nroFactura: { $regex: busqueda, $options: 'i' } },
        { cae: { $regex: busqueda, $options: 'i' } },
        { 'cliente.numeroDocumento': { $regex: busqueda, $options: 'i' } },
        { 'cliente.nombre': { $regex: busqueda, $options: 'i' } },
        { 'cliente.apellido': { $regex: busqueda, $options: 'i' } }
      ];
    }

    const skip = (parseInt(pagina) - 1) * parseInt(limite);

    const facturas = await Factura.find(filtro)
      .sort({ fechaEmision: -1 })
      .limit(parseInt(limite))
      .skip(skip);

    const total = await Factura.countDocuments(filtro);

    res.status(200).json({
      success: true,
      facturas,
      paginacion: {
        total,
        pagina: parseInt(pagina),
        limite: parseInt(limite),
        totalPaginas: Math.ceil(total / parseInt(limite))
      }
    });

  } catch (error) {
    console.error('❌ Error al obtener facturas:', error);
    next(error);
  }
};

/**
 * Generar PDF de una factura
 * @route GET /api/facturador/facturas/:nroFactura/pdf
 * @access Private (Admin)
 */
const generarPDFFactura = async (req, res, next) => {
  try {
    const { nroFactura } = req.params;

    console.log(`\n📄 [PDF] Generando PDF para comprobante: ${nroFactura}`);

    // Buscar la factura o nota de crédito
    const factura = await Factura.findOne({ nroFactura });

    if (!factura) {
      return res.status(404).json({
        success: false,
        mensaje: 'Comprobante no encontrado'
      });
    }

    // Determinar tipo de comprobante (A, B, C) y si es NC
    let tipoFactura = 'B'; // Por defecto
    const esNotaCredito = factura.tipoComprobanteDescripcion.includes('Nota de Crédito') || 
                          factura.tipoComprobanteDescripcion.includes('NC');
    
    if (factura.tipoComprobanteDescripcion.includes('A')) {
      tipoFactura = 'A';
    } else if (factura.tipoComprobanteDescripcion.includes('C')) {
      tipoFactura = 'C';
    }

    console.log(`📋 [PDF] Tipo de comprobante: ${esNotaCredito ? 'NC' : 'Factura'} ${tipoFactura}`);

    // Generar el PDF (mismo template para factura y NC)
    const pdfStream = facturaPDFService.generarPDF(factura, tipoFactura);

    // Configurar headers de respuesta
    const nombreArchivo = esNotaCredito ? `NC_${nroFactura}.pdf` : `Factura_${nroFactura}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${nombreArchivo}"`);

    // Enviar el stream del PDF
    pdfStream.pipe(res);

    console.log(`✅ [PDF] PDF generado y enviado exitosamente\n`);

  } catch (error) {
    console.error('❌ Error al generar PDF:', error);
    next(error);
  }
};

/**
 * Obtener factura con su comprobante asociado
 * @route GET /api/facturador/facturas/:nroFactura/completa
 * @access Private (Admin)
 */
const obtenerFacturaCompleta = async (req, res, next) => {
  try {
    const { nroFactura } = req.params;

    console.log(`\n🔍 [FACTURA COMPLETA] Buscando factura: ${nroFactura}`);

    // Buscar la factura
    const factura = await Factura.findOne({ nroFactura });

    if (!factura) {
      return res.status(404).json({
        success: false,
        mensaje: 'Factura no encontrada'
      });
    }

    // Buscar el comprobante asociado
    const comprobante = await Comprobante.findOne({
      'facturaGenerada.nroFactura': nroFactura
    });

    console.log(`✅ [FACTURA COMPLETA] Factura encontrada`);
    console.log(`   Comprobante asociado: ${comprobante ? comprobante.nroComprobante : 'No encontrado'}`);

    res.status(200).json({
      success: true,
      factura,
      comprobante: comprobante || null
    });

  } catch (error) {
    console.error('❌ Error al obtener factura completa:', error);
    next(error);
  }
};

/**
 * Obtener facturas anulables (últimos 15 días)
 * @route GET /api/facturador/facturas-anulables
 * @access Private (Admin)
 */
const obtenerFacturasAnulables = async (req, res, next) => {
  try {
    console.log('\n🔍 [FACTURADOR] Obteniendo facturas anulables');
    
    // Calcular fecha hace 15 días
    const hace15Dias = new Date();
    hace15Dias.setDate(hace15Dias.getDate() - 15);
    
    console.log('📅 Fecha límite (15 días atrás):', hace15Dias.toISOString());
    
    // Buscar facturas emitidas en los últimos 15 días que no estén anuladas
    const facturas = await Factura.find({
      fechaEmision: { $gte: hace15Dias },
      estado: { $ne: 'anulada' }
    }).sort({ fechaEmision: -1 });
    
    console.log(`✅ Facturas anulables encontradas: ${facturas.length}`);
    
    if (facturas.length > 0) {
      console.log('📄 Primeras facturas:');
      facturas.slice(0, 3).forEach(f => {
        const diasTranscurridos = Math.floor((new Date() - new Date(f.fechaEmision)) / (1000 * 60 * 60 * 24));
        console.log(`   - ${f.nroFactura} | ${f.cliente.razonSocial || f.cliente.nombre} | $${f.importeTotal} | ${diasTranscurridos} días`);
      });
    }
    
    res.status(200).json({
      success: true,
      count: facturas.length,
      facturas
    });
    
  } catch (error) {
    console.error('❌ Error al obtener facturas anulables:', error);
    next(error);
  }
};

/**
 * Obtener historial completo (facturas y notas de crédito)
 * @route GET /api/facturador/historial-completo
 * @access Private (Admin)
 */
const obtenerHistorialCompleto = async (req, res, next) => {
  try {
    console.log('\n🔍 [FACTURADOR] Obteniendo historial completo');
    
    // Por ahora solo obtener facturas (las notas de crédito se implementarán después)
    const facturas = await Factura.find().sort({ fechaEmision: -1 });
    
    const facturasConTipo = facturas.map(f => ({
      ...f.toObject(),
      tipo: 'factura',
      tipoComprobante: f.tipoComprobante
    }));
    
    console.log(`✅ Total comprobantes en historial: ${facturasConTipo.length}`);
    
    res.status(200).json({
      success: true,
      count: facturasConTipo.length,
      historial: facturasConTipo
    });
    
  } catch (error) {
    console.error('❌ Error al obtener historial completo:', error);
    next(error);
  }
};

/**
 * Generar Nota de Crédito para anular una factura
 * @route POST /api/facturador/generar-nota-credito
 * @access Private (Admin)
 */
const generarNotaCredito = async (req, res, next) => {
  try {
    const { nroFactura, motivo } = req.body;
    const { dni: adminDni, nombre: adminNombre, apellido: adminApellido } = req.usuario;

    console.log(`📝 Generando Nota de Crédito para factura ${nroFactura}...`);

    // Validación de datos
    if (!nroFactura || !motivo) {
      return next(new ErrorResponse('Número de factura y motivo son requeridos', 400));
    }

    // Buscar factura original
    const facturaOriginal = await Factura.findOne({ nroFactura });
    if (!facturaOriginal) {
      return next(new ErrorResponse('Factura no encontrada', 404));
    }

    // Validar que no esté ya anulada
    if (facturaOriginal.estado === 'anulada') {
      return next(new ErrorResponse('La factura ya está anulada', 400));
    }

    // Validar límite de 15 días (ARCA)
    const fechaEmision = new Date(facturaOriginal.fechaEmision);
    const fechaActual = new Date();
    const diasTranscurridos = Math.floor((fechaActual - fechaEmision) / (1000 * 60 * 60 * 24));

    if (diasTranscurridos > 15) {
      return next(new ErrorResponse(
        `No se puede anular. Han transcurrido ${diasTranscurridos} días. Límite ARCA: 15 días`, 
        400
      ));
    }

    console.log(`✅ Factura válida para anular (${diasTranscurridos} días desde emisión)`);

    // Obtener configuración de empresa
    const configEmpresa = await ConfiguracionEmpresa.findOne();
    if (!configEmpresa) {
      return next(new ErrorResponse('Configuración de empresa no encontrada', 500));
    }

    // Determinar tipo de NC según tipo de factura original
    let tipoComprobanteNC;
    let tipoComprobanteDescripcion;
    
    if (facturaOriginal.tipoComprobante === 1) {
      // Factura A → NC A
      tipoComprobanteNC = 3;
      tipoComprobanteDescripcion = 'Nota de Crédito A';
    } else if (facturaOriginal.tipoComprobante === 6) {
      // Factura B → NC B
      tipoComprobanteNC = 8;
      tipoComprobanteDescripcion = 'Nota de Crédito B';
    } else {
      return next(new ErrorResponse('Tipo de factura no soportado para NC', 400));
    }

    // Preparar datos para AFIP (similar a factura pero como NC)
    const datosNCAfip = {
      puntoVenta: facturaOriginal.puntoVenta,
      tipoComprobante: tipoComprobanteNC,
      concepto: 2, // Servicios
      cliente: {
        tipoDocumento: facturaOriginal.cliente.tipoDocumento,
        numeroDocumento: facturaOriginal.cliente.numeroDocumento,
        nombre: facturaOriginal.cliente.nombre,
        apellido: facturaOriginal.cliente.apellido,
        condicionIVA: facturaOriginal.cliente.condicionIva,
        email: facturaOriginal.cliente.email
      },
      items: facturaOriginal.items,
      montoTotal: facturaOriginal.importeTotal,
      montoNeto: facturaOriginal.importeNeto,
      montoIVA: facturaOriginal.importeIVA,
      fechaServicioDesde: facturaOriginal.comprobanteRelacionado?.fecha || facturaOriginal.fechaEmision,
      fechaServicioHasta: facturaOriginal.comprobanteRelacionado?.fecha || facturaOriginal.fechaEmision,
      // Asociar con factura original
      comprobantesAsociados: [{
        tipo: facturaOriginal.tipoComprobante,
        puntoVenta: facturaOriginal.puntoVenta,
        numero: facturaOriginal.numeroComprobante,
        cuit: facturaOriginal.cliente.numeroDocumento
      }]
    };

    // Generar NC en AFIP
    console.log(`📤 Generando ${tipoComprobanteDescripcion} en AFIP...`);
    const respuestaAFIP = await afipFacturacionService.crearFacturaElectronica(datosNCAfip);
    console.log(`✅ CAE recibido para NC: ${respuestaAFIP.CAE}`);

    // Normalizar condición IVA del emisor
    let condicionIvaEmisor = configEmpresa.condicionIva || 'Responsable Inscripto';
    condicionIvaEmisor = condicionIvaEmisor.replace(/^IVA\s+/i, '');

    // Crear NC en base de datos (usando el mismo modelo Factura)
    const notaCredito = await Factura.create({
      cae: respuestaAFIP.CAE,
      caeFechaVencimiento: respuestaAFIP.CAEFchVto,
      puntoVenta: facturaOriginal.puntoVenta,
      tipoComprobante: tipoComprobanteNC,
      tipoComprobanteDescripcion: tipoComprobanteDescripcion,
      numeroComprobante: respuestaAFIP.CbteDesde,
      nroFactura: `NC-${String(facturaOriginal.puntoVenta).padStart(5, '0')}-${String(respuestaAFIP.CbteDesde).padStart(8, '0')}`,
      concepto: 2,
      emisor: {
        razonSocial: configEmpresa.razonSocial,
        cuit: configEmpresa.cuit,
        domicilio: {
          calle: configEmpresa.domicilio.calle,
          numero: configEmpresa.domicilio.numero,
          piso: configEmpresa.domicilio.piso,
          departamento: configEmpresa.domicilio.departamento,
          localidad: configEmpresa.domicilio.localidad,
          provincia: configEmpresa.domicilio.provincia,
          codigoPostal: configEmpresa.domicilio.codigoPostal,
          domicilioCompleto: configEmpresa.getDomicilioCompleto()
        },
        condicionIva: condicionIvaEmisor
      },
      cliente: facturaOriginal.cliente,
      items: facturaOriginal.items.map(item => ({
        ...item,
        descripcion: `ANULACIÓN - ${item.descripcion}`
      })),
      importeNeto: facturaOriginal.importeNeto,
      importeIVA: facturaOriginal.importeIVA,
      importeTotal: facturaOriginal.importeTotal,
      observaciones: `Nota de Crédito - Motivo: ${motivo} - Anula factura ${facturaOriginal.nroFactura}`,
      estado: 'emitida',
      comprobanteRelacionado: facturaOriginal.comprobanteRelacionado,
      facturaAnulada: {
        nroFactura: facturaOriginal.nroFactura,
        cae: facturaOriginal.cae,
        fechaEmision: facturaOriginal.fechaEmision,
        motivo: motivo
      },
      generadaPor: {
        dni: adminDni,
        nombre: adminNombre,
        apellido: adminApellido,
        rol: 'admin'
      }
    });

    // Marcar factura original como anulada
    facturaOriginal.estado = 'anulada';
    facturaOriginal.notaCreditoAsociada = {
      nroComprobante: notaCredito.nroFactura,
      cae: notaCredito.cae,
      fechaEmision: notaCredito.fechaEmision,
      motivo: motivo
    };
    await facturaOriginal.save();

    console.log(`✅ Factura ${facturaOriginal.nroFactura} anulada correctamente`);

    res.status(200).json({
      success: true,
      mensaje: `${tipoComprobanteDescripcion} generada exitosamente`,
      notaCredito: {
        nroComprobante: notaCredito.nroFactura,
        cae: notaCredito.cae,
        tipoComprobante: tipoComprobanteDescripcion,
        importeTotal: notaCredito.importeTotal,
        facturaAnulada: facturaOriginal.nroFactura,
        motivo: motivo
      }
    });

  } catch (error) {
    console.error('❌ Error al generar nota de crédito:', error);
    next(error);
  }
};

module.exports = {
  obtenerComprobantesAprobados,
  validarCUITConAFIP,
  generarFactura,
  obtenerFacturas,
  generarPDFFactura,
  obtenerFacturaCompleta,
  obtenerFacturasAnulables,
  obtenerHistorialCompleto,
  generarNotaCredito
};
