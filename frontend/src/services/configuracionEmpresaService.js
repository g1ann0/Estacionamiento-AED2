import CONFIG from '../config/config.js';

const API_BASE_URL = `${CONFIG.BACKEND_URL}/api`;

export const configuracionEmpresaService = {
  // Obtener configuración actual
  obtenerConfiguracion: async (token) => {
    try {
      const response = await fetch(`${API_BASE_URL}/configuracion-empresa`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.mensaje || 'Error al obtener configuración');
      }

      return await response.json();
    } catch (error) {
      console.error('Error en obtenerConfiguracion:', error);
      throw error;
    }
  },

  // Actualizar configuración
  actualizarConfiguracion: async (configuracion, token) => {
    try {
      const response = await fetch(`${API_BASE_URL}/configuracion-empresa`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(configuracion)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.mensaje || 'Error al actualizar configuración');
      }

      return await response.json();
    } catch (error) {
      console.error('Error en actualizarConfiguracion:', error);
      throw error;
    }
  },

  // Validar configuración para facturación
  validarConfiguracion: async (token) => {
    try {
      const response = await fetch(`${API_BASE_URL}/configuracion-empresa/validar`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.mensaje || 'Error al validar configuración');
      }

      return await response.json();
    } catch (error) {
      console.error('Error en validarConfiguracion:', error);
      throw error;
    }
  },

  // Obtener próximo número de factura
  obtenerProximoNumero: async (token) => {
    try {
      const response = await fetch(`${API_BASE_URL}/configuracion-empresa/proximo-numero`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.mensaje || 'Error al obtener próximo número');
      }

      return await response.json();
    } catch (error) {
      console.error('Error en obtenerProximoNumero:', error);
      throw error;
    }
  }
};
