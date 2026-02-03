/**
 * CONTROLADOR DE FACTURACIÓN ELECTRÓNICA AFIP/ARCA
 * 
 * CUMPLIMIENTO NORMATIVO COMPLETO:
 * - RG 1415/03, RG 2485/08, RG 2904/10, RG 4290/18
 * - Validación de todos los campos obligatorios
 * - Obtención de CAE para cada comprobante
 * - Almacenamiento seguro de datos fiscales
 * - Trazabilidad completa de operaciones
 * 
 * IMPORTANTE:
 * Este controlador NO permite evasión fiscal ni operaciones ilegales
 * Todas las facturas son registradas en AFIP con CAE válido
 */

const Factura = require('../models/Factura');
const Comprobante = require('../models/Comprobante');
const ConfiguracionEmpresa = require('../models/ConfiguracionEmpresa');
const Usuario = require('../models/Usuario');
const afipFacturacionService = require('../services/afipFacturacionService');

/**
 * Crea una factura electrónica con autorización de AFIP
 * 
 * PROCESO LEGAL:
 * 1. Validar datos del comprobante de pago
 * 2. Validar datos del cliente
 * 3. Preparar datos según normativa AFIP
 * 4. Solicitar CAE a AFIP
 * 5. Guardar factura con CAE en base de datos
 * 6. Generar PDF (opcional)
 * 
 * @route POST /api/facturas-electronicas/crear
 * @access Private (Admin)
 */
