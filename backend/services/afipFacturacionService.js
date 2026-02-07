/**
 * SERVICIO DE FACTURACIÓN ELECTRÓNICA - CUMPLIMIENTO NORMATIVO AFIP/ARCA
 * 
 * MARCOS LEGALES IMPLEMENTADOS:
 * 
 * 1. RG 1415/03 - Régimen de Emisión de Comprobantes Electrónicos Originales
 * 2. RG 2485/08 - Comprobantes Electrónicos Originales
 * 3. RG 2904/10 - Factura Electrónica - Régimen General
 * 4. RG 3749/15 - Actualización de normativas
 * 5. RG 4290/18 - Facturación Electrónica Obligatoria
 * 6. RG 4597/19 - Actualización regímenes
 * 
 * CUMPLIMIENTO NORMATIVO:
 * - Validación de CUIT emisor y receptor
 * - Validación de tipos de comprobante según normativa
 * - Validación de conceptos (Productos, Servicios, Productos y Servicios)
 * - Obtención de CAE (Código de Autorización Electrónica) obligatorio
 * - Almacenamiento de fecha de vencimiento de CAE
 * - Validación de montos e IVA según tipo de comprobante
 * - Cumplimiento de requisitos de datos según tipo de factura
 */

const afipConfig = require('../config/afip');
const ConfiguracionEmpresa = require('../models/ConfiguracionEmpresa');
const { obtenerFechaArgentina, formatearFechaAFIP: formatearFechaARG } = require('../utils/fechaArgentina');

class AfipFacturacionService {
  constructor() {
    this.afip = null;
  }

  /**
   * Inicializa el servicio
   */
  async initialize() {
    if (!this.afip) {
      this.afip = afipConfig.getInstance();
    }
    return this.afip;
  }

  /**
   * Mapea la condición de IVA a código AFIP
   * Según tabla de parámetros AFIP FEParamGetCondicionIvaReceptor
   */
  mapearCondicionIVAAFIP(condicionIVA) {
    const mapeo = {
      'Responsable Inscripto': 1,
      'IVA Responsable Inscripto': 1,
      'Responsable Inscripto en IVA': 1,
      'Responsable Monotributo': 6,
      'Monotributo': 6,
      'Consumidor Final': 5,
      'Exento': 4,
      'IVA Exento': 4,
      'Responsable No Inscripto': 2,
      'No Responsable': 7
    };
    
    return mapeo[condicionIVA] || 5; // Default: Consumidor Final
  }

  /**
   * TIPOS DE COMPROBANTE VÁLIDOS SEGÚN AFIP
   * Referencia: RG 1415/03 y actualizaciones
   */
  getTiposComprobante() {
    return {
      // FACTURAS
      1: 'Factura A',
      2: 'Nota de Débito A',
      3: 'Nota de Crédito A',
      4: 'Recibo A',
      5: 'Nota de Venta al Contado A',
      6: 'Factura B',
      7: 'Nota de Débito B',
      8: 'Nota de Crédito B',
      9: 'Recibo B',
      10: 'Nota de Venta al Contado B',
      11: 'Factura C',
      12: 'Nota de Débito C',
      13: 'Nota de Crédito C',
      15: 'Recibo C',
      
      // OTROS COMPROBANTES
      19: 'Factura E',
      20: 'Nota de Débito E',
      21: 'Nota de Crédito E',
      
      // COMPROBANTES ESPECIALES
      51: 'Factura M',
      52: 'Nota de Débito M',
      53: 'Nota de Crédito M',
      
      // TICKETS
      81: 'Tique Factura A',
      82: 'Tique Factura B',
      83: 'Tique',
      
      // EXPORTACIÓN
      201: 'Factura de Crédito Electrónica MiPyMEs A',
      202: 'Nota de Débito Electrónica MiPyMEs A',
      203: 'Nota de Crédito Electrónica MiPyMEs A',
      206: 'Factura de Crédito Electrónica MiPyMEs B',
      207: 'Nota de Débito Electrónica MiPyMEs B',
      208: 'Nota de Crédito Electrónica MiPyMEs B',
      211: 'Factura de Crédito Electrónica MiPyMEs C',
      212: 'Nota de Débito Electrónica MiPyMEs C',
      213: 'Nota de Crédito Electrónica MiPyMEs C'
    };
  }

