import CONFIG, { configManager } from '../config/config.js';

export const API_URL = configManager.getApiUrl();

export const estacionamientoService = {
    verificarEstacionamientoActivo: async (dni, dominio, token) => {
        try {
            // Verificar el estado actual del vehículo
            const res = await fetch(`${API_URL}/vehiculos/estado/${dominio}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.mensaje || 'Error al verificar estacionamiento');
            }
            
            const data = await res.json();
            console.log('Verificación estacionamiento:', data);
            return data.estacionamiento;
        } catch (error) {
            console.error('Error:', error);
            throw error; // Propagar el error para manejarlo en el componente
        }
    },

    iniciarEstacionamiento: async (dni, dominio, porton, token) => {
        const res = await fetch(`${API_URL}/estacionamiento/iniciar`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ dni, dominio, porton })
        });

        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.mensaje);
        }

        return await res.json();
    },

    finalizarEstacionamiento: async (dni, dominio, token) => {
        try {
            const res = await fetch(`${API_URL}/estacionamiento/finalizar`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ dni, dominio })
            });

            if (!res.ok) {
                if (res.status === 401) {
                    throw new Error('Sesión expirada. Por favor, vuelva a iniciar sesión.');
                }
                const error = await res.json();
                throw new Error(error.mensaje);
            }

            return await res.json();
        } catch (error) {
            console.error('Error en finalizarEstacionamiento:', error);
            throw error;
        }
    }
};

export default estacionamientoService;
