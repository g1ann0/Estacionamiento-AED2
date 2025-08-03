import CONFIG from '../config/config.js';

const API_BASE_URL = `${CONFIG.BACKEND_URL}/api`;

export const comprobanteService = {
  // Obtener todos los comprobantes con filtros
  obtenerTodosLosComprobantes: async (filtros = {}, token) => {
    try {
      const params = new URLSearchParams();
      
      if (filtros.estado) params.append('estado', filtros.estado);
      if (filtros.fechaDesde) params.append('fechaDesde', filtros.fechaDesde);
      if (filtros.fechaHasta) params.append('fechaHasta', filtros.fechaHasta);
      if (filtros.busqueda) params.append('busqueda', filtros.busqueda);
      if (filtros.pagina) params.append('pagina', filtros.pagina);
      if (filtros.limite) params.append('limite', filtros.limite);
      if (filtros.ordenPor) params.append('ordenPor', filtros.ordenPor);
      if (filtros.orden) params.append('orden', filtros.orden);

      const url = `${API_BASE_URL}/admin/comprobantes${params.toString() ? `?${params.toString()}` : ''}`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.mensaje || 'Error al obtener comprobantes');
      }

      return await response.json();
    } catch (error) {
      console.error('Error en obtenerTodosLosComprobantes:', error);
      throw error;
    }
  },

  // Obtener comprobantes pendientes
  obtenerComprobantesPendientes: async (token) => {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/comprobantes/pendientes`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.mensaje || 'Error al obtener comprobantes pendientes');
      }

      return await response.json();
    } catch (error) {
      console.error('Error en obtenerComprobantesPendientes:', error);
      throw error;
    }
  },

  // Validar comprobante
  validarComprobante: async (nroComprobante, token) => {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/comprobantes/${nroComprobante}/validar`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.mensaje || 'Error al validar comprobante');
      }

      return await response.json();
    } catch (error) {
      console.error('Error en validarComprobante:', error);
      throw error;
    }
  },

  // Rechazar comprobante
  rechazarComprobante: async (nroComprobante, token) => {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/comprobantes/${nroComprobante}/rechazar`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.mensaje || 'Error al rechazar comprobante');
      }

      return await response.json();
    } catch (error) {
      console.error('Error en rechazarComprobante:', error);
      throw error;
    }
  },

  // Descargar PDF del comprobante
  descargarPDFComprobante: async (nroComprobante, token) => {
    try {
      const response = await fetch(`${API_BASE_URL}/comprobantes/${nroComprobante}/pdf`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        let errorMessage = 'Error al generar PDF del comprobante';
        try {
          const errorData = await response.json();
          errorMessage = errorData.mensaje || errorMessage;
        } catch {
          // Si no se puede parsear como JSON, usar mensaje por defecto
        }
        throw new Error(errorMessage);
      }

      // Crear blob del PDF
      const blob = await response.blob();

      // Verificar que sea realmente un PDF
      if (blob.type !== 'application/pdf') {
        throw new Error('La respuesta no es un archivo PDF válido');
      }

      // Crear enlace de descarga
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `comprobante_${nroComprobante.replace('-', '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      
      // Limpiar
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      return { success: true, mensaje: 'PDF descargado exitosamente' };

    } catch (error) {
      console.error('Error en descargarPDFComprobante:', error);
      throw error;
    }
  }
};