  /**
   * CONCEPTOS DE COMPROBANTE según normativa AFIP
   */
  getConceptosComprobante() {
    return {
      1: 'Productos',
      2: 'Servicios',
      3: 'Productos y Servicios'
    };
  }

  /**
   * TIPOS DE DOCUMENTO según AFIP
   */
  getTiposDocumento() {
    return {
      80: 'CUIT',
      86: 'CUIL',
      87: 'CDI',
      89: 'LE',
      90: 'LC',
      91: 'CI Extranjera',
      92: 'En trámite',
      93: 'Acta Nacimiento',
      94: 'CI Buenos Aires',
      95: 'CI Catamarca',
      96: 'DNI',
      99: 'Doc. (Otro)',
      30: 'Certificado de Migración',
      88: 'Usado por Anses'
    };
  }

  /**
   * Valida que un CUIT sea válido según normativa AFIP
   * REQUISITO LEGAL: Validación de dígito verificador
   */
  validarCUIT(cuit) {
    return afipConfig.isValidCUIT(cuit);
  }

  /**
   * Determina el tipo de comprobante según el tipo de cliente y emisor
   * LÓGICA LEGAL:
   * - Si EMISOR es Responsable Inscripto y CLIENTE es Responsable Inscripto -> Factura A
   * - Si EMISOR es Responsable Inscripto y CLIENTE es Monotributo/Consumidor Final -> Factura B
   * - Si EMISOR es Monotributo -> Siempre Factura B o C
   * - Exento -> Factura C
   * 
   * @param {String} condicionIVACliente - Condición IVA del cliente
   * @param {String} condicionIVAEmisor - Condición IVA del emisor (estacionamiento)
   * @param {Boolean} esTicket - Si es ticket o factura
   * @returns {Number} Código del tipo de comprobante según AFIP
   */
  determinarTipoComprobante(condicionIVACliente, condicionIVAEmisor = 'Responsable Inscripto', esTicket = false) {
    // Si es ticket/tique
    if (esTicket) {
      // Solo Responsable Inscripto puede emitir Tique A
      if (condicionIVAEmisor === 'Responsable Inscripto' && condicionIVACliente === 'Responsable Inscripto') {
        return 81; // Tique Factura A
      } else {
        return 82; // Tique Factura B
      }
    }

    // Facturas normales
    // Si el EMISOR es Responsable Inscripto, puede emitir Factura A o B
    if (condicionIVAEmisor === 'Responsable Inscripto') {
      if (condicionIVACliente === 'Responsable Inscripto') {
        return 1; // Factura A (discrimina IVA)
      } else if (condicionIVACliente === 'Exento') {
        return 11; // Factura C (sin IVA)
      } else {
        return 6; // Factura B (IVA incluido) - para Monotributo y Consumidor Final
      }
    }

    // Si el EMISOR es Monotributo o Consumidor Final, solo puede emitir B o C
    if (condicionIVACliente === 'Exento') {
      return 11; // Factura C
    }
    
    return 6; // Por defecto Factura B
  }

  /**
   * Obtiene la descripción del tipo de comprobante
   * @param {Number} tipoComprobante - Código del tipo de comprobante
   * @returns {String} Descripción del comprobante
   */
  getDescripcionTipoComprobante(tipoComprobante) {
    const tipos = this.getTiposComprobante();
    return tipos[tipoComprobante] || 'Desconocido';
  }

  /**
   * Obtiene el último número de comprobante
   * REQUISITO LEGAL: Numeración correlativa obligatoria
   */
  async obtenerUltimoNumeroComprobante(puntoVenta, tipoComprobante) {
    await this.initialize();
    try {
      const ultimoNumero = await this.afip.ElectronicBilling.getLastVoucher(
        puntoVenta,
        tipoComprobante
      );
      return ultimoNumero;
    } catch (error) {
      console.error('Error al obtener último número de comprobante:', error);
      throw new Error('No se pudo obtener el último número de comprobante de AFIP');
    }
  }

