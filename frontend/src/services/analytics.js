/**
 * @fileoverview Servicio de Google Analytics
 * @description Configuración y utilidades para tracking de métricas de uso
 * @module services/analytics
 */

import ReactGA from 'react-ga4';

/**
 * ID de seguimiento de Google Analytics 4
 * Debe ser configurado en las variables de entorno (.env)
 * Formato: G-XXXXXXXXXX
 */
const TRACKING_ID = process.env.REACT_APP_GA_TRACKING_ID || '';

/**
 * Flag para verificar si Analytics está inicializado
 */
let isInitialized = false;

/**
 * Inicializa Google Analytics
 * Se debe llamar una sola vez al inicio de la aplicación
 * 
 * @param {Object} options - Opciones de configuración
 * @param {boolean} options.debug - Modo debug para desarrollo
 * @returns {boolean} true si se inicializó correctamente
 */
export const initGA = (options = {}) => {
  // No inicializar si no hay tracking ID
  if (!TRACKING_ID) {
    console.warn('⚠️  Google Analytics: No se encontró REACT_APP_GA_TRACKING_ID');
    return false;
  }

  // No inicializar múltiples veces
  if (isInitialized) {
    console.warn('⚠️  Google Analytics ya está inicializado');
    return false;
  }

  try {
    ReactGA.initialize(TRACKING_ID, {
      gaOptions: {
        // Opciones de GA4
        send_page_view: false, // Controlamos manualmente el envío
      },
      gtagOptions: {
        debug_mode: options.debug || process.env.NODE_ENV === 'development',
      },
    });

    isInitialized = true;
    console.log('✅ Google Analytics inicializado:', TRACKING_ID);
    return true;
  } catch (error) {
    console.error('❌ Error al inicializar Google Analytics:', error);
    return false;
  }
};

/**
 * Registra una vista de página
 * 
 * @param {string} path - Ruta de la página (ej: '/dashboard', '/login')
 * @param {string} title - Título de la página
 * @param {Object} customParams - Parámetros personalizados adicionales
 * 
 * @example
 * trackPageView('/dashboard', 'Panel de Control', { userId: '123' });
 */
export const trackPageView = (path, title, customParams = {}) => {
  if (!isInitialized) {
    console.warn('⚠️  Google Analytics no inicializado');
    return;
  }

  try {
    ReactGA.send({
      hitType: 'pageview',
      page: path,
      title: title,
      ...customParams,
    });

    console.log('📊 GA Pageview:', path, title);
  } catch (error) {
    console.error('❌ Error al registrar pageview:', error);
  }
};

/**
 * Registra un evento personalizado
 * 
 * @param {Object} params - Parámetros del evento
 * @param {string} params.category - Categoría del evento (ej: 'User', 'Parking', 'Payment')
 * @param {string} params.action - Acción realizada (ej: 'Login', 'Start Parking', 'Recharge')
 * @param {string} params.label - Etiqueta descriptiva (opcional)
 * @param {number} params.value - Valor numérico (opcional)
 * @param {Object} params.customParams - Parámetros personalizados adicionales
 * 
 * @example
 * trackEvent({
 *   category: 'Estacionamiento',
 *   action: 'Iniciar',
 *   label: 'Patente ABC123',
 *   value: 50
 * });
 */
export const trackEvent = ({ category, action, label, value, customParams = {} }) => {
  if (!isInitialized) {
    console.warn('⚠️  Google Analytics no inicializado');
    return;
  }

  try {
    ReactGA.event({
      category,
      action,
      label,
      value,
      ...customParams,
    });

    console.log('📊 GA Event:', { category, action, label, value });
  } catch (error) {
    console.error('❌ Error al registrar evento:', error);
  }
};

/**
 * Registra información del usuario
 * Se debe llamar después del login exitoso
 * 
 * @param {Object} user - Datos del usuario
 * @param {string} user.id - ID único del usuario
 * @param {string} user.rol - Rol del usuario (cliente, administrador, etc.)
 * @param {Object} customProps - Propiedades personalizadas
 * 
 * @example
 * setUser({ id: '123', rol: 'cliente' });
 */
export const setUser = (user, customProps = {}) => {
  if (!isInitialized) {
    console.warn('⚠️  Google Analytics no inicializado');
    return;
  }

  try {
    ReactGA.set({
      userId: user.id,
      userRole: user.rol,
      ...customProps,
    });

    console.log('📊 GA User set:', user.id);
  } catch (error) {
    console.error('❌ Error al configurar usuario:', error);
  }
};

