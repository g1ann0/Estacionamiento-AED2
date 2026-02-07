const API_BASE_URL = 'http://localhost:3000/api';

/**
 * Servicio para el facturador AFIP
 */
export const facturadorService = {
  /**
   * Obtener comprobantes aprobados pendientes de facturación
   */
  obtenerComprobantesAprobados: async (token) => {
    try {
      const response = await fetch(`${API_BASE_URL}/facturador/comprobantes-aprobados`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.mensaje || 'Error al obtener comprobantes aprobados');
      }

      return await response.json();
    } catch (error) {
      console.error('Error en obtenerComprobantesAprobados:', error);
      throw error;
    }
  },

  /**
   * Validar CUIT con AFIP
   */
  validarCUITConAFIP: async (cuit, token) => {
    try {
      const response = await fetch(`${API_BASE_URL}/facturador/validar-cuit`, {
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
      console.error('Error en validarCUITConAFIP:', error);
      throw error;
    }
  },

  /**
   * Generar factura electrónica
   */
  generarFactura: async (datos, token) => {
    try {
      const response = await fetch(`${API_BASE_URL}/facturador/generar-factura`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(datos)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.mensaje || 'Error al generar factura');
      }

      return await response.json();
    } catch (error) {
      console.error('Error en generarFactura:', error);
      throw error;
    }
  },

  /**
   * Obtener facturas con filtros
   */
  obtenerFacturas: async (filtros, token) => {
    try {
      const params = new URLSearchParams();
      
      if (filtros.fechaDesde) params.append('fechaDesde', filtros.fechaDesde);
      if (filtros.fechaHasta) params.append('fechaHasta', filtros.fechaHasta);
      if (filtros.tipoFactura) params.append('tipoFactura', filtros.tipoFactura);
      if (filtros.estado) params.append('estado', filtros.estado);
      if (filtros.busqueda) params.append('busqueda', filtros.busqueda);
      if (filtros.limite) params.append('limite', filtros.limite);
      if (filtros.pagina) params.append('pagina', filtros.pagina);

      const response = await fetch(`${API_BASE_URL}/facturador/facturas?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.mensaje || 'Error al obtener facturas');
      }

      return await response.json();
    } catch (error) {
      console.error('Error en obtenerFacturas:', error);
      throw error;
    }
  },

  /**
   * Descargar PDF de una factura
   */
  descargarFacturaPDF: async (nroFactura) => {
    try {
      const token = localStorage.getItem('token');
      
      const response = await fetch(
        `${API_BASE_URL}/facturador/facturas/${nroFactura}/pdf`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.mensaje || 'Error al descargar PDF');
      }

      const blob = await response.blob();
      return { data: blob };
    } catch (error) {
      console.error('Error en descargarFacturaPDF:', error);
      throw error;
    }
  }
};