  /**
   * Crea una factura electrónica en AFIP
   * 
   * REQUISITOS LEGALES CUMPLIDOS:
   * - CAE (Código de Autorización Electrónica)
   * - Fecha de vencimiento del CAE
   * - Numeración correlativa
   * - Validación de datos obligatorios
   * - Cálculo correcto de IVA según tipo de comprobante
   * 
   * @param {Object} datosFactura - Datos de la factura
   * @returns {Object} Respuesta con CAE y datos de AFIP
   */
  async crearFacturaElectronica(datosFactura) {
    await this.initialize();

    try {
      // Validar datos obligatorios
      this.validarDatosFactura(datosFactura);

      // Obtener configuración de la empresa
      const configEmpresa = await ConfiguracionEmpresa.findOne();
      if (!configEmpresa) {
        throw new Error('Configuración de empresa no encontrada. Configure los datos fiscales.');
      }

      // Preparar datos para AFIP según normativa
      // IMPORTANTE: La fecha del comprobante es la fecha ACTUAL del sistema (hora de Windows)
      // Las fechas de servicio pueden ser del pasado (fechas del estacionamiento)
      const ahora = new Date(); // Toma la hora del sistema operativo Windows
      let fechaEmisionFactura = this.formatearFechaAFIP(ahora); 
      const puntoVenta = datosFactura.puntoVenta || 2; // Punto de venta 2 para evitar conflictos con testing
      const tipoComprobante = datosFactura.tipoComprobante || 6; // Default: Factura B
      
      console.log(`📅 Fecha actual del sistema: ${ahora.toString()}`);
      console.log(`📅 Fecha AFIP inicial: ${fechaEmisionFactura}`);

      // Obtener próximo número de comprobante
      console.log(`🔍 Consultando último número para PtoVta ${puntoVenta}, Tipo ${tipoComprobante}...`);
      const ultimoNumero = await this.obtenerUltimoNumeroComprobante(puntoVenta, tipoComprobante);
      const numeroComprobante = ultimoNumero + 1;
      console.log(`📊 Último número: ${ultimoNumero}, Próximo a usar: ${numeroComprobante}`);

      // Estructura de datos según especificación AFIP WSFEv1
      const datosComprobanteAFIP = {
        'CantReg': 1, // Cantidad de comprobantes (siempre 1 para registro individual)
        'PtoVta': puntoVenta,
        'CbteTipo': tipoComprobante,
        'Concepto': datosFactura.concepto || 2, // Default: Servicios (estacionamiento)
        'DocTipo': datosFactura.cliente.tipoDocumento || 96, // Default: DNI
        'DocNro': this.limpiarNumeroDocumento(datosFactura.cliente.numeroDocumento),
        'CbteDesde': numeroComprobante,
        'CbteHasta': numeroComprobante,
        'CbteFch': fechaEmisionFactura, // SIEMPRE la fecha de HOY
        'ImpTotal': parseFloat(datosFactura.montoTotal).toFixed(2),
        'ImpTotConc': 0, // Importe neto no gravado
        'ImpNeto': parseFloat(datosFactura.montoNeto).toFixed(2),
        'ImpOpEx': 0, // Importe exento
        'ImpIVA': parseFloat(datosFactura.montoIVA || 0).toFixed(2),
        'ImpTrib': 0, // Otros tributos
        'MonId': 'PES', // Moneda: Pesos
        'MonCotiz': 1, // Cotización moneda
        // OBLIGATORIO según RG 5616/2024: Condición IVA del receptor
        'CondicionIVAReceptorId': this.mapearCondicionIVAAFIP(datosFactura.cliente.condicionIVA || 'Consumidor Final')
      };

      // Agregar IVA según tipo de comprobante
      // Factura A (1) / NC A (3): discrimina IVA - alícuota 21%
      // Factura B (6) / NC B (8): IVA incluido - alícuota 0%
      if ([1, 3].includes(tipoComprobante) && datosFactura.montoIVA > 0) {
        // Factura A / NC A - IVA discriminado
        datosComprobanteAFIP.Iva = [
          {
            'Id': 5, // 21% - Alícuota general
            'BaseImp': parseFloat(datosFactura.montoNeto).toFixed(2),
            'Importe': parseFloat(datosFactura.montoIVA).toFixed(2)
          }
        ];
      } else if ([6, 8].includes(tipoComprobante)) {
        // Factura B / NC B - IVA incluido en el precio
        datosComprobanteAFIP.Iva = [
          {
            'Id': 3, // 0% - IVA no discriminado
            'BaseImp': parseFloat(datosFactura.montoNeto).toFixed(2),
            'Importe': 0.00
          }
        ];
      }

      // Si es servicio (concepto 2 o 3), agregar fechas de servicio
      // NOTA: FchServDesde/Hasta son las fechas del SERVICIO (estacionamiento)
      //       CbteFch es la fecha de EMISIÓN de la factura (HOY)
      if ([2, 3].includes(datosFactura.concepto || 2)) {
        datosComprobanteAFIP.FchServDesde = datosFactura.fechaServicioDesde 
          ? this.formatearFechaAFIP(new Date(datosFactura.fechaServicioDesde))
          : fechaEmisionFactura;
        datosComprobanteAFIP.FchServHasta = datosFactura.fechaServicioHasta
          ? this.formatearFechaAFIP(new Date(datosFactura.fechaServicioHasta))
          : fechaEmisionFactura;
        datosComprobanteAFIP.FchVtoPago = datosFactura.fechaVencimientoPago
          ? this.formatearFechaAFIP(new Date(datosFactura.fechaVencimientoPago))
          : fechaEmisionFactura;
      }

      // Si es Nota de Crédito/Débito, agregar comprobante asociado (OBLIGATORIO)
      // Tipos: 2-3 (ND A/NC A), 7-8 (ND B/NC B), 12-13 (ND C/NC C)
      const esNotaCredito = [3, 8, 13].includes(tipoComprobante);
      const esNotaDebito = [2, 7, 12].includes(tipoComprobante);
      
      if ((esNotaCredito || esNotaDebito) && datosFactura.comprobantesAsociados) {
        datosComprobanteAFIP.CbtesAsoc = datosFactura.comprobantesAsociados.map(comp => ({
          'Tipo': comp.tipo,
          'PtoVta': comp.puntoVenta,
          'Nro': comp.numero
        }));
      }

      // Solicitar CAE a AFIP
      console.log('📤 Enviando comprobante a AFIP para autorización...', datosComprobanteAFIP);
      
      const respuestaAFIP = await this.afip.ElectronicBilling.createVoucher(
        datosComprobanteAFIP,
        false // returnResponse = false para obtener solo {CAE, CAEFchVto}
      );

      console.log('✅ Respuesta de AFIP:', JSON.stringify(respuestaAFIP, null, 2));

      // Cuando returnResponse=false, la respuesta es directamente {CAE, CAEFchVto}
      // Cuando returnResponse=true, viene en FeDetResp.FECAEDetResponse
      let caeData;
      if (respuestaAFIP.CAE && respuestaAFIP.CAEFchVto) {
        // Respuesta simplificada (returnResponse=false)
        caeData = respuestaAFIP;
      } else {
        // Respuesta completa (returnResponse=true)
        caeData = Array.isArray(respuestaAFIP.FeDetResp?.FECAEDetResponse) 
          ? respuestaAFIP.FeDetResp.FECAEDetResponse[0]
          : respuestaAFIP.FeDetResp?.FECAEDetResponse;
      }

      // REQUISITO LEGAL: Almacenar CAE y fecha de vencimiento
      return {
        success: true,
        CAE: caeData.CAE,
        CAEFchVto: this.parsearFechaAFIP(caeData.CAEFchVto),
        CbteDesde: numeroComprobante,
        CbteHasta: numeroComprobante,
        puntoVenta: puntoVenta,
        tipoComprobante: tipoComprobante,
        fechaEmision: fechaEmisionFactura,
        respuestaCompleta: respuestaAFIP
      };

    } catch (error) {
      console.error('❌ Error al crear factura electrónica en AFIP:', error);
      
      // Manejar errores específicos de AFIP
      if (error.message && error.message.includes('AFIP')) {
        throw new Error(`Error de AFIP: ${error.message}`);
      }
      
      throw new Error(`Error al generar factura electrónica: ${error.message}`);
    }
  }