const crearFacturaElectronica = async (req, res) => {
  try {
    const { comprobanteId, tipoComprobante, puntoVenta } = req.body;

    // ========== VALIDACIÓN 1: Comprobante de Pago ==========
    
    const comprobante = await Comprobante.findOne({ 
      nroComprobante: comprobanteId,
      estado: 'aprobado'
    });

    if (!comprobante) {
      return res.status(404).json({
        success: false,
        mensaje: 'Comprobante no encontrado o no está aprobado'
      });
    }

    // Verificar que no tenga factura ya emitida
    const facturaExistente = await Factura.findOne({
      'comprobanteRelacionado.nroComprobante': comprobanteId,
      estado: { $ne: 'anulada' }
    });

    if (facturaExistente) {
      return res.status(400).json({
        success: false,
        mensaje: 'Ya existe una factura emitida para este comprobante',
        facturaExistente: {
          nroFactura: facturaExistente.nroFactura,
          cae: facturaExistente.cae
        }
      });
    }

    // ========== VALIDACIÓN 2: Cliente ==========
    
    const cliente = await Usuario.findOne({ dni: comprobante.usuario.dni });
    
    if (!cliente) {
      return res.status(404).json({
        success: false,
        mensaje: 'Cliente no encontrado'
      });
    }

    // ========== VALIDACIÓN 3: Configuración de Empresa ==========
    
    const configEmpresa = await ConfiguracionEmpresa.findOne();
    
    if (!configEmpresa) {
      return res.status(500).json({
        success: false,
        mensaje: 'Configuración de empresa no encontrada. Configure los datos fiscales primero.'
      });
    }

    // ========== PREPARACIÓN DE DATOS PARA AFIP ==========
    
    // Determinar tipo de comprobante si no se especificó
    const tipoComprobanteAFIP = tipoComprobante || 
      afipFacturacionService.determinarTipoComprobante(
        cliente.condicionIVA || 'Consumidor Final',
        true // Es ticket
      );

    // Calcular importes
    const montoTotal = comprobante.montoAcreditado;
    let montoNeto, montoIVA;

    // Para Factura B o Ticket a consumidor final, el IVA está incluido
    if ([6, 82].includes(tipoComprobanteAFIP)) {
      montoNeto = afipFacturacionService.calcularMontoNeto(montoTotal, 21);
      montoIVA = montoTotal - montoNeto;
    } else {
      // Para otros tipos, discriminar IVA
      montoNeto = montoTotal;
      montoIVA = afipFacturacionService.calcularIVA(montoNeto, 21);
    }

    // Preparar datos para AFIP
    const datosFacturaAFIP = {
      puntoVenta: puntoVenta || configEmpresa.puntoVenta || 1,
      tipoComprobante: tipoComprobanteAFIP,
      concepto: 2, // Servicios
      cliente: {
        tipoDocumento: 96, // DNI
        numeroDocumento: cliente.dni,
        nombre: cliente.nombre,
        apellido: cliente.apellido,
        razonSocial: `${cliente.apellido}, ${cliente.nombre}`
      },
      montoTotal: parseFloat(montoTotal.toFixed(2)),
      montoNeto: parseFloat(montoNeto.toFixed(2)),
      montoIVA: parseFloat(montoIVA.toFixed(2)),
      fechaServicioDesde: comprobante.fecha,
      fechaServicioHasta: comprobante.fecha,
      fechaVencimientoPago: new Date()
    };

    // ========== SOLICITAR CAE A AFIP ==========
    
    console.log('📤 Solicitando CAE a AFIP para comprobante:', comprobanteId);
    
    const respuestaAFIP = await afipFacturacionService.crearFacturaElectronica(datosFacturaAFIP);
    
    if (!respuestaAFIP.success || !respuestaAFIP.cae) {
      throw new Error('AFIP no autorizó el comprobante. No se recibió CAE.');
    }

    console.log('✅ CAE recibido de AFIP:', respuestaAFIP.cae);

    // ========== CREAR FACTURA EN BASE DE DATOS ==========
    
    // Número de factura completo
    const nroFactura = Factura.generarNumeroFacturaCompleto(
      respuestaAFIP.puntoVenta,
      respuestaAFIP.numeroComprobante
    );

    // Determinar descripción del tipo de comprobante
    const tiposComprobante = afipFacturacionService.getTiposComprobante();
    const tipoComprobanteDescripcion = tiposComprobante[tipoComprobanteAFIP] || 'Comprobante';

    // Crear instancia de factura
    const nuevaFactura = new Factura({
      // Datos de AFIP
      cae: respuestaAFIP.cae,
      caeFechaVencimiento: respuestaAFIP.caeFechaVencimiento,
      puntoVenta: respuestaAFIP.puntoVenta,
      tipoComprobante: respuestaAFIP.tipoComprobante,
      tipoComprobanteDescripcion: tipoComprobanteDescripcion,
      numeroComprobante: respuestaAFIP.numeroComprobante,
      nroFactura: nroFactura,
      concepto: 2, // Servicios
      
      // Emisor
      emisor: {
        razonSocial: configEmpresa.razonSocial,
        cuit: configEmpresa.cuit.replace(/-/g, ''),
        domicilio: {
          domicilioCompleto: `${configEmpresa.domicilio.calle} ${configEmpresa.domicilio.numero}, ${configEmpresa.domicilio.localidad}, ${configEmpresa.domicilio.provincia}`,
          calle: configEmpresa.domicilio.calle,
          numero: configEmpresa.domicilio.numero,
          localidad: configEmpresa.domicilio.localidad,
          provincia: configEmpresa.domicilio.provincia,
          codigoPostal: configEmpresa.domicilio.codigoPostal
        },
        condicionIva: configEmpresa.condicionIVA,
        ingresosBrutos: configEmpresa.ingresosBrutos,
        inicioActividades: configEmpresa.inicioActividades
      },
      
      // Cliente
      cliente: {
        tipoDocumento: 96,
        tipoDocumentoDescripcion: 'DNI',
        numeroDocumento: cliente.dni,
        nombre: cliente.nombre,
        apellido: cliente.apellido,
        email: cliente.email,
        condicionIva: 'Consumidor Final'
      },
      
      // Fechas
      fechaEmision: new Date(),
      fechaServicioDesde: comprobante.fecha,
      fechaServicioHasta: comprobante.fecha,
      
      // Items
      items: [{
        descripcion: 'Recarga de saldo - Servicio de estacionamiento',
        cantidad: 1,
        unidadMedida: 'unidades',
        precioUnitario: montoNeto,
        alicuotaIVA: 21,
        importeIVA: montoIVA,
        subtotal: montoNeto
      }],
      
      // Importes
      importeNeto: montoNeto,
      importeIVA: montoIVA,
      importeTotal: montoTotal,
      
      detalleIVA: [{
        alicuota: 21,
        baseImponible: montoNeto,
        importe: montoIVA
      }],
      
      // Comprobante relacionado
      comprobanteRelacionado: {
        nroComprobante: comprobante.nroComprobante,
        fechaComprobante: comprobante.fecha,
        tipo: 'recarga_saldo'
      },
      
      // Estado
      estado: 'emitida',
      
      // Generada por
      generadaPor: {
        dni: req.usuario.dni || req.usuario.id,
        nombre: req.usuario.nombre,
        apellido: req.usuario.apellido,
        rol: req.usuario.rol
      },
      
      // Respuesta completa de AFIP (para auditoría)
      respuestaAFIP: respuestaAFIP.respuestaCompleta,
      
      // URL de verificación con QR
      urlVerificacionAFIP: afipFacturacionService.generarURLVerificacionAFIP(
        respuestaAFIP.cae,
        respuestaAFIP.puntoVenta,
        respuestaAFIP.tipoComprobante,
        respuestaAFIP.numeroComprobante
      )
    });

    // Calcular importes (por si acaso)
    nuevaFactura.calcularImportes();

    // Guardar factura
    await nuevaFactura.save();

    console.log('✅ Factura guardada en base de datos:', nroFactura);

    // ========== RESPUESTA EXITOSA ==========
    
    res.status(201).json({
      success: true,
      mensaje: 'Factura electrónica creada y autorizada por AFIP exitosamente',
      factura: {
        id: nuevaFactura._id,
        nroFactura: nuevaFactura.nroFactura,
        cae: nuevaFactura.cae,
        caeFechaVencimiento: nuevaFactura.caeFechaVencimiento,
        tipoComprobante: tipoComprobanteDescripcion,
        fechaEmision: nuevaFactura.fechaEmision,
        cliente: {
          nombre: `${nuevaFactura.cliente.nombre} ${nuevaFactura.cliente.apellido}`,
          documento: nuevaFactura.cliente.numeroDocumento
        },
        importeTotal: nuevaFactura.importeTotal,
        urlVerificacion: nuevaFactura.urlVerificacionAFIP
      }
    });

  } catch (error) {
    console.error('❌ Error al crear factura electrónica:', error);
    
    res.status(500).json({
      success: false,
      mensaje: 'Error al crear factura electrónica',
      error: error.message,
      detalles: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

/**
 * Obtiene todas las facturas electrónicas
 * @route GET /api/facturas-electronicas
 * @access Private (Admin)
 */
const obtenerFacturasElectronicas = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      estado, 
      desde, 
      hasta,
      clienteDNI 
    } = req.query;

    // Construir filtro
    const filtro = {};
    
    if (estado) {
      filtro.estado = estado;
    }
    
    if (desde || hasta) {
      filtro.fechaEmision = {};
      if (desde) filtro.fechaEmision.$gte = new Date(desde);
      if (hasta) filtro.fechaEmision.$lte = new Date(hasta);
    }
    
    if (clienteDNI) {
      filtro['cliente.numeroDocumento'] = clienteDNI;
    }

    // Obtener facturas con paginación
    const facturas = await Factura.find(filtro)
      .sort({ fechaEmision: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .select('-respuestaAFIP'); // Excluir respuesta completa de AFIP

    const total = await Factura.countDocuments(filtro);

    res.status(200).json({
      success: true,
      facturas,
      paginacion: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit),
        limit: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Error al obtener facturas:', error);
    res.status(500).json({
      success: false,
      mensaje: 'Error al obtener facturas electrónicas',
      error: error.message
    });
  }
};

/**
 * Obtiene una factura electrónica por ID
 * @route GET /api/facturas-electronicas/:id
 * @access Private
 */
const obtenerFacturaPorId = async (req, res) => {
  try {
    const { id } = req.params;

    const factura = await Factura.findById(id);

    if (!factura) {
      return res.status(404).json({
        success: false,
        mensaje: 'Factura no encontrada'
      });
    }

    res.status(200).json({
      success: true,
      factura
    });

  } catch (error) {
    console.error('Error al obtener factura:', error);
    res.status(500).json({
      success: false,
      mensaje: 'Error al obtener factura',
      error: error.message
    });
  }
};

/**
 * Verifica el estado del servidor de AFIP
 * @route GET /api/facturas-electronicas/afip/estado
 * @access Private (Admin)
 */
const verificarEstadoAFIP = async (req, res) => {
  try {
    const estado = await afipFacturacionService.verificarEstadoServidor();

    res.status(200).json({
      success: true,
      mensaje: 'Estado del servidor de AFIP',
      afip: estado
    });

  } catch (error) {
    console.error('Error al verificar estado AFIP:', error);
    res.status(500).json({
      success: false,
      mensaje: 'Error al verificar estado de AFIP',
      error: error.message
    });
  }
};

/**
 * Obtiene puntos de venta autorizados por AFIP
 * @route GET /api/facturas-electronicas/afip/puntos-venta
 * @access Private (Admin)
 */
const obtenerPuntosVentaAFIP = async (req, res) => {
  try {
    const puntosVenta = await afipFacturacionService.obtenerPuntosVenta();

    res.status(200).json({
      success: true,
      puntosVenta
    });

  } catch (error) {
    console.error('Error al obtener puntos de venta:', error);
    res.status(500).json({
      success: false,
      mensaje: 'Error al obtener puntos de venta de AFIP',
      error: error.message
    });
  }
};

/**
 * Obtiene tipos de comprobante disponibles
 * @route GET /api/facturas-electronicas/afip/tipos-comprobante
 * @access Private (Admin)
 */
const obtenerTiposComprobanteAFIP = async (req, res) => {
  try {
    const tipos = await afipFacturacionService.obtenerTiposComprobanteDisponibles();

    res.status(200).json({
      success: true,
      tiposComprobante: tipos
    });

  } catch (error) {
    console.error('Error al obtener tipos de comprobante:', error);
    res.status(500).json({
      success: false,
      mensaje: 'Error al obtener tipos de comprobante de AFIP',
      error: error.message
    });
  }
};

/**
 * Valida un CUIT
 * @route POST /api/facturas-electronicas/validar-cuit
 * @access Private
 */
const validarCUIT = async (req, res) => {
  try {
    const { cuit } = req.body;

    if (!cuit) {
      return res.status(400).json({
        success: false,
        mensaje: 'CUIT es requerido'
      });
    }

    const esValido = afipFacturacionService.validarCUIT(cuit);

    res.status(200).json({
      success: true,
      cuit: cuit,
      valido: esValido,
      mensaje: esValido ? 'CUIT válido' : 'CUIT inválido (dígito verificador incorrecto)'
    });

  } catch (error) {
    console.error('Error al validar CUIT:', error);
    res.status(500).json({
      success: false,
      mensaje: 'Error al validar CUIT',
      error: error.message
    });
  }
};

module.exports = {
  crearFacturaElectronica,
  obtenerFacturasElectronicas,
  obtenerFacturaPorId,
  verificarEstadoAFIP,
  obtenerPuntosVentaAFIP,
  obtenerTiposComprobanteAFIP,
  validarCUIT
};
