/**
 * SERVICIO DE CONSULTA DE PADRÓN AFIP/ARCA
 * 
 * MARCOS LEGALES:
 * - RG 3358/12: Consulta de padrón de contribuyentes
 * - WS ws_sr_padron_a13: Consulta de datos de inscripción
 * 
 * FUNCIONALIDAD:
 * - Consulta automática de datos del contribuyente por CUIT
 * - Obtiene: Razón social, condición IVA, domicilio fiscal, actividades
 * - Permite autocompletar datos de clientes sin necesidad de carga manual
 */

const afipConfig = require('../config/afip');
const { logger } = require('../utils/logger');

class AfipPadronService {
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
   * Consulta datos de un CUIT en el padrón de AFIP
   * @param {string} cuit - CUIT a consultar (con o sin guiones)
   * @returns {Object} Datos del contribuyente
   */
  async consultarContribuyente(cuit) {
    try {
      await this.initialize();

      // Limpiar CUIT (remover guiones)
      const cuitLimpio = cuit.toString().replace(/-/g, '');

      // Validar formato
      if (!/^\d{11}$/.test(cuitLimpio)) {
        throw new Error('CUIT inválido. Debe tener 11 dígitos');
      }

      logger.logRequest(`Consultando CUIT ${cuit} en padrón AFIP`);

      // Consultar padrón usando el SDK de AFIP
      const resultado = await this.afip.RegisterScopeFour.getTaxpayerDetails(cuitLimpio);

      // Mapear respuesta a formato más amigable
      const datos = this.mapearRespuestaAFIP(resultado, cuitLimpio);

      logger.logSuccess(`✅ CUIT ${cuit} encontrado: ${datos.razonSocial}`);

      return {
        success: true,
        data: datos
      };

    } catch (error) {
      logger.logError(`Error al consultar CUIT ${cuit} en AFIP`, error);

      // Manejar errores específicos de AFIP
      if (error.message.includes('No existe') || error.message.includes('not found')) {
        return {
          success: false,
          error: 'CUIT no encontrado en el padrón de AFIP'
        };
      }

      return {
        success: false,
        error: `Error al consultar AFIP: ${error.message}`
      };
    }
  }

  /**
   * Mapea la respuesta de AFIP a un formato más amigable
   */
  mapearRespuestaAFIP(resultado, cuit) {
    // El SDK de AFIP puede retornar diferentes estructuras
    // Adaptamos según la respuesta real
    
    const datos = {
      cuit: cuit,
      razonSocial: null,
      condicionIVA: null,
      domicilioFiscal: null,
      provincia: null,
      localidad: null,
      codigoPostal: null,
      actividades: [],
      estado: null,
      fechaInscripcion: null
    };

    // Mapear razón social / nombre
    if (resultado.name) {
      datos.razonSocial = resultado.name;
    } else if (resultado.taxpayerDetails?.name) {
      datos.razonSocial = resultado.taxpayerDetails.name;
    }

    // Mapear condición IVA
    if (resultado.impuestos) {
      const iva = resultado.impuestos.find(imp => imp.idImpuesto === 30 || imp.descripcionImpuesto?.includes('IVA'));
      if (iva) {
        datos.condicionIVA = this.mapearCondicionIVA(iva.descripcionImpuesto);
      }
    }

    // Mapear domicilio fiscal
    if (resultado.domicilioFiscal) {
      const dom = resultado.domicilioFiscal;
      datos.domicilioFiscal = this.construirDomicilio(dom);
      datos.provincia = dom.descripcionProvincia || null;
      datos.localidad = dom.localidad || null;
      datos.codigoPostal = dom.codPos || null;
    }

    // Mapear actividades económicas
    if (resultado.actividades && Array.isArray(resultado.actividades)) {
      datos.actividades = resultado.actividades.map(act => ({
        codigo: act.idActividad,
        descripcion: act.descripcionActividad,
        orden: act.orden
      }));
    }

    // Estado del contribuyente
    if (resultado.estadoClave) {
      datos.estado = resultado.estadoClave === 'ACTIVO' ? 'Activo' : resultado.estadoClave;
    }

    return datos;
  }

  /**
   * Mapea la descripción de AFIP a condición IVA del sistema
   */
  mapearCondicionIVA(descripcionAFIP) {
    if (!descripcionAFIP) return 'Consumidor Final';

    const desc = descripcionAFIP.toUpperCase();

    // Mapeo según nomenclatura AFIP
    const mapeo = {
      'RESPONSABLE INSCRIPTO': 'Responsable Inscripto',
      'RESPONSABLE INSCRITO': 'Responsable Inscripto',
      'IVA RESPONSABLE INSCRIPTO': 'Responsable Inscripto',
      'RESPONSABLE MONOTRIBUTO': 'Monotributista',
      'MONOTRIBUTO': 'Monotributista',
      'EXENTO': 'Exento',
      'IVA EXENTO': 'Exento',
      'NO RESPONSABLE': 'Consumidor Final',
      'CONSUMIDOR FINAL': 'Consumidor Final',
      'RESPONSABLE NO INSCRIPTO': 'No Responsable',
      'PEQUEÑO CONTRIBUYENTE EVENTUAL': 'Monotributista',
      'MONOTRIBUTO SOCIAL': 'Monotributista'
    };

    // Buscar coincidencia
    for (const [clave, valor] of Object.entries(mapeo)) {
      if (desc.includes(clave)) {
        return valor;
      }
    }

    // Si no encuentra, retornar Consumidor Final por defecto
    return 'Consumidor Final';
  }

  /**
   * Construye la dirección completa desde datos de AFIP
   */
  construirDomicilio(domicilio) {
    const partes = [];

    if (domicilio.tipoDomicilio) partes.push(domicilio.tipoDomicilio);
    if (domicilio.direccion) partes.push(domicilio.direccion);
    if (domicilio.numero) partes.push(domicilio.numero);
    if (domicilio.piso) partes.push(`Piso ${domicilio.piso}`);
    if (domicilio.departamento) partes.push(`Depto ${domicilio.departamento}`);

    return partes.join(' ');
  }

  /**
   * Valida que un CUIT tenga el formato correcto
   */
  validarCUIT(cuit) {
    const cuitLimpio = cuit.toString().replace(/-/g, '');
    
    if (!/^\d{11}$/.test(cuitLimpio)) {
      return false;
    }

    // Validar dígito verificador
    const multiplicadores = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
    const cuitArray = cuitLimpio.split('').map(Number);
    const verificador = cuitArray[10];
    
    let suma = 0;
    for (let i = 0; i < 10; i++) {
      suma += cuitArray[i] * multiplicadores[i];
    }
    
    const resto = suma % 11;
    const digitoCalculado = resto === 0 ? 0 : resto === 1 ? 9 : 11 - resto;
    
    return digitoCalculado === verificador;
  }
}

// Exportar instancia única (singleton)
const afipPadronService = new AfipPadronService();
module.exports = afipPadronService;
