/**
 * SERVICIO DE CONSULTA DE PADRÓN AFIP/ARCA
 * Consulta automática de datos fiscales por CUIT
 */

import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';

/**
 * Consulta datos de un CUIT en el padrón de AFIP
 * @param {string} cuit - CUIT a consultar (con o sin guiones)
 * @returns {Promise<Object>} Datos del contribuyente
 */
export const consultarCUIT = async (cuit) => {
  try {
    const token = localStorage.getItem('token');
    
    const response = await axios.post(
      `${API_URL}/afip/consultar-cuit`,
      { cuit },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data;
  } catch (error) {
    console.error('Error al consultar CUIT en AFIP:', error);
    throw error.response?.data || { 
      success: false, 
      error: 'Error al conectar con AFIP' 
    };
  }
};

/**
 * Valida formato de CUIT sin consultar AFIP
 * @param {string} cuit - CUIT a validar
 * @returns {Promise<Object>} Resultado de la validación
 */
export const validarCUIT = async (cuit) => {
  try {
    const response = await axios.post(
      `${API_URL}/afip/validar-cuit`,
      { cuit },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data;
  } catch (error) {
    console.error('Error al validar CUIT:', error);
    throw error.response?.data || { 
      success: false, 
      error: 'Error al validar CUIT' 
    };
  }
};

const afipService = {
  consultarCUIT,
  validarCUIT
};

export default afipService;
