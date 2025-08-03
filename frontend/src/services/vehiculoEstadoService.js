import { API_URL } from './estacionamientoService';

export const vehiculoEstadoService = {
    verificarEstado: async (dominio, token) => {
        try {
            const res = await fetch(`${API_URL}/estacionamiento/estado/${dominio}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.mensaje || 'Error al verificar estado');
            }

            const data = await res.json();
            return {
                estActivo: !!data.estacionamiento,
                estacionamiento: data.estacionamiento
            };
        } catch (error) {
            console.error('Error al verificar estado:', error);
            throw error;
        }
    }
};

export default vehiculoEstadoService;