/**
 * Limpia la información del usuario
 * Se debe llamar al hacer logout
 */
export const clearUser = () => {
  if (!isInitialized) return;

  try {
    ReactGA.set({
      userId: null,
      userRole: null,
    });

    console.log('📊 GA User cleared');
  } catch (error) {
    console.error('❌ Error al limpiar usuario:', error);
  }
};

/**
 * Registra una excepción o error
 * 
 * @param {string} description - Descripción del error
 * @param {boolean} fatal - Si es un error crítico
 * 
 * @example
 * trackException('Error al cargar datos del usuario', false);
 */
export const trackException = (description, fatal = false) => {
  if (!isInitialized) return;

  try {
    ReactGA.event('exception', {
      description,
      fatal,
    });

    console.log('📊 GA Exception:', description);
  } catch (error) {
    console.error('❌ Error al registrar excepción:', error);
  }
};

/**
 * Registra el tiempo que tarda una operación
 * 
 * @param {Object} params - Parámetros del timing
 * @param {string} params.category - Categoría (ej: 'API', 'UI')
 * @param {string} params.variable - Variable medida (ej: 'Load Time', 'Response Time')
 * @param {number} params.value - Tiempo en milisegundos
 * @param {string} params.label - Etiqueta descriptiva
 * 
 * @example
 * trackTiming({
 *   category: 'API',
 *   variable: 'Login Request',
 *   value: 1250,
 *   label: 'Successful'
 * });
 */
export const trackTiming = ({ category, variable, value, label }) => {
  if (!isInitialized) return;

  try {
    ReactGA.event('timing_complete', {
      name: variable,
      value,
      event_category: category,
      event_label: label,
    });

    console.log('📊 GA Timing:', { category, variable, value });
  } catch (error) {
    console.error('❌ Error al registrar timing:', error);
  }
};

/**
 * Eventos predefinidos para el sistema de estacionamiento
 */
export const AnalyticsEvents = {
  // Autenticación
  LOGIN: (email) => trackEvent({
    category: 'Autenticación',
    action: 'Inicio de sesión',
    label: email,
  }),

  LOGOUT: () => trackEvent({
    category: 'Autenticación',
    action: 'Cierre de sesión',
  }),

  REGISTER: (email) => trackEvent({
    category: 'Autenticación',
    action: 'Registro',
    label: email,
  }),

  // Estacionamiento
  START_PARKING: (patente) => trackEvent({
    category: 'Estacionamiento',
    action: 'Iniciar',
    label: patente,
  }),

  END_PARKING: (patente, duracion, costo) => trackEvent({
    category: 'Estacionamiento',
    action: 'Finalizar',
    label: patente,
    value: costo,
    customParams: { duracion },
  }),

  // Vehículos
  ADD_VEHICLE: (patente) => trackEvent({
    category: 'Vehículos',
    action: 'Alta',
    label: patente,
  }),

  EDIT_VEHICLE: (patente) => trackEvent({
    category: 'Vehículos',
    action: 'Modificación',
    label: patente,
  }),

  DELETE_VEHICLE: (patente) => trackEvent({
    category: 'Vehículos',
    action: 'Baja',
    label: patente,
  }),

  // Transacciones
  RECHARGE_BALANCE: (monto) => trackEvent({
    category: 'Transacciones',
    action: 'Recarga de saldo',
    value: monto,
  }),

  UPLOAD_RECEIPT: (monto) => trackEvent({
    category: 'Transacciones',
    action: 'Carga de comprobante',
    value: monto,
  }),

  // Facturación
  GENERATE_INVOICE: (tipo, monto) => trackEvent({
    category: 'Facturación',
    action: 'Generar factura',
    label: tipo,
    value: monto,
  }),

  // Errores
  API_ERROR: (endpoint, statusCode) => trackEvent({
    category: 'Error',
    action: 'API Error',
    label: `${endpoint} - ${statusCode}`,
  }),

  VALIDATION_ERROR: (field) => trackEvent({
    category: 'Error',
    action: 'Validación',
    label: field,
  }),
};

const analyticsService = {
  initGA,
  trackPageView,
  trackEvent,
  setUser,
  clearUser,
  trackException,
  trackTiming,
  AnalyticsEvents,
};

export default analyticsService;
