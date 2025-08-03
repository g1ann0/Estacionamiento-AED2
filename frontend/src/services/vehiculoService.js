import CONFIG, { configManager } from '../config/config.js';

export const API_URL = configManager.getApiUrl();

export const vehiculoService = {
    verificarEstado: async (dominio, token) => {
        try {
            const res = await fetch(`${API_URL}/vehiculos/estado/${dominio}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!res.ok) {
                throw new Error('Error al verificar estado del vehículo');
            }
            
            const data = await res.json();
            return data;
        } catch (error) {
            console.error('Error:', error);
            throw error;
        }
    },

    // Verificar todos los vehículos de un usuario
    verificarEstadoVehiculos: async (vehiculos, token) => {
        try {
            for (const vehiculo of vehiculos) {
                const estado = await vehiculoService.verificarEstado(vehiculo.dominio, token);
                if (estado.estActivo) {
                    return {
                        vehiculoDominio: vehiculo.dominio,
                        horaInicio: estado.vehiculo.ultimoIngreso,
                        estado: 'activo'
                    };
                }
            }
            return null;
        } catch (error) {
            console.error('Error al verificar vehículos:', error);
            throw error;
        }
    }
};

export default vehiculoService;
