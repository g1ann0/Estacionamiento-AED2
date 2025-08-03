import { API_URL } from './estacionamientoService';

export const usuarioService = {
    obtenerDatosUsuario: async (dni, token) => {
        const res = await fetch(`${API_URL}/usuarios/${dni}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!res.ok) {
            throw new Error('Error al obtener datos del usuario');
        }
        
        const data = await res.json();
        return data.usuario;
    },

    agregarVehiculo: async (vehiculoData, token) => {
        const res = await fetch(`${API_URL}/vehiculos/agregar`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(vehiculoData)
        });

        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.mensaje);
        }

        return await res.json();
    },

    modificarVehiculo: async (dominioOriginal, vehiculoData, token) => {
        const res = await fetch(`${API_URL}/usuarios/vehiculo/${dominioOriginal}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(vehiculoData)
        });

        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.mensaje);
        }

        return await res.json();
    },

    eliminarVehiculo: async (dominio, token) => {
        const res = await fetch(`${API_URL}/usuarios/vehiculo/${dominio}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.mensaje);
        }

        return await res.json();
    },

    recargarSaldo: async (dni, monto, token) => {
        const res = await fetch(`${API_URL}/usuarios/recargar`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ dni, monto })
        });

        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.mensaje);
        }

        return await res.json();
    }
};

export default usuarioService;
