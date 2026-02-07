// services/authService.js
import { configManager } from '../config/config.js';

const API_BASE_URL = configManager.getApiUrl();

export const authService = {
  // Solicitar recuperación de contraseña
  solicitarRecuperacion: async (email) => {
    const response = await fetch(`${API_BASE_URL}/auth/solicitar-recuperacion`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.mensaje || 'Error al solicitar recuperación');
    }

    return data;
  },

  // Validar token de recuperación
  validarTokenRecuperacion: async (token) => {
    const response = await fetch(`${API_BASE_URL}/auth/validar-recuperacion/${token}`);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.mensaje || 'Token inválido');
    }

    return data;
  },

  // Restablecer contraseña
  restablecerPassword: async (token, nuevaPassword) => {
    const response = await fetch(`${API_BASE_URL}/auth/restablecer-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token, nuevaPassword }),
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.mensaje || 'Error al restablecer contraseña');
    }

    return data;
  },

  // Login (para usar en otros componentes)
  login: async (email, password) => {
    try {
      console.log('🔍 DEBUG LOGIN - Iniciando login...');
      console.log('📧 Email:', email);
      console.log('🌐 API URL:', `${API_BASE_URL}/auth/login`);
      
      const requestData = { email, password };
      console.log('📦 Request data:', requestData);

      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      console.log('📡 Response status:', response.status);
      console.log('📡 Response ok:', response.ok);

      const data = await response.json();
      console.log('📥 Response data:', data);
      
      if (!response.ok) {
        console.error('❌ Login failed:', data.mensaje || 'Error en login');
        throw new Error(data.mensaje || 'Error en login');
      }

      console.log('✅ Login successful');
      return data;
    } catch (error) {
      console.error('🚨 LOGIN ERROR:', error);
      throw error;
    }
  },

  // Registro
  registrar: async (userData) => {
    const response = await fetch(`${API_BASE_URL}/auth/registrar-con-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData),
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.mensaje || 'Error al registrar');
    }

    return data;
  }
};
