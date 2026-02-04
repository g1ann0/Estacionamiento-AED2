import React, { useState, useEffect, useCallback } from 'react';
import { facturadorService } from '../services/facturadorService';
import '../styles/facturador.css';

const FacturadorElectronico = ({ onMensaje }) => {
  const [loading, setLoading] = useState(false);
  const [comprobantesAprobados, setComprobantesAprobados] = useState([]);
  const [comprobanteSeleccionado, setComprobanteSeleccionado] = useState(null);
  
  const [formData, setFormData] = useState({
    nroComprobante: '',
    tipoFactura: 'B',
    cuit: '',
    condicionIVA: 'Consumidor Final',
    observaciones: ''
  });

  const cargarDatosIniciales = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const comprobantesResponse = await facturadorService.obtenerComprobantesAprobados(token);
      setComprobantesAprobados(comprobantesResponse.comprobantes || []);
    } catch (error) {
      console.error('Error al cargar datos:', error);
      onMensaje({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  }, [onMensaje]);

  useEffect(() => {
    cargarDatosIniciales();
  }, [cargarDatosIniciales]);

  const seleccionarComprobante = (comprobante) => {
    setComprobanteSeleccionado(comprobante);
    setFormData({
      ...formData,
      nroComprobante: comprobante.nroComprobante,
      condicionIVA: 'Consumidor Final'
    });
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const generarFactura = async (e) => {
    e.preventDefault();

    if (!formData.nroComprobante) {
      onMensaje({ type: 'error', text: 'Debe seleccionar un comprobante' });
      return;
    }

    if (formData.tipoFactura === 'A' && !formData.cuit) {
      onMensaje({ type: 'error', text: 'Para Factura A debe ingresar el CUIT' });
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      
      const response = await facturadorService.generarFactura({
        nroComprobante: formData.nroComprobante,
        tipoFactura: formData.tipoFactura,
        cuit: formData.cuit || null,
        condicionIVA: formData.condicionIVA,
        observaciones: formData.observaciones
      }, token);

      onMensaje({ 
        type: 'success', 
        text: `✅ Factura generada exitosamente\nCAE: ${response.factura.cae}\nNro: ${response.factura.nroFactura}` 
      });

      setFormData({
        nroComprobante: '',
        tipoFactura: 'B',
        cuit: '',
        condicionIVA: 'Consumidor Final',
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

  const formatearMoneda = (valor) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(valor);
  };

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
        <div className="estado-afip">
          <span className="status-badge success">✅ AFIP Online</span>
        </div>
      </div>

      <div className="facturador-container">
        <div className="comprobantes-pendientes">
          <h3>Comprobantes Aprobados sin Facturar</h3>
          
          {loading && <p>Cargando...</p>}
          
          {!loading && comprobantesAprobados.length === 0 && (
            <p className="mensaje-vacio">✅ No hay comprobantes pendientes de facturación</p>
          )}

          {!loading && comprobantesAprobados.length > 0 && (
            <div className="lista-comprobantes">
              {comprobantesAprobados.map(comprobante => (
                <div 
                  key={comprobante._id}
                  className={`comprobante-item ${comprobanteSeleccionado?._id === comprobante._id ? 'seleccionado' : ''}`}
                  onClick={() => seleccionarComprobante(comprobante)}
                >
                  <div className="comprobante-info">
                    <strong>{comprobante.nroComprobante}</strong>
                    <p>{comprobante.usuario.nombre} {comprobante.usuario.apellido}</p>
                    <p>DNI: {comprobante.usuario.dni}</p>
                    <p className="monto">{formatearMoneda(comprobante.montoAcreditado)}</p>
                    <small>{formatearFecha(comprobante.fecha)}</small>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="generar-factura">
          <h3>Generar Factura Electrónica</h3>
          
          {!comprobanteSeleccionado && (
            <p className="mensaje-info">👈 Seleccione un comprobante de la lista para facturar</p>
          )}

          {comprobanteSeleccionado && (
            <form onSubmit={generarFactura}>
              <div className="form-group">
                <label>Comprobante seleccionado</label>
                <input type="text" value={comprobanteSeleccionado.nroComprobante} readOnly />
              </div>

              <div className="form-group">
                <label>Tipo de Factura *</label>
                <select name="tipoFactura" value={formData.tipoFactura} onChange={handleChange} required>
                  <option value="B">Factura B (Consumidor Final / Monotributo)</option>
                  <option value="A">Factura A (Responsable Inscripto)</option>
                </select>
              </div>

              {formData.tipoFactura === 'A' && (
                <div className="form-group">
                  <label>CUIT *</label>
                  <input 
                    type="text" 
                    name="cuit"
                    value={formData.cuit}
                    onChange={handleChange}
                    placeholder="20-12345678-9"
                    required
                  />
                  <small>Requerido para Factura A</small>
                </div>
              )}

              <div className="form-group">
                <label>Condición IVA del Cliente *</label>
                <select name="condicionIVA" value={formData.condicionIVA} onChange={handleChange} required>
                  <option value="Consumidor Final">Consumidor Final</option>
                  <option value="Monotributo">Responsable Monotributo</option>
                  <option value="Responsable Inscripto">Responsable Inscripto</option>
                  <option value="Exento">IVA Exento</option>
                </select>
                <small>Obligatorio según RG 5616/2024 ARCA</small>
              </div>

              <div className="form-group">
                <label>Observaciones</label>
                <textarea 
                  name="observaciones"
                  value={formData.observaciones}
                  onChange={handleChange}
                  rows="3"
                />
              </div>

              <button type="submit" className="btn-generar" disabled={loading}>
                {loading ? 'Generando...' : '📄 Generar Factura con CAE'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default FacturadorElectronico;
