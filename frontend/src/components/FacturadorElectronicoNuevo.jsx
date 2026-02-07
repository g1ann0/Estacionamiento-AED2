import React, { useState, useEffect, useCallback } from 'react';
import { facturadorService } from '../services/facturadorService';
import '../styles/facturador-nuevo.css';

const FacturadorElectronicoNuevo = ({ onMensaje }) => {
  const [loading, setLoading] = useState(false);
  const [vistaActual, setVistaActual] = useState('emitir'); // 'emitir' | 'anular' | 'historial'
  
  // Estados para emisión
  const [comprobantesAprobados, setComprobantesAprobados] = useState([]);
  const [comprobanteSeleccionado, setComprobanteSeleccionado] = useState(null);
  const [filtroEmision, setFiltroEmision] = useState('');
  
  // Estados para anulación (notas de crédito)
  const [facturasEmitidas, setFacturasEmitidas] = useState([]);
  const [facturaParaAnular, setFacturaParaAnular] = useState(null);
  const [motivoAnulacion, setMotivoAnulacion] = useState('');
  const [filtroAnulacion, setFiltroAnulacion] = useState('');
  
  // Estados para historial
  const [historialCompleto, setHistorialCompleto] = useState([]);
  const [filtroHistorial, setFiltroHistorial] = useState('');
  const [tipoFiltroHistorial, setTipoFiltroHistorial] = useState('todos'); // 'todos' | 'facturas' | 'notas_credito'
  
  const [formDataEmision, setFormDataEmision] = useState({
    tipoFactura: 'B',
    cuit: '',
    condicionIVA: 'Consumidor Final',
    observaciones: ''
  });

  // Cargar datos según la vista actual
  const cargarDatos = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      
      if (vistaActual === 'emitir') {
        const response = await facturadorService.obtenerComprobantesAprobados(token);
        setComprobantesAprobados(response.comprobantes || []);
      } else if (vistaActual === 'anular') {
        const response = await facturadorService.obtenerFacturasAnulables(token);
        setFacturasEmitidas(response.facturas || []);
      } else if (vistaActual === 'historial') {
        const response = await facturadorService.obtenerHistorialCompleto(token);
        setHistorialCompleto(response.historial || []);
      }
    } catch (error) {
      console.error('Error al cargar datos:', error);
      onMensaje({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  }, [vistaActual, onMensaje]);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  // FUNCIONES PARA EMISIÓN DE FACTURAS
  const seleccionarComprobante = (comprobante) => {
    setComprobanteSeleccionado(comprobante);
  };

  const handleChangeEmision = (e) => {
    const { name, value } = e.target;
    setFormDataEmision({
      ...formDataEmision,
      [name]: value
    });
  };

  const generarFactura = async (e) => {
    e.preventDefault();

    if (!comprobanteSeleccionado) {
      onMensaje({ type: 'error', text: 'Debe seleccionar un comprobante' });
      return;
    }

    if (formDataEmision.tipoFactura === 'A' && !formDataEmision.cuit) {
      onMensaje({ type: 'error', text: 'Para Factura A debe ingresar el CUIT' });
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      
      const response = await facturadorService.generarFactura({
        nroComprobante: comprobanteSeleccionado.nroComprobante,
        tipoFactura: formDataEmision.tipoFactura,
        cuit: formDataEmision.cuit || null,
        condicionIVA: formDataEmision.condicionIVA,
        observaciones: formDataEmision.observaciones
      }, token);

      onMensaje({ 
        type: 'success', 
        text: `✅ Factura ${response.factura.nroFactura} generada\nCAE: ${response.factura.cae}` 
      });

      // Resetear formulario
      setFormDataEmision({
        tipoFactura: 'B',
        cuit: '',
        condicionIVA: 'Consumidor Final',
        observaciones: ''
      });
      setComprobanteSeleccionado(null);
      cargarDatos();

    } catch (error) {
      console.error('Error al generar factura:', error);
      onMensaje({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

  // FUNCIONES PARA ANULACIÓN (NOTAS DE CRÉDITO)
  const seleccionarFacturaParaAnular = (factura) => {
    const fechaEmision = new Date(factura.fechaEmision);
    const hoy = new Date();
    const diasTranscurridos = Math.floor((hoy - fechaEmision) / (1000 * 60 * 60 * 24));
    
    if (diasTranscurridos > 15) {
      onMensaje({ 
        type: 'error', 
        text: `❌ No se puede anular. Han transcurrido ${diasTranscurridos} días.\nSegún normativa ARCA, solo se pueden anular facturas con menos de 15 días de antigüedad.` 
      });
      return;
    }
    
    setFacturaParaAnular(factura);
    setMotivoAnulacion('');
  };

  const cancelarAnulacion = () => {
    setFacturaParaAnular(null);
    setMotivoAnulacion('');
  };

  const generarNotaCredito = async (e) => {
    e.preventDefault();

    if (!motivoAnulacion || motivoAnulacion.trim().length < 10) {
      onMensaje({ type: 'error', text: 'El motivo debe tener al menos 10 caracteres' });
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      
      const response = await facturadorService.generarNotaCredito({
        facturaId: facturaParaAnular._id,
        nroFactura: facturaParaAnular.nroFactura,
        motivo: motivoAnulacion
      }, token);

      onMensaje({ 
        type: 'success', 
        text: `✅ Nota de Crédito ${response.notaCredito.nroComprobante} generada\nCAE: ${response.notaCredito.cae}\nFactura ${facturaParaAnular.nroFactura} anulada correctamente` 
      });

      setFacturaParaAnular(null);
      setMotivoAnulacion('');
      cargarDatos();

    } catch (error) {
      console.error('Error al generar nota de crédito:', error);
      onMensaje({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

  // FUNCIONES PARA DESCARGAR PDFs
  const descargarFacturaPDF = async (nroFactura) => {
    try {
      const response = await facturadorService.descargarFacturaPDF(nroFactura);
      
      const url = window.URL.createObjectURL(response.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `factura_${nroFactura.replace(/\//g, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      onMensaje({ type: 'success', text: 'PDF descargado correctamente' });
    } catch (error) {
      console.error('Error al descargar PDF:', error);
      onMensaje({ type: 'error', text: error.message || 'Error al descargar PDF' });
    }
  };

  const descargarNotaCreditoPDF = async (nroComprobante) => {
    try {
      const response = await facturadorService.descargarNotaCreditoPDF(nroComprobante);
      
      const url = window.URL.createObjectURL(response.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nota_credito_${nroComprobante.replace(/\//g, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      onMensaje({ type: 'success', text: 'PDF descargado correctamente' });
    } catch (error) {
      console.error('Error al descargar PDF:', error);
      onMensaje({ type: 'error', text: error.message || 'Error al descargar PDF' });
    }
  };

  // FILTROS
  const comprobantesAprobadosFiltrados = comprobantesAprobados.filter(c =>
    c.nroComprobante.toLowerCase().includes(filtroEmision.toLowerCase()) ||
    c.usuario.nombre.toLowerCase().includes(filtroEmision.toLowerCase()) ||
    c.usuario.apellido.toLowerCase().includes(filtroEmision.toLowerCase()) ||
    c.usuario.dni.includes(filtroEmision)
  );

  const facturasEmitidasFiltradas = facturasEmitidas.filter(f =>
    f.nroFactura.toLowerCase().includes(filtroAnulacion.toLowerCase()) ||
    f.cae.includes(filtroAnulacion) ||
    f.cliente.numeroDocumento.includes(filtroAnulacion)
  );

  const historialFiltrado = historialCompleto.filter(item => {
    const cumpleTipo = tipoFiltroHistorial === 'todos' || 
      (tipoFiltroHistorial === 'facturas' && item.tipo === 'factura') ||
      (tipoFiltroHistorial === 'notas_credito' && item.tipo === 'nota_credito');
    
    const cumpleBusqueda = !filtroHistorial || 
      item.nroComprobante.toLowerCase().includes(filtroHistorial.toLowerCase()) ||
      item.cae.includes(filtroHistorial) ||
      (item.cliente && item.cliente.numeroDocumento.includes(filtroHistorial));
    
    return cumpleTipo && cumpleBusqueda;
  });

  // RENDER
  return (
    <div className="facturador-nuevo">
      <div className="facturador-header">
        <div>
          <h1>📄 Facturador Electrónico AFIP</h1>
          <p className="subtitle">Emisión de facturas y notas de crédito con normativa ARCA</p>
        </div>
      </div>

      {/* Navegación de pestañas */}
      <div className="facturador-tabs">
        <button
          className={`tab ${vistaActual === 'emitir' ? 'active' : ''}`}
          onClick={() => setVistaActual('emitir')}
        >
          <span className="tab-icon">✍️</span>
          Emitir Facturas
        </button>
        <button
          className={`tab ${vistaActual === 'anular' ? 'active' : ''}`}
          onClick={() => setVistaActual('anular')}
        >
          <span className="tab-icon">❌</span>
          Anular Facturas
        </button>
        <button
          className={`tab ${vistaActual === 'historial' ? 'active' : ''}`}
          onClick={() => setVistaActual('historial')}
        >
          <span className="tab-icon">📋</span>
          Historial Completo
        </button>
      </div>

      {/* VISTA: EMITIR FACTURAS */}
      {vistaActual === 'emitir' && (
        <div className="facturador-content">
          <div className="content-header">
            <h2>Emitir Nueva Factura</h2>
            <div className="filter-controls">
              <input
                type="text"
                className="search-input"
                placeholder="🔍 Buscar comprobante..."
                value={filtroEmision}
                onChange={(e) => setFiltroEmision(e.target.value)}
              />
            </div>
          </div>

          <div className="facturador-grid">
            {/* Lista de comprobantes */}
            <div className="comprobantes-panel">
              <h3>Comprobantes Pendientes de Facturación</h3>
              <div className="comprobantes-count">
                {comprobantesAprobadosFiltrados.length} comprobante(s)
              </div>
              
              {loading ? (
                <div className="loading-spinner">Cargando...</div>
              ) : comprobantesAprobadosFiltrados.length === 0 ? (
                <div className="empty-state">
                  <span className="empty-icon">📭</span>
                  <p>No hay comprobantes pendientes</p>
                </div>
              ) : (
                <div className="comprobantes-list">
                  {comprobantesAprobadosFiltrados.map(comprobante => (
                    <div
                      key={comprobante._id}
                      className={`comprobante-item ${comprobanteSeleccionado?._id === comprobante._id ? 'selected' : ''}`}
                      onClick={() => seleccionarComprobante(comprobante)}
                    >
                      <div className="comprobante-header">
                        <span className="comprobante-numero">{comprobante.nroComprobante}</span>
                        <span className="comprobante-monto">${comprobante.montoAcreditado}</span>
                      </div>
                      <div className="comprobante-info">
                        <p><strong>Cliente:</strong> {comprobante.usuario.nombre} {comprobante.usuario.apellido}</p>
                        <p><strong>DNI:</strong> {comprobante.usuario.dni}</p>
                        <p><strong>Fecha:</strong> {new Date(comprobante.fecha).toLocaleDateString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Formulario de emisión */}
            <div className="formulario-panel">
              <h3>Datos de la Factura</h3>
              
              {!comprobanteSeleccionado ? (
                <div className="empty-state">
                  <span className="empty-icon">👈</span>
                  <p>Selecciona un comprobante para continuar</p>
                </div>
              ) : (
                <form onSubmit={generarFactura} className="factura-form">
                  <div className="form-section">
                    <h4>Información del Comprobante</h4>
                    <div className="info-grid">
                      <div className="info-item">
                        <label>N° Comprobante:</label>
                        <span>{comprobanteSeleccionado.nroComprobante}</span>
                      </div>
                      <div className="info-item">
                        <label>Monto:</label>
                        <span className="monto-destacado">${comprobanteSeleccionado.montoAcreditado}</span>
                      </div>
                      <div className="info-item">
                        <label>Cliente:</label>
                        <span>{comprobanteSeleccionado.usuario.nombre} {comprobanteSeleccionado.usuario.apellido}</span>
                      </div>
                      <div className="info-item">
                        <label>DNI:</label>
                        <span>{comprobanteSeleccionado.usuario.dni}</span>
                      </div>
                    </div>
                  </div>

                  <div className="form-section">
                    <h4>Configuración Fiscal</h4>
                    
                    <div className="form-group">
                      <label>Tipo de Factura</label>
                      <select
                        name="tipoFactura"
                        value={formDataEmision.tipoFactura}
                        onChange={handleChangeEmision}
                        className="form-control"
                        required
                      >
                        <option value="B">Factura B (Consumidor Final)</option>
                        <option value="A">Factura A (Responsable Inscripto)</option>
                      </select>
                      <small className="form-help">
                        {formDataEmision.tipoFactura === 'A' 
                          ? '⚠️ Requiere CUIT del cliente' 
                          : 'ℹ️ Para consumidores finales'}
                      </small>
                    </div>

                    {formDataEmision.tipoFactura === 'A' && (
                      <div className="form-group">
                        <label>CUIT del Cliente *</label>
                        <input
                          type="text"
                          name="cuit"
                          value={formDataEmision.cuit}
                          onChange={handleChangeEmision}
                          placeholder="20-12345678-9"
                          className="form-control"
                          required
                        />
                      </div>
                    )}

                    <div className="form-group">
                      <label>Condición IVA</label>
                      <select
                        name="condicionIVA"
                        value={formDataEmision.condicionIVA}
                        onChange={handleChangeEmision}
                        className="form-control"
                        required
                      >
                        <option value="Consumidor Final">Consumidor Final</option>
                        <option value="Responsable Inscripto">Responsable Inscripto</option>
                        <option value="Monotributo">Monotributo</option>
                        <option value="Exento">Exento</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Observaciones</label>
                      <textarea
                        name="observaciones"
                        value={formDataEmision.observaciones}
                        onChange={handleChangeEmision}
                        placeholder="Observaciones adicionales (opcional)"
                        className="form-control"
                        rows="3"
                      />
                    </div>
                  </div>

                  <div className="form-actions">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setComprobanteSeleccionado(null)}
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={loading}
                    >
                      {loading ? 'Generando...' : '✅ Generar Factura'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* VISTA: ANULAR FACTURAS (NOTAS DE CRÉDITO) */}
      {vistaActual === 'anular' && (
        <div className="facturador-content">
          <div className="content-header">
            <h2>Anular Factura con Nota de Crédito</h2>
            <div className="filter-controls">
              <div className="warning-text">
                ⚠️ Solo se pueden anular facturas con menos de 15 días de antigüedad (Normativa ARCA)
              </div>
              <input
                type="text"
                className="search-input"
                placeholder="🔍 Buscar factura..."
                value={filtroAnulacion}
                onChange={(e) => setFiltroAnulacion(e.target.value)}
              />
            </div>
          </div>

          <div className="facturador-layout-vertical-centered">
            {/* Lista de facturas anulables */}
            <div className="comprobantes-panel">
              <div className="panel-header">
                <h3>📋 Facturas Emitidas (últimos 15 días)</h3>
                <span className="panel-count">{facturasEmitidasFiltradas.length} factura(s)</span>
              </div>
              
              <div className="panel-body">
                {loading ? (
                  <div className="loading-spinner">
                    <div className="spinner"></div>
                    <p className="loading-text">Cargando facturas...</p>
                  </div>
                ) : facturasEmitidasFiltradas.length === 0 ? (
                  <div className="empty-state">
                    <span className="empty-icon">📭</span>
                    <h3>No hay facturas anulables</h3>
                    <p>No se encontraron facturas emitidas en los últimos 15 días</p>
                  </div>
                ) : (
                  <div className="comprobantes-list">
                    {facturasEmitidasFiltradas.map(factura => {
                      const fechaEmision = new Date(factura.fechaEmision);
                      const hoy = new Date();
                      const diasTranscurridos = Math.floor((hoy - fechaEmision) / (1000 * 60 * 60 * 24));
                      const puedeAnular = diasTranscurridos <= 15;
                      
                      return (
                        <div
                          key={factura._id}
                          className={`comprobante-item ${facturaParaAnular?._id === factura._id ? 'selected' : ''} ${!puedeAnular ? 'disabled' : ''}`}
                          onClick={() => puedeAnular && seleccionarFacturaParaAnular(factura)}
                        >
                          <div className="comprobante-header">
                            <div className="comprobante-numero-wrapper">
                              <span className="comprobante-label">N° Factura</span>
                              <span className="comprobante-numero">{factura.nroFactura}</span>
                            </div>
                            
                            <div className="comprobante-info">
                              <div className="info-item">
                                <span className="info-label">CAE</span>
                                <span className="info-value">{factura.cae}</span>
                              </div>
                              <div className="info-item">
                                <span className="info-label">Cliente</span>
                                <span className="info-value">{factura.cliente.nombre} {factura.cliente.apellido}</span>
                              </div>
                              <div className="info-item">
                                <span className="info-label">Emisión</span>
                                <span className="info-value">{new Date(factura.fechaEmision).toLocaleDateString()}</span>
                              </div>
                              <div className="info-item">
                                <span className="info-label">Antigüedad</span>
                                <span className={`dias-elapsed ${diasTranscurridos > 10 ? 'warning' : ''} ${diasTranscurridos > 13 ? 'danger' : ''}`}>
                                  {diasTranscurridos} día(s)
                                </span>
                              </div>
                            </div>
                            
                            <span className="comprobante-monto">${factura.importeTotal}</span>
                          </div>
                          {!puedeAnular && (
                            <div className="badge-vencido">🚫 No anulable</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Formulario de anulación - solo se muestra si hay factura seleccionada */}
            {facturaParaAnular && (
              <div className="formulario-panel">
                <div className="panel-header">
                  <h3>❌ Generar Nota de Crédito</h3>
                </div>
                
                <div className="panel-body">
                  <form onSubmit={generarNotaCredito} className="factura-form">
                    <div className="info-box">
                      <h4>Información de la Factura</h4>
                      <div className="info-grid-anular">
                        <div className="info-item">
                          <span className="info-label">N° Factura</span>
                          <span className="info-value">{facturaParaAnular.nroFactura}</span>
                        </div>
                        <div className="info-item">
                          <span className="info-label">CAE</span>
                          <span className="info-value">{facturaParaAnular.cae}</span>
                        </div>
                        <div className="info-item">
                          <span className="info-label">Importe</span>
                          <span className="info-value text-success fw-bold">${facturaParaAnular.importeTotal}</span>
                        </div>
                        <div className="info-item">
                          <span className="info-label">Cliente</span>
                          <span className="info-value">{facturaParaAnular.cliente.nombre} {facturaParaAnular.cliente.apellido}</span>
                        </div>
                      </div>
                    </div>

                    <div className="alert-box">
                      <span className="alert-icon">ℹ️</span>
                      <div className="alert-content">
                        <h4>Importante</h4>
                        <p>La nota de crédito anulará completamente esta factura y será registrada en AFIP con el mismo importe.</p>
                      </div>
                    </div>

                    <div className="form-group">
                      <label>Motivo de Anulación <span className="required">*</span></label>
                      <textarea
                        value={motivoAnulacion}
                        onChange={(e) => setMotivoAnulacion(e.target.value)}
                        placeholder="Ingrese el motivo de la anulación (mínimo 10 caracteres)"
                        className="form-control"
                        rows="4"
                        required
                        minLength="10"
                      />
                      <small className="form-hint">
                        {motivoAnulacion.length}/10 caracteres mínimos
                      </small>
                    </div>

                    <div className="form-actions">
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={cancelarAnulacion}
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        className="btn btn-danger"
                        disabled={loading || motivoAnulacion.length < 10}
                      >
                        {loading ? 'Generando NC...' : '❌ Generar Nota de Crédito'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* VISTA: HISTORIAL COMPLETO */}
      {vistaActual === 'historial' && (
        <div className="facturador-content">
          <div className="content-header">
            <h2>Historial de Comprobantes</h2>
            <div className="filter-controls">
              <select
                value={tipoFiltroHistorial}
                onChange={(e) => setTipoFiltroHistorial(e.target.value)}
                className="filter-select"
              >
                <option value="todos">Todos los comprobantes</option>
                <option value="facturas">Solo Facturas</option>
                <option value="notas_credito">Solo Notas de Crédito</option>
              </select>
              <input
                type="text"
                className="search-input"
                placeholder="🔍 Buscar..."
                value={filtroHistorial}
                onChange={(e) => setFiltroHistorial(e.target.value)}
              />
            </div>
          </div>

          {loading ? (
            <div className="loading-spinner">Cargando...</div>
          ) : historialFiltrado.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">📭</span>
              <p>No hay comprobantes en el historial</p>
            </div>
          ) : (
            <div className="historial-list">
              {historialFiltrado.map(item => (
                <div key={item._id} className={`historial-item ${item.tipo}`}>
                  <div className="historial-header">
                    <div className="historial-tipo">
                      {item.tipo === 'factura' ? (
                        <span className="badge badge-factura">📄 Factura {item.tipoComprobante}</span>
                      ) : (
                        <span className="badge badge-nota-credito">❌ Nota de Crédito {item.tipoComprobante}</span>
                      )}
                    </div>
                    <div className="historial-numero">{item.nroComprobante}</div>
                    <div className="historial-monto">${item.importeTotal}</div>
                  </div>
                  
                  <div className="historial-body">
                    <div className="historial-info">
                      <p><strong>CAE:</strong> {item.cae}</p>
                      <p><strong>Vencimiento CAE:</strong> {new Date(item.vencimientoCAE).toLocaleDateString()}</p>
                      <p><strong>Cliente:</strong> {item.cliente.razonSocial || `${item.cliente.nombre} ${item.cliente.apellido}`}</p>
                      <p><strong>CUIT/DNI:</strong> {item.cliente.numeroDocumento}</p>
                      <p><strong>Fecha Emisión:</strong> {new Date(item.fechaEmision).toLocaleString()}</p>
                      
                      {item.tipo === 'nota_credito' && item.facturaAsociada && (
                        <p className="asociada-info">
                          <strong>Anula a:</strong> Factura {item.facturaAsociada.nroFactura}
                        </p>
                      )}
                      
                      {item.tipo === 'factura' && item.anulada && (
                        <p className="anulada-info">
                          ⚠️ <strong>ANULADA</strong> por Nota de Crédito {item.notaCreditoAsociada?.nroComprobante}
                        </p>
                      )}
                    </div>
                    
                    <div className="historial-actions">
                      {item.tipo === 'factura' ? (
                        <button
                          className="btn btn-sm btn-outline"
                          onClick={() => descargarFacturaPDF(item.nroComprobante)}
                        >
                          📄 Descargar PDF
                        </button>
                      ) : (
                        <button
                          className="btn btn-sm btn-outline"
                          onClick={() => descargarNotaCreditoPDF(item.nroComprobante)}
                        >
                          📄 Descargar PDF
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FacturadorElectronicoNuevo;
