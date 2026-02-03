/**
 * CONFIGURACIÓN DE AFIP/ARCA - FACTURACIÓN ELECTRÓNICA
 * 
 * MARCO LEGAL:
 * - RG 1415/03: Régimen de Emisión de Comprobantes Electrónicos Originales
 * - RG 2485/08: Comprobantes Electrónicos Originales - Normas Generales
 * - RG 2904/10: Factura Electrónica - Régimen General
 * - RG 3749/15: Actualización de normativas
 * - RG 4290/18: Facturación Electrónica Obligatoria
 * - RG 4597/19: Actualización de regímenes
 * 
 * IMPORTANTE: 
 * - En PRODUCCIÓN se requiere certificado digital X.509 emitido por AFIP
 * - En HOMOLOGACIÓN (testing) se usan credenciales de prueba
 */

const Afip = require('@afipsdk/afip.js');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

/**
 * Configuración del SDK de AFIP
 */
class AfipConfig {
  constructor() {
    this.initialized = false;
    this.afipInstance = null;
    
    // Configuración base
    this.config = {
      // CUIT del emisor (estacionamiento)
      CUIT: process.env.AFIP_CUIT || null,
      
      // Modo producción o testing
      production: process.env.AFIP_PRODUCTION === 'true',
      
      // Certificado y clave privada (para producción)
      cert: this.loadCertificate(),
      key: this.loadPrivateKey(),
      
      // Token de acceso para servicios de Afip SDK (opcional)
      access_token: process.env.AFIP_ACCESS_TOKEN || null
    };
  }

  /**
   * Carga el certificado X.509 desde archivo
   * REQUISITO LEGAL: Certificado debe ser emitido por AFIP
   */
  loadCertificate() {
    try {
      const certPath = process.env.AFIP_CERT_PATH 
        ? path.join(__dirname, '..', process.env.AFIP_CERT_PATH)
        : path.join(__dirname, '../certs/afip_cert.pem');
      
      console.log('🔍 Buscando certificado en:', certPath);
      
      if (fs.existsSync(certPath)) {
        const certContent = fs.readFileSync(certPath, 'utf8');
        console.log('✅ Certificado AFIP cargado correctamente');
        return certContent;
      }
      
      console.warn('⚠️  ADVERTENCIA: Certificado AFIP no encontrado en:', certPath);
      return null;
    } catch (error) {
      console.error('❌ Error al cargar certificado AFIP:', error);
      return null;
    }
  }

  /**
   * Carga la clave privada correspondiente al certificado
   */
  loadPrivateKey() {
    try {
      const keyPath = process.env.AFIP_KEY_PATH
        ? path.join(__dirname, '..', process.env.AFIP_KEY_PATH)
        : path.join(__dirname, '../certs/afip_private_key.key');
      
      console.log('🔍 Buscando clave privada en:', keyPath);
      
      if (fs.existsSync(keyPath)) {
        const keyContent = fs.readFileSync(keyPath, 'utf8');
        console.log('✅ Clave privada AFIP cargada correctamente');
        return keyContent;
      }
      
      console.warn('⚠️  ADVERTENCIA: Clave privada AFIP no encontrada en:', keyPath);
      return null;
    } catch (error) {
      console.error('❌ Error al cargar clave privada AFIP:', error);
      return null;
    }
  }

  /**
   * Inicializa la instancia de AFIP
   */
  initialize() {
    if (this.initialized) {
      return this.afipInstance;
    }

    try {
      // Validar que el CUIT esté configurado
      if (!this.config.CUIT) {
        throw new Error('CUIT no configurado. Configure AFIP_CUIT en el archivo .env');
      }

      // Validar formato del CUIT (XX-XXXXXXXX-X)
      if (!this.isValidCUIT(this.config.CUIT)) {
        throw new Error('Formato de CUIT inválido. Debe ser numérico de 11 dígitos');
      }

      // En producción, validar que existan certificados
      if (this.config.production && (!this.config.cert || !this.config.key)) {
        throw new Error('Modo PRODUCCIÓN requiere certificado y clave privada válidos');
      }

      // Crear instancia de AFIP
      this.afipInstance = new Afip(this.config);
      this.initialized = true;

      console.log(`✅ AFIP SDK inicializado correctamente`);
      console.log(`   Modo: ${this.config.production ? 'PRODUCCIÓN' : 'HOMOLOGACIÓN (TESTING)'}`);
      console.log(`   CUIT: ${this.config.CUIT}`);
      console.log(`   Certificado: ${this.config.cert ? 'Configurado' : 'No configurado (modo TEST)'}`);

      return this.afipInstance;
    } catch (error) {
      console.error('❌ Error al inicializar AFIP SDK:', error.message);
      throw error;
    }
  }

  /**
   * Obtiene la instancia de AFIP (singleton)
   */
  getInstance() {
    if (!this.initialized) {
      return this.initialize();
    }
    return this.afipInstance;
  }

  /**
   * Valida formato de CUIT según normativa AFIP
   * REQUISITO LEGAL: CUIT debe tener 11 dígitos numéricos
   */
  isValidCUIT(cuit) {
    // Remover guiones si existen
    const cleanCuit = cuit.toString().replace(/-/g, '');
    
    // Validar longitud y que sea numérico
    if (!/^\d{11}$/.test(cleanCuit)) {
      return false;
    }

    // Validar dígito verificador
    const multiplicadores = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
    const cuitArray = cleanCuit.split('').map(Number);
    const verificador = cuitArray[10];
    
    let suma = 0;
    for (let i = 0; i < 10; i++) {
      suma += cuitArray[i] * multiplicadores[i];
    }
    
    const resto = suma % 11;
    const digitoCalculado = resto === 0 ? 0 : resto === 1 ? 9 : 11 - resto;
    
    return digitoCalculado === verificador;
  }

  /**
   * Verifica el estado del servidor de AFIP
   */
  async checkServerStatus() {
    try {
      const afip = this.getInstance();
      const status = await afip.ElectronicBilling.getServerStatus();
      return {
        online: true,
        appServer: status.AppServer,
        dbServer: status.DbServer,
        authServer: status.AuthServer
      };
    } catch (error) {
      return {
        online: false,
        error: error.message
      };
    }
  }

  /**
   * Obtiene información del ambiente actual
   */
  getEnvironmentInfo() {
    return {
      mode: this.config.production ? 'PRODUCCIÓN' : 'HOMOLOGACIÓN',
      cuit: this.config.CUIT,
      hasCertificate: !!this.config.cert,
      hasPrivateKey: !!this.config.key,
      initialized: this.initialized
    };
  }
}

// Exportar instancia única (singleton)
const afipConfig = new AfipConfig();
module.exports = afipConfig;
