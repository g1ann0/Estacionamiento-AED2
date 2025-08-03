// services/perfilService.js
import CONFIG from '../config/config.js';

const API_BASE_URL = ${CONFIG.BACKEND_URL}/api';

export const perfilService = {
  // Obtener perfil del usuario
  obtenerPerfil: async (token) => {
    const response = await fetch(`${API_BASE_URL}/perfil`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.mensaje || 'Error al obtener perfil');
    }

    return data;
  },

  // Actualizar datos básicos
  actualizarDatosBasicos: async (token, datos) => {
    const response = await fetch(`${API_BASE_URL}/perfil/datos-basicos`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(datos)
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.mensaje || 'Error al actualizar datos');
    }

    return data;
  },

  // Cambiar contraseña
  cambiarContrasena: async (token, passwords) => {
    const response = await fetch(`${API_BASE_URL}/perfil/cambiar-contrasena`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(passwords)
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.mensaje || 'Error al cambiar contraseña');
    }

    return data;
  },

  // Agregar vehículo
  agregarVehiculo: async (token, vehiculo) => {
    const response = await fetch(`${API_BASE_URL}/perfil/vehiculos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(vehiculo)
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.mensaje || 'Error al agregar vehículo');
    }

    return data;
  },

  // Eliminar vehículo
  eliminarVehiculo: async (token, vehiculoId) => {
    const response = await fetch(`${API_BASE_URL}/perfil/vehiculos/${vehiculoId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.mensaje || 'Error al eliminar vehículo');
    }

    return data;
  }
};
