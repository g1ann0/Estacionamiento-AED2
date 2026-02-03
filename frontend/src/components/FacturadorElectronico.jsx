import React, { useState, useEffect } from 'react';
import { facturaElectronicaService } from '../services/facturaElectronicaService';
import { comprobanteService } from '../services/comprobanteService';
import '../styles/facturador.css';

const FacturadorElectronico = ({ onMensaje }) => {
  const [loading, setLoading] = useState(false);
  const [estadoAFIP, setEstadoAFIP] = useState(null);
  const [comprobantesAprobados, setComprobantesAprobados] = useState([]);
  const [comprobanteSeleccionado, setComprobanteSeleccionado] = useState(null);
  const [puntosVenta, setPuntosVenta] = useState([]);
  const [tiposComprobante, setTiposComprobante] = useState([]);
  
  const [formData, setFormData] = useState({
    comprobanteId: '',
    tipoComprobante: '',
    puntoVenta: 1,
    observaciones: ''
  });

  // Cargar datos iniciales
  useEffect(() => {
    cargarDatosIniciales();
  }, []);

  const cargarDatosIniciales = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');

      // Verificar estado AFIP
      const estadoResponse = await facturaElectronicaService.verificarEstadoAFIP(token);
      setEstadoAFIP(estadoResponse.afip);

      // Obtener comprobantes aprobados sin facturar
      const comprobantesResponse = await comprobanteService.obtenerComprobantesPendientes(token);
      const sinFacturar = (comprobantesResponse.comprobantes || []).filter(
        c => c.estado === 'aprobado' && !c.facturaGenerada
      );
      setComprobantesAprobados(sinFacturar);

      // Obtener puntos de venta
      const puntosResponse = await facturaElectronicaService.obtenerPuntosVenta(token);
      setPuntosVenta(puntosResponse.puntosVenta || []);

      // Obtener tipos de comprobante
      const tiposResponse = await facturaElectronicaService.obtenerTiposComprobante(token);
      setTiposComprobante(tiposResponse.tipos || []);

    } catch (error) {
      console.error('Error al cargar datos:', error);
      onMensaje({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

  // Seleccionar comprobante
  const seleccionarComprobante = (comprobante) => {
    setComprobanteSeleccionado(comprobante);
    setFormData({
      ...formData,
      comprobanteId: comprobante._id,
      // Determinar tipo de comprobante según condición IVA
      // 82: Tique Factura B (para Monotributistas/Consumidor Final)
      // 81: Tique Factura A (para Responsables Inscriptos)
      tipoComprobante: '82' // Por defecto Tique Factura B
    });
  };

  // Manejar cambios en el formulario
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  // Generar factura electrónica
  const generarFactura = async (e) => {
    e.preventDefault();

    if (!formData.comprobanteId) {
      onMensaje({ type: 'error', text: 'Debe seleccionar un comprobante' });
      return;
    }

    if (!formData.tipoComprobante) {
      onMensaje({ type: 'error', text: 'Debe seleccionar el tipo de comprobante' });
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      
      const response = await facturaElectronicaService.crearFacturaElectronica({
        comprobanteId: formData.comprobanteId,
        tipoComprobante: parseInt(formData.tipoComprobante),
        puntoVenta: parseInt(formData.puntoVenta),
        observaciones: formData.observaciones
      }, token);

      onMensaje({ 
        type: 'success', 
        text: `✅ Factura electrónica generada exitosamente\nCAE: ${response.factura.cae}\nNro: ${response.factura.nroFactura}` 
      });

      // Limpiar formulario y recargar comprobantes
      setFormData({
        comprobanteId: '',
        tipoComprobante: '',
        puntoVenta: 1,
        observaciones: ''
      });
      setComprobanteSeleccionado(null);
      cargarDatosIniciales();

    } catch (error) {
      console.error('Error al generar factura:', error);
      onMensaje({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

  // Formatear moneda
  const formatearMoneda = (valor) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(valor);
  };

  // Formatear fecha
  const formatearFecha = (fecha) => {
    return new Date(fecha).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="facturador-electronico">
      <div className="facturador-header">
        <h2>📄 Facturador Electrónico AFIP</h2>
        
        {/* Estado AFIP */}
        {estadoAFIP && (
          <div className={`afip-status ${estadoAFIP.online ? 'online' : 'offline'}`}>
            <span className="status-indicator"></span>
            <span className="status-text">
              {estadoAFIP.online ? '✅ AFIP Online' : '❌ AFIP Offline'}
            </span>
            {estadoAFIP.online && (
              <small>
                App: {estadoAFIP.appServer} | 
                DB: {estadoAFIP.dbServer} | 
                Auth: {estadoAFIP.authServer}
              </small>
            )}
          </div>
        )}
      </div>

      <div className="facturador-content">
        {/* Panel izquierdo: Comprobantes pendientes */}
        <div className="comprobantes-panel">
          <h3>Comprobantes Aprobados sin Facturar</h3>
          
          {loading ? (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Cargando comprobantes...</p>
            </div>
          ) : comprobantesAprobados.length === 0 ? (
            <div className="empty-state">
              <p>✅ No hay comprobantes pendientes de facturación</p>
            </div>
          ) : (
            <div className="comprobantes-lista">
              {comprobantesAprobados.map(comprobante => (
                <div
                  key={comprobante._id}
                  className={`comprobante-item ${comprobanteSeleccionado?._id === comprobante._id ? 'selected' : ''}`}
                  onClick={() => seleccionarComprobante(comprobante)}
                >
                  <div className="comprobante-header">
                    <span className="comprobante-numero">{comprobante.nroComprobante}</span>
                    <span className="comprobante-monto">{formatearMoneda(comprobante.importe)}</span>
                  </div>
                  <div className="comprobante-details">
                    <p><strong>Usuario:</strong> {comprobante.usuarioId?.nombre || 'N/A'}</p>
                    <p><strong>Vehículo:</strong> {comprobante.vehiculoId?.patente || 'N/A'}</p>
                    <p><strong>Fecha:</strong> {formatearFecha(comprobante.fechaEmision)}</p>
                  </div>
                  <div className="comprobante-footer">
                    <span className="estado-badge estado-aprobado">Aprobado</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Panel derecho: Formulario de facturación */}
        <div className="formulario-panel">
          <h3>Generar Factura Electrónica</h3>
          
          {!comprobanteSeleccionado ? (
            <div className="empty-state">
              <p>👈 Seleccione un comprobante de la lista para facturar</p>
            </div>
          ) : (
            <form onSubmit={generarFactura} className="factura-form">
              {/* Resumen del comprobante */}
              <div className="comprobante-resumen">
                <h4>Comprobante Seleccionado</h4>
                <div className="resumen-grid">
                  <div className="resumen-item">
                    <label>Número:</label>
                    <span>{comprobanteSeleccionado.nroComprobante}</span>
                  </div>
                  <div className="resumen-item">
                    <label>Importe:</label>
                    <span className="importe-destacado">
                      {formatearMoneda(comprobanteSeleccionado.importe)}
                    </span>
                  </div>
                  <div className="resumen-item">
                    <label>Usuario:</label>
                    <span>{comprobanteSeleccionado.usuarioId?.nombre}</span>
                  </div>
                  <div className="resumen-item">
                    <label>CUIT:</label>
                    <span>{comprobanteSeleccionado.usuarioId?.cuit || 'No informado'}</span>
                  </div>
                  <div className="resumen-item">
                    <label>Vehículo:</label>
                    <span>{comprobanteSeleccionado.vehiculoId?.patente}</span>
                  </div>
                  <div className="resumen-item">
                    <label>Fecha:</label>
                    <span>{formatearFecha(comprobanteSeleccionado.fechaEmision)}</span>
                  </div>
                </div>
              </div>

              {/* Configuración de factura */}
              <div className="form-group">
                <label htmlFor="tipoComprobante">Tipo de Comprobante *</label>
                <select
                  id="tipoComprobante"
                  name="tipoComprobante"
                  value={formData.tipoComprobante}
                  onChange={handleChange}
                  required
                >
                  <option value="">Seleccionar tipo...</option>
                  <option value="82">82 - Tique Factura B (Consumidor Final)</option>
                  <option value="81">81 - Tique Factura A (Resp. Inscripto)</option>
                  <option value="11">11 - Factura C</option>
                  <option value="6">6 - Factura B</option>
                  <option value="1">1 - Factura A</option>
                </select>
                <small className="form-help">
                  Seleccione el tipo según la condición de IVA del cliente
                </small>
              </div>

              <div className="form-group">
                <label htmlFor="puntoVenta">Punto de Venta *</label>
                <select
                  id="puntoVenta"
                  name="puntoVenta"
                  value={formData.puntoVenta}
                  onChange={handleChange}
                  required
                >
                  {puntosVenta.length > 0 ? (
                    puntosVenta.map(pv => (
                      <option key={pv.numero} value={pv.numero}>
                        {pv.numero} - {pv.descripcion || 'Punto de Venta'}
                      </option>
                    ))
                  ) : (
                    <option value="1">1 - Punto de Venta Principal</option>
                  )}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="observaciones">Observaciones</label>
                <textarea
                  id="observaciones"
                  name="observaciones"
                  value={formData.observaciones}
                  onChange={handleChange}
                  rows="3"
                  placeholder="Observaciones adicionales (opcional)"
                />
              </div>

              {/* Botones de acción */}
              <div className="form-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setComprobanteSeleccionado(null);
                    setFormData({
                      comprobanteId: '',
                      tipoComprobante: '',
                      puntoVenta: 1,
                      observaciones: ''
                    });
                  }}
                  disabled={loading}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading || !estadoAFIP?.online}
                >
                  {loading ? (
                    <>
                      <span className="spinner-small"></span>
                      Generando...
                    </>
                  ) : (
                    <>
                      📄 Generar Factura Electrónica
                    </>
                  )}
                </button>
              </div>

              {!estadoAFIP?.online && (
                <div className="alert alert-warning">
                  ⚠️ AFIP no está disponible en este momento. Por favor, intente más tarde.
                </div>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default FacturadorElectronico;
