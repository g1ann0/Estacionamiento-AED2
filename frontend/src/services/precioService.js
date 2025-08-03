// Servicio para gestionar los precios del estacionamiento

const API_URL = 'http://localhost:3000/api';

export const precioService = {
  // Obtener todos los precios (solo admin)
  obtenerTodosLosPrecios: async (token) => {
    try {
      const response = await fetch(`${API_URL}/precios`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.mensaje || 'Error al obtener precios');
      }

      return data;
    } catch (error) {
      console.error('Error en obtenerTodosLosPrecios:', error);
      throw error;
    }
  },

  // Obtener precio específico por tipo de usuario
  obtenerPrecioPorTipo: async (tipoUsuario) => {
    try {
      const response = await fetch(`${API_URL}/precios/${tipoUsuario}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.mensaje || 'Error al obtener precio');
      }

      return data;
    } catch (error) {
      console.error('Error en obtenerPrecioPorTipo:', error);
      throw error;
    }
  },

  // Crear nueva configuración de precio (solo admin)
  crearPrecio: async (tipoUsuario, precioPorHora, descripcion, token) => {
    try {
      const response = await fetch(`${API_URL}/precios`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          tipoUsuario,
          precioPorHora,
          descripcion
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.mensaje || 'Error al crear precio');
      }

      return data;
    } catch (error) {
      console.error('Error en crearPrecio:', error);
      throw error;
    }
  },

  // Actualizar precio específico (solo admin)
  actualizarPrecio: async (tipoUsuario, precioPorHora, descripcion, motivo, token) => {
    try {
      const response = await fetch(`${API_URL}/precios/${tipoUsuario}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          precioPorHora,
          descripcion,
          motivo
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.mensaje || 'Error al actualizar precio');
      }

      return data;
    } catch (error) {
      console.error('Error en actualizarPrecio:', error);
      throw error;
    }
  },

  // Eliminar configuración de precio (solo admin)
  eliminarPrecio: async (tipoUsuario, token) => {
    try {
      const response = await fetch(`${API_URL}/precios/${tipoUsuario}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.mensaje || 'Error al eliminar precio');
      }

      return data;
    } catch (error) {
      console.error('Error en eliminarPrecio:', error);
      throw error;
    }
  },

  // Obtener precio dinámico para mostrar en el frontend
  obtenerPrecioParaUsuario: async (esAsociado) => {
    try {
      const tipoUsuario = esAsociado ? 'asociado' : 'no_asociado';
      const response = await precioService.obtenerPrecioPorTipo(tipoUsuario);
      return response.precio.precioPorHora;
    } catch (error) {
      console.error('Error al obtener precio para usuario:', error);
      // Valores por defecto en caso de error
      return esAsociado ? 250 : 500;
    }
  },

  // Obtener historial de cambios de precios (solo admin)
  obtenerHistorialPrecios: async (tipoUsuario = null, limite = 50, pagina = 1, token) => {
    try {
      const params = new URLSearchParams({
        limite: limite.toString(),
        pagina: pagina.toString()
      });
      
      if (tipoUsuario) {
        params.append('tipoUsuario', tipoUsuario);
      }

      const response = await fetch(`${API_URL}/precios/historial/cambios?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.mensaje || 'Error al obtener historial');
      }

      return data;
    } catch (error) {
      console.error('Error en obtenerHistorialPrecios:', error);
      throw error;
    }
  },

  // Obtener estadísticas de cambios de precios (solo admin)
  obtenerEstadisticasPrecios: async (token) => {
    try {
      const response = await fetch(`${API_URL}/precios/historial/estadisticas`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.mensaje || 'Error al obtener estadísticas');
      }

      return data;
    } catch (error) {
      console.error('Error en obtenerEstadisticasPrecios:', error);
      throw error;
    }
  }
};
