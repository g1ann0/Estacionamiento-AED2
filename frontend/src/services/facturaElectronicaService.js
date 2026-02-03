import CONFIG from '../config/config.js';

const API_BASE_URL = `${CONFIG.BACKEND_URL}/api/facturas-electronicas`;

export const facturaElectronicaService = {
  /**
   * Crear factura electrónica desde un comprobante aprobado
   */
  crearFacturaElectronica: async (datos, token) => {
    try {
      const response = await fetch(`${API_BASE_URL}/crear`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(datos)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.mensaje || 'Error al crear factura electrónica');
      }

      return await response.json();
    } catch (error) {
      console.error('Error en crearFacturaElectronica:', error);
      throw error;
    }
  },

  /**
   * Obtener facturas electrónicas con filtros
   */
  obtenerFacturasElectronicas: async (filtros = {}, token) => {
    try {
      const params = new URLSearchParams();
      
      if (filtros.fechaDesde) params.append('fechaDesde', filtros.fechaDesde);
      if (filtros.fechaHasta) params.append('fechaHasta', filtros.fechaHasta);
      if (filtros.tipoComprobante) params.append('tipoComprobante', filtros.tipoComprobante);
      if (filtros.estado) params.append('estado', filtros.estado);
      if (filtros.puntoVenta) params.append('puntoVenta', filtros.puntoVenta);
      if (filtros.busqueda) params.append('busqueda', filtros.busqueda);
      if (filtros.pagina) params.append('pagina', filtros.pagina);
      if (filtros.limite) params.append('limite', filtros.limite);

      const url = `${API_BASE_URL}${params.toString() ? `?${params.toString()}` : ''}`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.mensaje || 'Error al obtener facturas electrónicas');
      }

      return await response.json();
    } catch (error) {
      console.error('Error en obtenerFacturasElectronicas:', error);
      throw error;
    }
  },

  /**
   * Obtener detalle de una factura electrónica por ID
   */
  obtenerFacturaDetalle: async (facturaId, token) => {
    try {
      const response = await fetch(`${API_BASE_URL}/${facturaId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.mensaje || 'Error al obtener detalle de factura');
      }

      return await response.json();
    } catch (error) {
      console.error('Error en obtenerFacturaDetalle:', error);
      throw error;
    }
  },

  /**
   * Verificar estado del servidor AFIP
   */
  verificarEstadoAFIP: async (token) => {
    try {
      const response = await fetch(`${API_BASE_URL}/afip/estado`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.mensaje || 'Error al verificar estado AFIP');
      }

      return await response.json();
    } catch (error) {
      console.error('Error en verificarEstadoAFIP:', error);
      throw error;
    }
  },

  /**
   * Obtener puntos de venta habilitados
   */
  obtenerPuntosVenta: async (token) => {
    try {
      const response = await fetch(`${API_BASE_URL}/afip/puntos-venta`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.mensaje || 'Error al obtener puntos de venta');
      }

      return await response.json();
    } catch (error) {
      console.error('Error en obtenerPuntosVenta:', error);
      throw error;
    }
  },

  /**
   * Obtener tipos de comprobante disponibles
   */
  obtenerTiposComprobante: async (token) => {
    try {
      const response = await fetch(`${API_BASE_URL}/afip/tipos-comprobante`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.mensaje || 'Error al obtener tipos de comprobante');
      }

      return await response.json();
    } catch (error) {
      console.error('Error en obtenerTiposComprobante:', error);
      throw error;
    }
  },

  /**
   * Validar un CUIT
   */
  validarCUIT: async (cuit, token) => {
    try {
      const response = await fetch(`${API_BASE_URL}/validar-cuit`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ cuit })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.mensaje || 'Error al validar CUIT');
      }

      return await response.json();
    } catch (error) {
      console.error('Error en validarCUIT:', error);
      throw error;
    }
  },

  /**
   * Descargar PDF de factura electrónica
   */
  descargarPDF: async (facturaId, token) => {
    try {
      const response = await fetch(`${API_BASE_URL}/${facturaId}/pdf`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Error al descargar PDF');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `factura-${facturaId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error en descargarPDF:', error);
      throw error;
    }
  }
};
