const express = require('express');
const router = express.Router();

// Endpoint para recibir métricas de Web Vitals
router.post('/web-vitals', (req, res) => {
  try {
    const { name, value, id, timestamp, url, userAgent } = req.body;
    
    // Log en desarrollo
    if (process.env.NODE_ENV === 'development') {
      console.log('📊 Web Vitals recibidas:', {
        metric: name,
        value: `${Math.round(value)}${name === 'CLS' ? '' : 'ms'}`,
        id,
        url: url.split('?')[0], // Remover query params
        timestamp: new Date(timestamp).toLocaleString()
      });
    }

    // En producción, aquí guardarías en base de datos
    if (process.env.NODE_ENV === 'production') {
      // TODO: Implementar guardado en base de datos
      // const webVital = new WebVital({
      //   name,
      //   value,
      //   id,
      //   timestamp: new Date(timestamp),
      //   url,
      //   userAgent
      // });
      // await webVital.save();
    }

    res.status(200).json({ 
      success: true, 
      message: 'Métrica recibida correctamente' 
    });
  } catch (error) {
    console.error('Error al procesar métrica de Web Vitals:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error interno del servidor' 
    });
  }
});

// Endpoint para recibir errores de JavaScript
router.post('/errors', (req, res) => {
  try {
    const { message, stack, timestamp, url } = req.body;
    
    // Log en desarrollo
    if (process.env.NODE_ENV === 'development') {
      console.error('🚨 Error de JavaScript recibido:', {
        message,
        url: url.split('?')[0],
        timestamp: new Date(timestamp).toLocaleString(),
        stack: stack.split('\n').slice(0, 3).join('\n') // Primeras 3 líneas del stack
      });
    }

    // En producción, aquí guardarías en base de datos
    if (process.env.NODE_ENV === 'production') {
      // TODO: Implementar guardado en base de datos
      // const jsError = new JSError({
      //   message,
      //   stack,
      //   timestamp: new Date(timestamp),
      //   url
      // });
      // await jsError.save();
    }

    res.status(200).json({ 
      success: true, 
      message: 'Error recibido correctamente' 
    });
  } catch (error) {
    console.error('Error al procesar error de JavaScript:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error interno del servidor' 
    });
  }
});

// Endpoint para obtener estadísticas de rendimiento
router.get('/performance-stats', (req, res) => {
  try {
    // En desarrollo, devolver datos mock
    if (process.env.NODE_ENV === 'development') {
      res.json({
        success: true,
        data: {
          avgLoadTime: 1200,
          avgFCP: 800,
          avgLCP: 1500,
          avgFID: 50,
          avgCLS: 0.05,
          avgTTFB: 200,
          totalPageViews: 1250,
          errorRate: 0.02,
          lastUpdated: new Date().toISOString()
        }
      });
      return;
    }

    // En producción, consultar base de datos
    // TODO: Implementar consulta real a la base de datos
    res.json({
      success: true,
      data: {
        message: 'Implementar consulta a base de datos en producción'
      }
    });
  } catch (error) {
    console.error('Error al obtener estadísticas de rendimiento:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error interno del servidor' 
    });
  }
});

module.exports = router;
