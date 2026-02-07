import React, { useState, useEffect } from 'react';
import { configuracionEmpresaService } from '../services/configuracionEmpresaService';

const ConfiguracionEmpresa = ({ onMensaje }) => {
  const [configuracion, setConfiguracion] = useState({
    razonSocial: '',
    cuit: '',
    inicioActividades: '',
    domicilio: {
      calle: '',
      numero: '',
      piso: '',
      departamento: '',
      localidad: '',
      provincia: '',
      codigoPostal: ''
    },
    condicionIva: 'Responsable Monotributo',
    puntoVenta: 1,
    contacto: {
      telefono: '',
      email: '',
      sitioWeb: ''
    },
    numeracion: {
      proximoNumero: 1,
      reinicioAnual: false
    }
  });

  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [validacion, setValidacion] = useState(null);
  const [tabActiva, setTabActiva] = useState('general');

  const condicionesIva = [
    'IVA Responsable Inscripto',
    'IVA Responsable no Inscripto',
    'IVA no Responsable',
    'IVA Sujeto Exento',
    'Consumidor Final',
    'Responsable Monotributo',
    'Sujeto no Categorizado'
  ];

  const provincias = [
    'Buenos Aires', 'Catamarca', 'Chaco', 'Chubut', 'Córdoba', 'Corrientes',
    'Entre Ríos', 'Formosa', 'Jujuy', 'La Pampa', 'La Rioja', 'Mendoza',
    'Misiones', 'Neuquén', 'Río Negro', 'Salta', 'San Juan', 'San Luis',
    'Santa Cruz', 'Santa Fe', 'Santiago del Estero', 'Tierra del Fuego',
    'Tucumán', 'CABA'
  ];

  useEffect(() => {
    cargarConfiguracion();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const cargarConfiguracion = async () => {
    try {
      setCargando(true);
      const token = localStorage.getItem('token');
      const response = await configuracionEmpresaService.obtenerConfiguracion(token);
      if (response.success) {
        // Formatear fecha para el input
        const configConFecha = {
          ...response.configuracion,
          inicioActividades: response.configuracion.inicioActividades 
            ? new Date(response.configuracion.inicioActividades).toISOString().split('T')[0]
            : ''
        };
        
        if (response.configuracion.arca?.certificadoDigital?.fechaVencimiento) {
          configConFecha.arca.certificadoDigital.fechaVencimiento = 
            new Date(response.configuracion.arca.certificadoDigital.fechaVencimiento).toISOString().split('T')[0];
        }
        
        // Fusionar con el estado inicial para asegurar que todas las propiedades existan
        setConfiguracion(prevState => ({
          ...prevState,
          ...configConFecha,
          domicilio: {
            ...prevState.domicilio,
            ...configConFecha.domicilio
          },
          contacto: {
            ...prevState.contacto,
            ...configConFecha.contacto
          },
          numeracion: {
            ...prevState.numeracion,
            ...configConFecha.numeracion
          }
        }));
      }
    } catch (error) {
      onMensaje({ type: 'error', text: error.message });
    } finally {
      setCargando(false);
    }
  };

  const validarConfiguracion = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await configuracionEmpresaService.validarConfiguracion(token);
      setValidacion(response);
      
      if (response.errores && response.errores.length > 0) {
        onMensaje({ 
          type: 'warning', 
          text: `Configuración incompleta: ${response.errores.join(', ')}` 
        });
      } else {
        onMensaje({ type: 'success', text: 'Configuración válida para facturación' });
      }
    } catch (error) {
      onMensaje({ type: 'error', text: error.message });
    }
  };

  const guardarConfiguracion = async () => {
    try {
      setGuardando(true);
      const token = localStorage.getItem('token');
      const response = await configuracionEmpresaService.actualizarConfiguracion(configuracion, token);
      
      if (response.success) {
        onMensaje({ type: 'success', text: 'Configuración guardada correctamente' });
        await cargarConfiguracion();
        await validarConfiguracion();
      }
    } catch (error) {
      onMensaje({ type: 'error', text: error.message });
    } finally {
      setGuardando(false);
    }
  };

  const handleInputChange = (campo, valor, subCampo = null) => {
    setConfiguracion(prev => {
      if (subCampo) {
        return {
          ...prev,
          [campo]: {
            ...prev[campo],
            [subCampo]: valor
          }
        };
      } else {
        return {
          ...prev,
          [campo]: valor
        };
      }
    });
  };

  const formatearCuit = (valor) => {
    // Remover todo excepto números
    const numeros = valor.replace(/\D/g, '');
    
    // Formatear como XX-XXXXXXXX-X
    if (numeros.length <= 2) {
      return numeros;
    } else if (numeros.length <= 10) {
      return `${numeros.slice(0, 2)}-${numeros.slice(2)}`;
    } else {
      return `${numeros.slice(0, 2)}-${numeros.slice(2, 10)}-${numeros.slice(10, 11)}`;
    }
  };

  if (cargando) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Cargando configuración...</p>
      </div>
    );
  }

  return (
    <div className="configuracion-empresa">
      <div className="listado-header">
        <div>
          <h2>⚙️ Configuración de Empresa</h2>
          <p>Configura los datos de tu empresa según regulaciones ARCA</p>
        </div>
        <div className="header-actions">
          <button 
            onClick={validarConfiguracion}
            className="btn btn-secondary"
            style={{ 
              marginRight: '10px',
              backgroundColor: '#6c757d',
              color: 'white',
              border: '1px solid #6c757d',
              padding: '0.75rem 1.5rem',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold',
              transition: 'all 0.2s ease'
            }}
          >
            🔍 Validar Configuración
          </button>
          <button 
            onClick={guardarConfiguracion}
            disabled={guardando}
            className="btn btn-primary"
            style={{
              backgroundColor: guardando ? '#6c757d' : '#007bff',
              color: 'white',
              border: `1px solid ${guardando ? '#6c757d' : '#007bff'}`,
              padding: '0.75rem 1.5rem',
              borderRadius: '4px',
              cursor: guardando ? 'not-allowed' : 'pointer',
              fontWeight: 'bold',
              transition: 'all 0.2s ease',
              opacity: guardando ? 0.6 : 1
            }}
          >
            {guardando ? '💾 Guardando...' : '💾 Guardar Configuración'}
          </button>
        </div>
      </div>

      {/* Validación Status */}
      {validacion && (
        <div className={`alert ${validacion.esValida ? 'alert-success' : 'alert-warning'}`}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '18px', marginRight: '8px' }}>
              {validacion.esValida ? '✅' : '⚠️'}
            </span>
            <strong>
              {validacion.esValida ? 'Configuración válida' : 'Configuración incompleta'}
            </strong>
          </div>
          
          {validacion.errores && validacion.errores.length > 0 && (
            <div>
              <strong>Errores:</strong>
              <ul style={{ margin: '5px 0', paddingLeft: '20px' }}>
                {validacion.errores.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          )}
          
          {validacion.advertencias && validacion.advertencias.length > 0 && (
            <div>
              <strong>Advertencias:</strong>
              <ul style={{ margin: '5px 0', paddingLeft: '20px' }}>
                {validacion.advertencias.map((advertencia, index) => (
                  <li key={index}>{advertencia}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="tabs">
        <button 
          className={`tab ${tabActiva === 'general' ? 'active' : ''}`}
          onClick={() => setTabActiva('general')}
        >
          📋 Datos Generales
        </button>
        <button 
          className={`tab ${tabActiva === 'domicilio' ? 'active' : ''}`}
          onClick={() => setTabActiva('domicilio')}
        >
          🏢 Domicilio Fiscal
        </button>
        <button 
          className={`tab ${tabActiva === 'contacto' ? 'active' : ''}`}
          onClick={() => setTabActiva('contacto')}
        >
          📞 Contacto
        </button>
        <button 
          className={`tab ${tabActiva === 'numeracion' ? 'active' : ''}`}
          onClick={() => setTabActiva('numeracion')}
        >
          🔢 Punto de Venta y Numeración
        </button>
      </div>

      <div className="tab-content">
        {/* Tab: Datos Generales */}
        {tabActiva === 'general' && (
          <div className="form-section">
            <h3>Datos Generales de la Empresa</h3>
            
            <div className="form-row">
              <div className="form-group">
                <label>Razón Social *</label>
                <input
                  type="text"
                  value={configuracion.razonSocial}
                  onChange={(e) => handleInputChange('razonSocial', e.target.value)}
                  placeholder="Nombre completo de la empresa"
                  required
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>CUIT *</label>
                <input
                  type="text"
                  value={configuracion.cuit}
                  onChange={(e) => handleInputChange('cuit', formatearCuit(e.target.value))}
                  placeholder="XX-XXXXXXXX-X"
                  maxLength="13"
                  required
                />
                <small>Formato: XX-XXXXXXXX-X</small>
              </div>
              
              <div className="form-group">
                <label>Inicio de Actividades *</label>
                <input
                  type="date"
                  value={configuracion.inicioActividades}
                  onChange={(e) => handleInputChange('inicioActividades', e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Condición IVA *</label>
                <select
                  value={configuracion.condicionIva}
                  onChange={(e) => handleInputChange('condicionIva', e.target.value)}
                  required
                >
                  {condicionesIva.map(condicion => (
                    <option key={condicion} value={condicion}>
                      {condicion}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="form-group">
                <label>Punto de Venta *</label>
                <input
                  type="text"
                  value={configuracion.puntoVenta}
                  onChange={(e) => handleInputChange('puntoVenta', e.target.value.replace(/\D/g, '').padStart(5, '0').slice(0, 5))}
                  placeholder="00001"
                  maxLength="5"
                  required
                />
                <small>5 dígitos numéricos</small>
              </div>
            </div>
          </div>
        )}

        {/* Tab: Domicilio Fiscal */}
        {tabActiva === 'domicilio' && (
          <div className="form-section">
            <h3>Domicilio Fiscal</h3>
            
            <div className="form-row">
              <div className="form-group" style={{ flex: 2 }}>
                <label>Calle *</label>
                <input
                  type="text"
                  value={configuracion.domicilio.calle}
                  onChange={(e) => handleInputChange('domicilio', e.target.value, 'calle')}
                  placeholder="Av. Corrientes"
                  required
                />
              </div>
              
              <div className="form-group">
                <label>Número *</label>
                <input
                  type="text"
                  value={configuracion.domicilio.numero}
                  onChange={(e) => handleInputChange('domicilio', e.target.value, 'numero')}
                  placeholder="1234"
                  required
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Piso</label>
                <input
                  type="text"
                  value={configuracion.domicilio.piso}
                  onChange={(e) => handleInputChange('domicilio', e.target.value, 'piso')}
                  placeholder="5"
                />
              </div>
              
              <div className="form-group">
                <label>Departamento</label>
                <input
                  type="text"
                  value={configuracion.domicilio.departamento}
                  onChange={(e) => handleInputChange('domicilio', e.target.value, 'departamento')}
                  placeholder="A"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Localidad *</label>
                <input
                  type="text"
                  value={configuracion.domicilio.localidad}
                  onChange={(e) => handleInputChange('domicilio', e.target.value, 'localidad')}
                  placeholder="Buenos Aires"
                  required
                />
              </div>
              
              <div className="form-group">
                <label>Provincia *</label>
                <select
                  value={configuracion.domicilio.provincia}
                  onChange={(e) => handleInputChange('domicilio', e.target.value, 'provincia')}
                  required
                >
                  <option value="">Seleccionar provincia</option>
                  {provincias.map(provincia => (
                    <option key={provincia} value={provincia}>
                      {provincia}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="form-group">
                <label>Código Postal *</label>
                <input
                  type="text"
                  value={configuracion.domicilio.codigoPostal}
                  onChange={(e) => handleInputChange('domicilio', e.target.value, 'codigoPostal')}
                  placeholder="1000"
                  required
                />
              </div>
            </div>
          </div>
        )}

        {/* Tab: Contacto */}
        {tabActiva === 'contacto' && (
          <div className="form-section">
            <h3>Información de Contacto</h3>
            
            <div className="form-row">
              <div className="form-group">
                <label>Teléfono</label>
                <input
                  type="tel"
                  value={configuracion.contacto.telefono}
                  onChange={(e) => handleInputChange('contacto', e.target.value, 'telefono')}
                  placeholder="+54 11 1234-5678"
                />
              </div>
              
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={configuracion.contacto.email}
                  onChange={(e) => handleInputChange('contacto', e.target.value, 'email')}
                  placeholder="info@empresa.com"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Sitio Web</label>
                <input
                  type="url"
                  value={configuracion.contacto.sitioWeb}
                  onChange={(e) => handleInputChange('contacto', e.target.value, 'sitioWeb')}
                  placeholder="https://www.empresa.com"
                />
              </div>
            </div>
          </div>
        )}

        {/* Tab: Numeración */}
        {tabActiva === 'numeracion' && (
          <div className="form-section">
            <h3>Punto de Venta y Numeración</h3>
            
            <div className="alert alert-info" style={{ marginBottom: '20px' }}>
              <strong>ℹ️ Información:</strong> Configurá el punto de venta (terminal) y la numeración de comprobantes.
              Solo modificá estos valores si necesitás corregir un error o cambiar de punto de venta.
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Punto de Venta *</label>
                <input
                  type="number"
                  value={configuracion.puntoVenta}
                  onChange={(e) => setConfiguracion({ ...configuracion, puntoVenta: parseInt(e.target.value) || 1 })}
                  min="1"
                  max="99999"
                  required
                />
                <small>Número de terminal o sucursal (1-99999). Se mostrará con 5 dígitos: {String(configuracion.puntoVenta).padStart(5, '0')}</small>
              </div>

              <div className="form-group">
                <label>Próximo Número de Comprobante</label>
                <input
                  type="number"
                  value={configuracion.numeracion.proximoNumero}
                  onChange={(e) => handleInputChange('numeracion', parseInt(e.target.value) || 1, 'proximoNumero')}
                  min="1"
                />
                <small>⚠️ Solo modificar si hay un error en la numeración. El sistema incrementa automáticamente.</small>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="checkbox"
                    checked={configuracion.numeracion.reinicioAnual}
                    onChange={(e) => handleInputChange('numeracion', e.target.checked, 'reinicioAnual')}
                  />
                  Reinicio anual de numeración
                </label>
                <small>La numeración se reinicia cada año calendario</small>
              </div>
            </div>

            <div className="preview-numeracion">
              <h4>Vista Previa de Numeración</h4>
              <div className="numero-preview">
                <strong>
                  {configuracion.puntoVenta}-{configuracion.numeracion.proximoNumero.toString().padStart(8, '0')}
                </strong>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ConfiguracionEmpresa;
