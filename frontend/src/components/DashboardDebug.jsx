import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { usuarioService } from '../services/usuarioService';
import { estacionamientoService } from '../services/estacionamientoService';
import CONFIG from '../config/config.js';

const DashboardDebug = () => {
  const { usuario, getToken } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);

  const addLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, { message, type, timestamp }]);
  };

  useEffect(() => {
    addLog('🔧 Dashboard Debug cargado', 'info');
    addLog(`👤 Usuario logueado: ${usuario?.nombre || 'No encontrado'}`, usuario ? 'success' : 'error');
    addLog(`🔑 Token presente: ${getToken() ? 'SÍ' : 'NO'}`, getToken() ? 'success' : 'error');
    addLog(`🌐 Backend URL: ${CONFIG.BACKEND_URL}`, 'info');
    addLog(`🔗 API URL: ${CONFIG.API_BASE_URL}`, 'info');
  }, [usuario, getToken]);

  const testApiCalls = async () => {
    setLoading(true);
    const token = getToken();
    
    if (!token) {
      addLog('❌ No hay token disponible', 'error');
      setLoading(false);
      return;
    }

    if (!usuario?.dni) {
      addLog('❌ No hay DNI del usuario', 'error');
      setLoading(false);
      return;
    }

    try {
      addLog('🔍 Probando llamadas a la API...', 'info');
      addLog(`📱 Usando token: ${token.substring(0, 20)}...`, 'info');
      addLog(`👤 DNI del usuario: ${usuario.dni}`, 'info');

      // Test 1: Obtener datos del usuario
      addLog('📞 Test 1: Obtener datos del usuario...', 'info');
      try {
        const userData = await usuarioService.obtenerDatosUsuario(usuario.dni, token);
        addLog('✅ obtenerDatosUsuario exitoso', 'success');
        addLog(`📄 Datos recibidos: ${JSON.stringify(userData, null, 2)}`, 'success');
      } catch (error) {
        addLog(`❌ obtenerDatosUsuario falló: ${error.message}`, 'error');
      }

      // Test 2: Verificar estacionamiento (si hay vehículos)
      if (usuario.vehiculos && usuario.vehiculos.length > 0) {
        const primerVehiculo = usuario.vehiculos[0];
        addLog(`📞 Test 2: Verificar estacionamiento del vehículo ${primerVehiculo.dominio}...`, 'info');
        try {
          const estadoData = await estacionamientoService.verificarEstacionamientoActivo(
            usuario.dni, 
            primerVehiculo.dominio, 
            token
          );
          addLog('✅ verificarEstacionamientoActivo exitoso', 'success');
          addLog(`📄 Estado recibido: ${JSON.stringify(estadoData, null, 2)}`, 'success');
        } catch (error) {
          addLog(`❌ verificarEstacionamientoActivo falló: ${error.message}`, 'error');
        }
      } else {
        addLog('ℹ️ No hay vehículos para probar estacionamiento', 'info');
      }

      // Test 3: Request directo a API
      addLog('📞 Test 3: Request directo a /api/auth/verificar...', 'info');
      try {
        const response = await fetch(`${CONFIG.API_BASE_URL}/auth/verificar`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          addLog('✅ /auth/verificar exitoso', 'success');
          addLog(`📄 Verificación: ${JSON.stringify(data, null, 2)}`, 'success');
        } else {
          const errorData = await response.json();
          addLog(`❌ /auth/verificar falló: ${response.status} - ${JSON.stringify(errorData)}`, 'error');
        }
      } catch (error) {
        addLog(`❌ /auth/verificar error de red: ${error.message}`, 'error');
      }

    } catch (error) {
      addLog(`❌ Error general: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const getLogStyle = (type) => {
    const baseStyle = {
      padding: '8px',
      margin: '2px 0',
      borderRadius: '4px',
      fontSize: '12px',
      fontFamily: 'monospace'
    };

    switch (type) {
      case 'error':
        return { ...baseStyle, backgroundColor: '#ffebee', color: '#c62828' };
      case 'success':
        return { ...baseStyle, backgroundColor: '#e8f5e8', color: '#2e7d32' };
      default:
        return { ...baseStyle, backgroundColor: '#e3f2fd', color: '#1565c0' };
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h2>🔧 Dashboard Debug - Diagnóstico de API</h2>
      
      <div style={{ marginBottom: '20px', padding: '15px', border: '1px solid #ddd', borderRadius: '8px' }}>
        <h3>Estado Actual</h3>
        <p><strong>Usuario:</strong> {usuario?.nombre || 'No encontrado'}</p>
        <p><strong>Rol:</strong> {usuario?.rol || 'No encontrado'}</p>
        <p><strong>Email:</strong> {usuario?.email || 'No encontrado'}</p>
        <p><strong>Token:</strong> {getToken() ? 'Presente' : 'Ausente'}</p>
        
        <button
          onClick={testApiCalls}
          disabled={loading}
          style={{
            backgroundColor: loading ? '#ccc' : '#2196F3',
            color: 'white',
            padding: '12px 24px',
            border: 'none',
            borderRadius: '4px',
            fontSize: '16px',
            cursor: loading ? 'not-allowed' : 'pointer',
            marginTop: '10px'
          }}
        >
          {loading ? 'Probando APIs...' : 'Probar Llamadas API'}
        </button>
      </div>

      <div style={{ marginTop: '20px' }}>
        <h3>📋 Logs de Diagnóstico ({logs.length})</h3>
        <div style={{ 
          height: '400px', 
          overflowY: 'auto', 
          border: '1px solid #ddd', 
          borderRadius: '4px',
          backgroundColor: '#f9f9f9',
          padding: '10px'
        }}>
          {logs.map((log, index) => (
            <div key={index} style={getLogStyle(log.type)}>
              <span style={{ color: '#666', fontSize: '10px' }}>[{log.timestamp}]</span> {log.message}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DashboardDebug;