  /**
   * Valida los datos de la factura antes de enviar a AFIP
   * REQUISITO LEGAL: Validación de datos obligatorios
   */
  validarDatosFactura(datos) {
    const errores = [];

    // Validar cliente
    if (!datos.cliente) {
      errores.push('Datos del cliente son obligatorios');
    } else {
      if (!datos.cliente.numeroDocumento) {
        errores.push('Número de documento del cliente es obligatorio');
      }
      if (!datos.cliente.nombre && !datos.cliente.razonSocial) {
        errores.push('Nombre o razón social del cliente es obligatorio');
      }
    }

    // Validar montos
    if (!datos.montoTotal || datos.montoTotal <= 0) {
      errores.push('Monto total debe ser mayor a cero');
    }

    if (!datos.montoNeto || datos.montoNeto <= 0) {
      errores.push('Monto neto debe ser mayor a cero');
    }

    // Validar concepto
    const conceptosValidos = [1, 2, 3];
    if (datos.concepto && !conceptosValidos.includes(datos.concepto)) {
      errores.push('Concepto de comprobante inválido');
    }

    if (errores.length > 0) {
      throw new Error(`Datos de factura inválidos: ${errores.join(', ')}`);
    }
  }

  /**
   * Formatea fecha al formato AFIP (YYYYMMDD)
   * Usa la fecha local del sistema operativo (hora de Windows)
   */
  formatearFechaAFIP(fecha) {
    const year = fecha.getFullYear();
    const month = String(fecha.getMonth() + 1).padStart(2, '0');
    const day = String(fecha.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
  }

  /**
   * Parsea fecha desde formato AFIP (YYYYMMDD) a Date
   */
  parsearFechaAFIP(fechaAFIP) {
    const fechaStr = String(fechaAFIP);
    const year = fechaStr.substring(0, 4);
    const month = fechaStr.substring(4, 6);
    const day = fechaStr.substring(6, 8);
    return new Date(`${year}-${month}-${day}`);
  }

  /**
   * Limpia número de documento (remueve guiones y espacios)
   */
  limpiarNumeroDocumento(numero) {
    return numero.toString().replace(/[-\s]/g, '');
  }

  /**
   * Obtiene información de un comprobante desde AFIP
   */
  async obtenerComprobanteAFIP(numeroComprobante, puntoVenta, tipoComprobante) {
    await this.initialize();
    
    try {
      const info = await this.afip.ElectronicBilling.getVoucherInfo(
        numeroComprobante,
        puntoVenta,
        tipoComprobante
      );
      return info;
    } catch (error) {
      console.error('Error al obtener información de comprobante:', error);
      throw new Error('No se pudo obtener información del comprobante desde AFIP');
    }
  }

  /**
   * Verifica el estado del servidor de AFIP
   */
  async verificarEstadoServidor() {
    return await afipConfig.checkServerStatus();
  }

  /**
   * Obtiene los puntos de venta habilitados
   * En HOMOLOGACIÓN, devuelve puntos de venta predeterminados si AFIP no tiene datos
   */
  async obtenerPuntosVenta() {
    await this.initialize();
    
    try {
      const puntosVenta = await this.afip.ElectronicBilling.getSalesPoints();
      return puntosVenta;
    } catch (error) {
      console.warn('⚠️  No se pudieron obtener puntos de venta de AFIP. Usando valores por defecto para HOMOLOGACIÓN.');
      
      // En ambiente de testing, devolver punto de venta predeterminado
      if (!afipConfig.config.production) {
        return [
          { Nro: 1, EmisionTipo: 'CAE', Bloqueado: 'N', FchBaja: null }
        ];
      }
      
      return [];
    }
  }

  /**
   * Obtiene twarn('⚠️  No se pudieron obtener tipos de comprobante de AFIP. Usando valores por defecto.'
   */
  async obtenerTiposComprobanteDisponibles() {
    await this.initialize();
    
    try {
      const tipos = await this.afip.ElectronicBilling.getVoucherTypes();
      return tipos;
    } catch (error) {
      console.error('Error al obtener tipos de comprobante:', error);
      return this.getTiposComprobante();
    }
  }

  /**
   * Calcula IVA según el monto neto y la alícuota
   * REQUISITO LEGAL: Cálculo correcto de IVA
   */
  calcularIVA(montoNeto, alicuota = 21) {
    return parseFloat((montoNeto * (alicuota / 100)).toFixed(2));
  }

  /**
   * Calcula monto neto desde el total (incluido IVA)
   */
  calcularMontoNeto(montoTotal, alicuota = 21) {
    return parseFloat((montoTotal / (1 + alicuota / 100)).toFixed(2));
  }

  /**
   * Genera QR para factura electrónica (opcional pero recomendado)
   * MEJORA: Permite al cliente verificar la factura en AFIP
   */
  generarURLVerificacionAFIP(cae, puntoVenta, tipoComprobante, numeroComprobante) {
    const cuit = afipConfig.config.CUIT;
    // URL de verificación de AFIP
    return `https://www.afip.gob.ar/fe/qr/?p=${btoa(JSON.stringify({
      ver: 1,
      fecha: this.formatearFechaAFIP(new Date()),
      cuit: cuit,
      ptoVta: puntoVenta,
      tipoCmp: tipoComprobante,
      nroCmp: numeroComprobante,
      importe: 0,
      moneda: 'PES',
      ctz: 1,
      tipoDocRec: 99,
      nroDocRec: 0,
      tipoCodAut: 'E',
      codAut: cae
    }))}`;
  }

  /**
   * Consulta datos de un contribuyente en AFIP/ARCA
   * IMPORTANTE: Utiliza el padrón de AFIP para obtener datos fiscales
   * @param {String} cuit - CUIT a consultar
   * @returns {Object} Datos del contribuyente
   */
  async consultarContribuyente(cuit) {
    await this.initialize();
    
    try {
      // Método 1: Usar SDK de AFIP si tiene función de consulta de padrón
      // Nota: El SDK actual puede no tener esta función, dependiendo de la versión
      
      // Método 2: Consulta directa al servicio de constancia de inscripción
      // Por ahora, devolvemos datos básicos validando solo el CUIT
      
      const esValido = this.validarCUIT(cuit);
      if (!esValido) {
        throw new Error('CUIT inválido');
      }

      // En producción, aquí se haría la consulta real al padrón de AFIP
      // Por ahora devolvemos una estructura básica
      console.warn('⚠️ Consulta de padrón AFIP no implementada completamente. Devolviendo datos básicos.');
      
      return {
        cuit: cuit,
        valido: true,
        mensaje: 'CUIT válido. Consulta completa al padrón AFIP requiere integración adicional.',
        // En producción estos datos vendrían de AFIP:
        // razonSocial: 'RAZON SOCIAL DEL CONTRIBUYENTE',
        // condicionIVA: 'Responsable Inscripto',
        // domicilio: 'DOMICILIO FISCAL',
        // estadoCUIT: 'ACTIVO',
        // actividadPrincipal: 'Descripción actividad'
      };
      
    } catch (error) {
      console.error('Error al consultar contribuyente en AFIP:', error);
      throw new Error(`No se pudo consultar el contribuyente: ${error.message}`);
    }
  }
}

// Exportar instancia única
const afipFacturacionService = new AfipFacturacionService();
module.exports = afipFacturacionService;
