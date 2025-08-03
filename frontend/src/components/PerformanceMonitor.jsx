import { useEffect } from 'react';
import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals';

const PerformanceMonitor = () => {
  useEffect(() => {
    // Función para enviar métricas
    const sendToAnalytics = (metric) => {
      // Log en desarrollo
      if (process.env.NODE_ENV === 'development') {
        console.log('🔍 Web Vitals:', metric);
      }

      // Enviar a Google Analytics en producción
      if (process.env.NODE_ENV === 'production' && window.gtag) {
        window.gtag('event', metric.name, {
          value: Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value),
          event_category: 'Web Vitals',
          event_label: metric.id,
          non_interaction: true,
        });
      }

      // Enviar al backend para análisis
      if (process.env.NODE_ENV === 'production') {
        fetch('/api/analytics/web-vitals', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: metric.name,
            value: metric.value,
            id: metric.id,
            timestamp: Date.now(),
            url: window.location.href,
            userAgent: navigator.userAgent,
          }),
        }).catch(console.error);
      }
    };

    // Configurar métricas de Core Web Vitals
    getCLS(sendToAnalytics);
    getFID(sendToAnalytics);
    getFCP(sendToAnalytics);
    getLCP(sendToAnalytics);
    getTTFB(sendToAnalytics);

    // Métricas adicionales de rendimiento
    if ('performance' in window && 'getEntriesByType' in performance) {
      // Navigation Timing
      const navigationEntries = performance.getEntriesByType('navigation');
      if (navigationEntries.length > 0) {
        const navigation = navigationEntries[0];
        
        // Tiempo de carga total
        const loadTime = navigation.loadEventEnd - navigation.fetchStart;
        
        if (process.env.NODE_ENV === 'development') {
          console.log('📊 Performance Metrics:', {
            loadTime: `${loadTime}ms`,
            serverResponseTime: `${navigation.responseEnd - navigation.requestStart}ms`,
            domContentLoaded: `${navigation.domContentLoadedEventEnd - navigation.fetchStart}ms`,
          });
        }
      }
    }

    // Monitorear errores de JavaScript
    const handleError = (event) => {
      if (process.env.NODE_ENV === 'production') {
        fetch('/api/analytics/errors', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: event.error?.message || 'Unknown error',
            stack: event.error?.stack || '',
            timestamp: Date.now(),
            url: window.location.href,
          }),
        }).catch(console.error);
      }
    };

    window.addEventListener('error', handleError);

    return () => {
      window.removeEventListener('error', handleError);
    };
  }, []);

  // Componente invisible que solo maneja el monitoreo
  return null;
};

export default PerformanceMonitor;
