/**
 * MODAL DE BÚSQUEDA DE CUIT EN AFIP/ARCA
 * 
 * Componente reutilizable para consultar datos fiscales automáticamente
 * Uso: Integrar en formularios de clientes para autocompletar datos
 */

import React, { useState } from 'react';
import { consultarCUIT } from '../services/afipService';
import '../styles/ConsultaCUITModal.css';

const ConsultaCUITModal = ({ isOpen, onClose, onDatosObtenidos }) => {
  const [cuit, setCuit] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);
  const [resultado, setResultado] = useState(null);

  /**
   * Formatea CUIT mientras el usuario escribe (XX-XXXXXXXX-X)
   */
  const formatearCUIT = (valor) => {
    // Remover todo excepto números
    const numeros = valor.replace(/\D/g, '');
    
    // Limitar a 11 dígitos
    const limitado = numeros.slice(0, 11);
    
    // Formatear con guiones
    if (limitado.length <= 2) {
      return limitado;
    } else if (limitado.length <= 10) {
      return `${limitado.slice(0, 2)}-${limitado.slice(2)}`;
    } else {
      return `${limitado.slice(0, 2)}-${limitado.slice(2, 10)}-${limitado.slice(10)}`;
    }
  };

  /**
   * Maneja el cambio en el input de CUIT
   */
  const handleCuitChange = (e) => {
    const valorFormateado = formatearCUIT(e.target.value);
    setCuit(valorFormateado);
    setError(null);
    setResultado(null);
  };

  /**
   * Consulta el CUIT en AFIP
   */
  const handleConsultar = async () => {
    // Validar que tenga 11 dígitos
    const soloNumeros = cuit.replace(/\D/g, '');
    if (soloNumeros.length !== 11) {
      setError('El CUIT debe tener 11 dígitos');
      return;
    }

    setCargando(true);
    setError(null);
    setResultado(null);

    try {
      const respuesta = await consultarCUIT(cuit);

      if (respuesta.success) {
        setResultado(respuesta.data);
      } else {
        setError(respuesta.error || 'No se encontró el CUIT en AFIP');
      }
    } catch (err) {
      console.error('Error al consultar CUIT:', err);
      setError(err.error || 'Error al conectar con AFIP. Intente nuevamente.');
    } finally {
      setCargando(false);
    }
  };

  /**
   * Usa los datos obtenidos
   */
  const handleUsarDatos = () => {
    if (resultado && onDatosObtenidos) {
      onDatosObtenidos(resultado);
      handleCerrar();
    }
  };

  /**
   * Cierra el modal y limpia el estado
   */
  const handleCerrar = () => {
    setCuit('');
    setError(null);
    setResultado(null);
    setCargando(false);
    onClose();
  };

  /**
   * Maneja Enter en el input
   */
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !cargando) {
      handleConsultar();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleCerrar}>
      <div className="modal-content consulta-cuit-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>🔍 Buscar en AFIP/ARCA</h2>
          <button className="modal-close" onClick={handleCerrar}>×</button>
        </div>

        <div className="modal-body">
          <p className="modal-descripcion">
            Ingrese el CUIT del contribuyente para obtener automáticamente sus datos fiscales
          </p>

          <div className="consulta-cuit-input-group">
            <label htmlFor="cuit-input">CUIT</label>
            <div className="input-with-button">
              <input
                id="cuit-input"
                type="text"
                value={cuit}
                onChange={handleCuitChange}
                onKeyPress={handleKeyPress}
                placeholder="20-12345678-9"
                maxLength={13}
                disabled={cargando}
                autoFocus
              />
              <button
                onClick={handleConsultar}
                disabled={cargando || cuit.replace(/\D/g, '').length !== 11}
                className="btn-consultar"
              >
                {cargando ? '⏳ Consultando...' : '🔍 Buscar'}
              </button>
            </div>
            <small className="input-help">
              Formato: XX-XXXXXXXX-X (11 dígitos)
            </small>
          </div>

          {/* Error */}
          {error && (
            <div className="consulta-cuit-error">
              <span className="error-icon">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {/* Resultado */}
          {resultado && (
            <div className="consulta-cuit-resultado">
              <div className="resultado-header">
                <span className="success-icon">✅</span>
                <h3>Datos encontrados</h3>
              </div>

              <div className="resultado-datos">
                <div className="dato-item">
                  <strong>CUIT:</strong>
                  <span>{resultado.cuit}</span>
                </div>

                {resultado.razonSocial && (
                  <div className="dato-item">
                    <strong>Razón Social:</strong>
                    <span>{resultado.razonSocial}</span>
                  </div>
                )}

                {resultado.condicionIVA && (
                  <div className="dato-item">
                    <strong>Condición IVA:</strong>
                    <span className="badge-iva">{resultado.condicionIVA}</span>
                  </div>
                )}

                {resultado.domicilioFiscal && (
                  <div className="dato-item">
                    <strong>Domicilio Fiscal:</strong>
                    <span>{resultado.domicilioFiscal}</span>
                  </div>
                )}

                {resultado.localidad && (
                  <div className="dato-item">
                    <strong>Localidad:</strong>
                    <span>{resultado.localidad}</span>
                  </div>
                )}

                {resultado.provincia && (
                  <div className="dato-item">
                    <strong>Provincia:</strong>
                    <span>{resultado.provincia}</span>
                  </div>
                )}

                {resultado.codigoPostal && (
                  <div className="dato-item">
                    <strong>Código Postal:</strong>
                    <span>{resultado.codigoPostal}</span>
                  </div>
                )}

                {resultado.estado && (
                  <div className="dato-item">
                    <strong>Estado:</strong>
                    <span className={`badge-estado ${resultado.estado === 'Activo' ? 'activo' : ''}`}>
                      {resultado.estado}
                    </span>
                  </div>
                )}

                {resultado.actividades && resultado.actividades.length > 0 && (
                  <div className="dato-item actividades">
                    <strong>Actividades:</strong>
                    <div className="actividades-list">
                      {resultado.actividades.slice(0, 3).map((act, index) => (
                        <div key={index} className="actividad-item">
                          <span className="actividad-codigo">{act.codigo}</span>
                          <span className="actividad-desc">{act.descripcion}</span>
                        </div>
                      ))}
                      {resultado.actividades.length > 3 && (
                        <small className="actividades-more">
                          +{resultado.actividades.length - 3} más
                        </small>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="resultado-acciones">
                <button onClick={handleUsarDatos} className="btn-usar-datos">
                  ✅ Usar estos datos
                </button>
              </div>
            </div>
          )}
        </div>

        {!resultado && (
          <div className="modal-footer">
            <button onClick={handleCerrar} className="btn-cancelar">
              Cancelar
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ConsultaCUITModal;
