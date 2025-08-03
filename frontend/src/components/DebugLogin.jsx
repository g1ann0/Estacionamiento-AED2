import React, { useState } from 'react';
import { authService } from '../services/authService';
import { useAuth } from '../context/AuthContext';

const DebugLogin = () => {
  const [email, setEmail] = useState('admin@estacionamiento.com');
  const [password, setPassword] = useState('admin123');
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const { login: contextLogin } = useAuth();

  const addLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, { message, type, timestamp }]);
  };

  const clearLogs = () => {
    setLogs([]);
  };

  const testLogin = async () => {
    setLoading(true);
    clearLogs();
    
    try {
      addLog('🔍 Iniciando test de login...', 'info');
      addLog(`📧 Email: ${email}`, 'info');
      addLog(`🔑 Password: ${password ? '***' : 'vacío'}`, 'info');
      
      // Interceptar console.log temporalmente
      const originalLog = console.log;
      const originalError = console.error;
      
      console.log = (...args) => {
        addLog(args.join(' '), 'debug');
        originalLog(...args);
      };
      
      console.error = (...args) => {
        addLog(args.join(' '), 'error');
        originalError(...args);
      };

      const result = await authService.login(email, password);
      
      // Restaurar console
      console.log = originalLog;
      console.error = originalError;
      
      addLog('✅ Login exitoso!', 'success');
      addLog(`📄 Respuesta: ${JSON.stringify(result, null, 2)}`, 'success');
      
      // TEST: Guardar en localStorage
      addLog('💾 Probando localStorage...', 'info');
      try {
        localStorage.setItem('test', 'valor_test');
        const testValue = localStorage.getItem('test');
        addLog(`✅ localStorage funciona: ${testValue}`, 'success');
        localStorage.removeItem('test');
      } catch (error) {
        addLog(`❌ ERROR en localStorage: ${error.message}`, 'error');
      }

      // TEST: Usar AuthContext
      addLog('🔐 Probando AuthContext login...', 'info');
      try {
        contextLogin(result.token, result.usuario);
        addLog('✅ AuthContext login exitoso', 'success');
        
        // Verificar si se guardó
        const savedToken = localStorage.getItem('token');
        const savedUser = localStorage.getItem('usuario');
        addLog(`📥 Token guardado: ${savedToken ? 'SÍ' : 'NO'}`, savedToken ? 'success' : 'error');
        addLog(`👤 Usuario guardado: ${savedUser ? 'SÍ' : 'NO'}`, savedUser ? 'success' : 'error');
        
        if (savedUser) {
          try {
            const parsedUser = JSON.parse(savedUser);
            addLog(`👤 Usuario parseado: ${JSON.stringify(parsedUser)}`, 'success');
          } catch (e) {
            addLog(`❌ Error parseando usuario: ${e.message}`, 'error');
          }
        }
      } catch (error) {
        addLog(`❌ ERROR en AuthContext: ${error.message}`, 'error');
      }
      
    } catch (error) {
      addLog(`❌ Error: ${error.message}`, 'error');
      addLog(`📄 Detalles: ${JSON.stringify(error, null, 2)}`, 'error');
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
      case 'debug':
        return { ...baseStyle, backgroundColor: '#f3e5f5', color: '#7b1fa2' };
      default:
        return { ...baseStyle, backgroundColor: '#e3f2fd', color: '#1565c0' };
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h2>🔧 Debug Login - Acceso desde Celular</h2>
      
      <div style={{ marginBottom: '20px', padding: '15px', border: '1px solid #ddd', borderRadius: '8px' }}>
        <h3>Credenciales de Test</h3>
        <div style={{ marginBottom: '10px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>Email:</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ width: '100%', padding: '8px', fontSize: '16px' }}
          />
        </div>
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>Password:</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: '100%', padding: '8px', fontSize: '16px' }}
          />
        </div>
        <button
          onClick={testLogin}
          disabled={loading}
          style={{
            backgroundColor: loading ? '#ccc' : '#2196F3',
            color: 'white',
            padding: '12px 24px',
            border: 'none',
            borderRadius: '4px',
            fontSize: '16px',
            cursor: loading ? 'not-allowed' : 'pointer',
            marginRight: '10px'
          }}
        >
          {loading ? 'Probando...' : 'Probar Login'}
        </button>
        <button
          onClick={() => window.location.href = '/login'}
          style={{
            backgroundColor: '#4CAF50',
            color: 'white',
            padding: '12px 24px',
            border: 'none',
            borderRadius: '4px',
            fontSize: '16px',
            cursor: 'pointer',
            marginRight: '10px'
          }}
        >
          Ir a Login Real
        </button>
        <button
          onClick={clearLogs}
          style={{
            backgroundColor: '#666',
            color: 'white',
            padding: '12px 24px',
            border: 'none',
            borderRadius: '4px',
            fontSize: '16px',
            cursor: 'pointer'
          }}
        >
          Limpiar Logs
        </button>
      </div>

      <div style={{ marginTop: '20px' }}>
        <h3>📋 Logs de Debug ({logs.length})</h3>
        <div style={{ 
          height: '400px', 
          overflowY: 'auto', 
          border: '1px solid #ddd', 
          borderRadius: '4px',
          backgroundColor: '#f9f9f9',
          padding: '10px'
        }}>
          {logs.length === 0 ? (
            <p style={{ color: '#666', fontStyle: 'italic' }}>No hay logs aún. Presiona "Probar Login" para comenzar.</p>
          ) : (
            logs.map((log, index) => (
              <div key={index} style={getLogStyle(log.type)}>
                <span style={{ color: '#666', fontSize: '10px' }}>[{log.timestamp}]</span> {log.message}
              </div>
            ))
          )}
        </div>
      </div>

      <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#fff3cd', borderRadius: '4px' }}>
        <h4>💡 Instrucciones:</h4>
        <ol>
          <li>Presiona "Probar Login" para ejecutar el test</li>
          <li>Observa los logs que aparecen abajo</li>
          <li>Si hay errores, aparecerán en rojo</li>
          <li>Comparte conmigo qué mensajes aparecen</li>
        </ol>
      </div>
    </div>
  );
};

export default DebugLogin;
