/**
 * Configuración automática del Sistema de Estacionamiento
 * Detecta automáticamente la IP de la red para funcionar en cualquier PC
 */

class ConfigManager {
  constructor() {
    this.config = this.initializeConfig();
    this.logConfiguration();
  }

  initializeConfig() {
    const hostname = window.location.hostname;
    const protocol = window.location.protocol;
    
    // Detectar si estamos en desarrollo local o en red
    let backendHost;
    
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      // Desarrollo local - usar localhost
      backendHost = 'localhost';
    } else if (hostname === '192.168.11.167') {
      // Acceso desde la IP de red - usar la misma IP
      backendHost = '192.168.11.167';
    } else {
      // Otros casos - usar IP de red por defecto
      backendHost = '192.168.11.167';
    }

    return {
      BACKEND_URL: `${protocol}//${backendHost}:3000`,
      API_BASE_URL: `${protocol}//${backendHost}:3000/api`,
      FRONTEND_URL: `${protocol}//${hostname}:${window.location.port || '3001'}`,
      TIMEOUT: 10000,
      MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
      VERSION: '1.0.0'
    };
  }

  logConfiguration() {
    console.group('🔧 Configuración del Sistema');
    console.log('🌐 Backend URL:', this.config.BACKEND_URL);
    console.log('🔗 API Base URL:', this.config.API_BASE_URL);
    console.log('💻 Frontend URL:', this.config.FRONTEND_URL);
    console.log('📍 Hostname actual:', window.location.hostname);
    console.log('🚪 Puerto actual:', window.location.port || 'default');
    console.groupEnd();
  }

  getConfig() {
    return this.config;
  }

  // Método para obtener URL específica
  getApiUrl(endpoint = '') {
    return `${this.config.API_BASE_URL}${endpoint}`;
  }

  getBackendUrl(endpoint = '') {
    return `${this.config.BACKEND_URL}${endpoint}`;
  }
}

// Crear instancia global
const configManager = new ConfigManager();
const CONFIG = configManager.getConfig();

// Exportar tanto la configuración como el manager
export default CONFIG;
export { configManager };
