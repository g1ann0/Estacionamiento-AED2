import React, { useState, useEffect } from 'react';
import CONFIG from '../config/config.js';

const NetworkDiagnostic = () => {
  const [diagnostics, setDiagnostics] = useState({
    hostname: '',
    url: '',
    backendUrl: '',
    apiUrl: '',
    backendTest: 'Pendiente...',
    apiTest: 'Pendiente...'
  });

  useEffect(() => {
    const runDiagnostics = async () => {
      const hostname = window.location.hostname;
      const url = window.location.href;
      const backendUrl = CONFIG.BACKEND_URL;
      const apiUrl = CONFIG.API_BASE_URL;

      setDiagnostics(prev => ({
        ...prev,
        hostname,
        url,
        backendUrl,
        apiUrl
      }));

      // Test backend
      try {
        const backendResponse = await fetch(backendUrl);
        const backendText = await backendResponse.text();
        setDiagnostics(prev => ({
          ...prev,
          backendTest: `✅ OK: ${backendText}`
        }));
      } catch (error) {
        setDiagnostics(prev => ({
          ...prev,
          backendTest: `❌ Error: ${error.message}`
        }));
      }

      // Test API
      try {
        const apiResponse = await fetch(`${apiUrl}/auth/verificar`);
        const apiData = await apiResponse.json();
        setDiagnostics(prev => ({
          ...prev,
          apiTest: `✅ OK: ${JSON.stringify(apiData)}`
        }));
      } catch (error) {
        setDiagnostics(prev => ({
          ...prev,
          apiTest: `❌ Error: ${error.message}`
        }));
      }
    };

    runDiagnostics();
  }, []);

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace', fontSize: '12px' }}>
      <h2>🔧 Diagnóstico de Red</h2>
      <div style={{ background: '#f0f0f0', padding: '15px', marginBottom: '10px' }}>
        <strong>Información del Cliente:</strong><br/>
        Hostname: {diagnostics.hostname}<br/>
        URL Actual: {diagnostics.url}<br/>
        User Agent: {navigator.userAgent}
      </div>
      
      <div style={{ background: '#e8f4f8', padding: '15px', marginBottom: '10px' }}>
        <strong>Configuración del Sistema:</strong><br/>
        Backend URL: {diagnostics.backendUrl}<br/>
        API URL: {diagnostics.apiUrl}
      </div>

      <div style={{ background: '#f8f8e8', padding: '15px', marginBottom: '10px' }}>
        <strong>Test de Conectividad:</strong><br/>
        Backend: {diagnostics.backendTest}<br/>
        API: {diagnostics.apiTest}
      </div>

      <div style={{ background: '#f0f8f0', padding: '15px' }}>
        <strong>Instrucciones:</strong><br/>
        1. Si ves ❌ en Backend o API, hay problema de conectividad<br/>
        2. Si ves ✅ en ambos, el problema está en la aplicación React<br/>
        3. Comparte esta información para más ayuda
      </div>
    </div>
  );
};

export default NetworkDiagnostic;
