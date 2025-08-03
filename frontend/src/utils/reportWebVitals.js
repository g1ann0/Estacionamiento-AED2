import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals';

const reportWebVitals = (onPerfEntry) => {
  if (onPerfEntry && onPerfEntry instanceof Function) {
    getCLS(onPerfEntry);
    getFID(onPerfEntry);
    getFCP(onPerfEntry);
    getLCP(onPerfEntry);
    getTTFB(onPerfEntry);
  }
};

// Función para enviar métricas a Google Analytics (opcional)
export const sendToAnalytics = (metric) => {
  // Enviar a Google Analytics si está configurado
  if (window.gtag) {
    window.gtag('event', metric.name, {
      event_category: 'Web Vitals',
      event_label: metric.id,
      value: Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value),
      non_interaction: true,
    });
  }

  // Log para desarrollo
  if (process.env.NODE_ENV === 'development') {
    console.log('Web Vital:', metric);
  }
};

// Función para monitorear Core Web Vitals
export const monitorWebVitals = () => {
  reportWebVitals(sendToAnalytics);
};

export default reportWebVitals;
