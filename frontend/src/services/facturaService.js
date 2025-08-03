import CONFIG from '../config/config.js';

const API_BASE_URL = `${CONFIG.BACKEND_URL}/api`;

export const facturaService = {
  // Obtener todas las facturas con filtros
  obtenerFacturas: async (filtros = {}, token) => {
    try {
      const params = new URLSearchParams();
      
      if (filtros.fechaDesde) params.append('fechaDesde', filtros.fechaDesde);
      if (filtros.fechaHasta) params.append('fechaHasta', filtros.fechaHasta);
      if (filtros.busqueda) params.append('busqueda', filtros.busqueda);
      if (filtros.estado) params.append('estado', filtros.estado);
      if (filtros.pagina) params.append('pagina', filtros.pagina);
      if (filtros.limite) params.append('limite', filtros.limite);

      const url = `${API_BASE_URL}/facturas${params.toString() ? `?${params.toString()}` : ''}`;

      const response = await fetch(url, {
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

  // Descargar PDF de factura
  descargarPDFFactura: async (nroFactura, token) => {
    try {
      const response = await fetch(`${API_BASE_URL}/facturas/${nroFactura}/pdf`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        let errorMessage = 'Error al generar PDF';
        try {
          const errorData = await response.json();
          errorMessage = errorData.mensaje || errorMessage;
        } catch (e) {
          // Si no puede parsear JSON, usar mensaje por defecto
        }
        throw new Error(errorMessage);
      }

      // Crear blob del PDF
      const blob = await response.blob();
      
      // Verificar que sea realmente un PDF
      if (blob.type !== 'application/pdf') {
        throw new Error('La respuesta no es un archivo PDF válido');
      }
      
      // Crear URL temporal y descargar
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `factura_${nroFactura.replace('-', '_')}.pdf`;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      
      // Limpiar
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }, 100);

      return { success: true };
    } catch (error) {
      console.error('Error en descargarPDFFactura:', error);
      throw error;
    }
  },

  // Anular factura
  anularFactura: async (nroFactura, motivo, token) => {
    try {
      const response = await fetch(`${API_BASE_URL}/facturas/${nroFactura}/anular`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ motivo })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.mensaje || 'Error al anular factura');
      }

      return await response.json();
    } catch (error) {
      console.error('Error en anularFactura:', error);
      throw error;
    }
  }
};
