const API_URL = 'http://localhost:3000/api';

// Funciones para gestión de usuarios
export const obtenerTodosLosUsuarios = async () => {
  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_URL}/admin/usuarios`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Error al obtener usuarios');
    }

    const data = await response.json();
    return data.usuarios;
  } catch (error) {
    console.error('Error en obtenerTodosLosUsuarios:', error);
    throw error;
  }
};

export const modificarUsuario = async (dni, datosUsuario) => {
  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_URL}/admin/usuarios/${dni}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(datosUsuario)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.mensaje || 'Error al modificar usuario');
    }

    return await response.json();
  } catch (error) {
    console.error('Error en modificarUsuario:', error);
    throw error;
  }
};

export const eliminarUsuario = async (dni) => {
  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_URL}/admin/usuarios/${dni}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.mensaje || 'Error al eliminar usuario');
    }

    return await response.json();
  } catch (error) {
    console.error('Error en eliminarUsuario:', error);
    throw error;
  }
};

// Funciones para gestión de vehículos
export const obtenerTodosLosVehiculos = async () => {
  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_URL}/admin/vehiculos`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Error al obtener vehículos');
    }

    const data = await response.json();
    return data.vehiculos;
  } catch (error) {
    console.error('Error en obtenerTodosLosVehiculos:', error);
    throw error;
  }
};

export const agregarVehiculo = async (datosVehiculo) => {
  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_URL}/admin/vehiculos`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(datosVehiculo)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.mensaje || 'Error al agregar vehículo');
    }

    return await response.json();
  } catch (error) {
    console.error('Error en agregarVehiculo:', error);
    throw error;
  }
};

export const modificarVehiculo = async (dominio, datosVehiculo) => {
  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_URL}/admin/vehiculos/${dominio}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(datosVehiculo)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.mensaje || 'Error al modificar vehículo');
    }

    return await response.json();
  } catch (error) {
    console.error('Error en modificarVehiculo:', error);
    throw error;
  }
};

export const eliminarVehiculo = async (dominio, motivo) => {
  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_URL}/admin/vehiculos/${dominio}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ motivo })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.mensaje || 'Error al eliminar vehículo');
    }

    return await response.json();
  } catch (error) {
    console.error('Error en eliminarVehiculo:', error);
    throw error;
  }
};

// Funciones para historial de saldos
export const obtenerHistorialSaldos = async (usuarioDni = null, limite = 50, pagina = 1) => {
  try {
    const token = localStorage.getItem('token');
    const params = new URLSearchParams({
      limite: limite.toString(),
      pagina: pagina.toString()
    });
    
    if (usuarioDni) {
      params.append('usuarioDni', usuarioDni);
    }

    const response = await fetch(`${API_URL}/admin/saldos/historial?${params}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.mensaje || 'Error al obtener historial de saldos');
    }

    return await response.json();
  } catch (error) {
    console.error('Error en obtenerHistorialSaldos:', error);
    throw error;
  }
};

export const obtenerEstadisticasSaldos = async () => {
  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_URL}/admin/saldos/estadisticas`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.mensaje || 'Error al obtener estadísticas de saldos');
    }

    return await response.json();
  } catch (error) {
    console.error('Error en obtenerEstadisticasSaldos:', error);
    throw error;
  }
};

// Funciones para historial de vehículos
export const obtenerHistorialVehiculos = async (dominio = null, tipoOperacion = null, usuarioDni = null, limite = 50, pagina = 1) => {
  try {
    const token = localStorage.getItem('token');
    const params = new URLSearchParams({
      limite: limite.toString(),
      pagina: pagina.toString()
    });
    
    if (dominio) {
      params.append('dominio', dominio);
    }
    if (tipoOperacion) {
      params.append('tipoOperacion', tipoOperacion);
    }
    if (usuarioDni) {
      params.append('usuarioDni', usuarioDni);
    }

    const response = await fetch(`${API_URL}/admin/vehiculos/historial?${params}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.mensaje || 'Error al obtener historial de vehículos');
    }

    return await response.json();
  } catch (error) {
    console.error('Error en obtenerHistorialVehiculos:', error);
    throw error;
  }
};

export const obtenerEstadisticasVehiculos = async () => {
  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_URL}/admin/vehiculos/estadisticas`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.mensaje || 'Error al obtener estadísticas de vehículos');
    }

    return await response.json();
  } catch (error) {
    console.error('Error en obtenerEstadisticasVehiculos:', error);
    throw error;
  }
};

// Funciones para ingresos/egresos del estacionamiento
export const obtenerIngresos = async (filtros = {}) => {
  try {
    const token = localStorage.getItem('token');
    const params = new URLSearchParams();
    
    // Agregar filtros como parámetros de consulta
    Object.keys(filtros).forEach(key => {
      if (filtros[key] !== null && filtros[key] !== undefined && filtros[key] !== '') {
        params.append(key, filtros[key]);
      }
    });

    const response = await fetch(`${API_URL}/admin/transacciones/ingresos?${params}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.mensaje || 'Error al obtener ingresos');
    }

    return await response.json();
  } catch (error) {
    console.error('Error en obtenerIngresos:', error);
    throw error;
  }
};

export const obtenerEgresos = async (filtros = {}) => {
  try {
    const token = localStorage.getItem('token');
    const params = new URLSearchParams();
    
    // Agregar filtros como parámetros de consulta
    Object.keys(filtros).forEach(key => {
      if (filtros[key] !== null && filtros[key] !== undefined && filtros[key] !== '') {
        params.append(key, filtros[key]);
      }
    });

    const response = await fetch(`${API_URL}/admin/transacciones/egresos?${params}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.mensaje || 'Error al obtener egresos');
    }

    return await response.json();
  } catch (error) {
    console.error('Error en obtenerEgresos:', error);
    throw error;
  }
};

export const obtenerEstadisticasTransacciones = async (filtros = {}) => {
  try {
    const token = localStorage.getItem('token');
    const params = new URLSearchParams();
    
    // Agregar filtros como parámetros de consulta
    Object.keys(filtros).forEach(key => {
      if (filtros[key] !== null && filtros[key] !== undefined && filtros[key] !== '') {
        params.append(key, filtros[key]);
      }
    });

    const response = await fetch(`${API_URL}/admin/transacciones/estadisticas?${params}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.mensaje || 'Error al obtener estadísticas de transacciones');
    }

    return await response.json();
  } catch (error) {
    console.error('Error en obtenerEstadisticasTransacciones:', error);
    throw error;
  }
};
