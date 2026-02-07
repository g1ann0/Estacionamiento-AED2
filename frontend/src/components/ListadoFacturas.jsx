import React, { useState, useEffect } from 'react';
import { facturadorService } from '../services/facturadorService';
import '../styles/admin.css';

const ListadoFacturas = ({ onMensaje }) => {
  const [facturas, setFacturas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filtros, setFiltros] = useState({
    fechaDesde: '',
    fechaHasta: '',
    busqueda: '',
    pagina: 1,
    limite: 20
  });
  const [paginacion, setPaginacion] = useState({
    total: 0,
    pagina: 1,
    limite: 20,
    totalPaginas: 1
  });

  // Cargar facturas
  const cargarFacturas = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await facturadorService.obtenerFacturas(filtros, token);
      
      console.log('📄 Facturas recibidas:', response);
      
      if (response.success) {
        setFacturas(response.facturas || []);
        setPaginacion(response.paginacion || {
          total: 0,
          pagina: 1,
          limite: 20,
          totalPaginas: 1
        });
      }
    } catch (error) {
      console.error('Error al cargar facturas:', error);
      onMensaje?.({ 
        type: 'error', 
        text: error.message || 'Error al cargar facturas' 
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarFacturas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtros.pagina, filtros.limite]);

  // Descargar PDF
  const handleDescargarPDF = async (nroFactura) => {
    try {
      const response = await facturadorService.descargarFacturaPDF(nroFactura);
      
      // Crear blob y descargar
      const url = window.URL.createObjectURL(response.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `factura_${nroFactura.replace(/\//g, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      onMensaje?.({ type: 'success', text: 'PDF descargado correctamente' });
    } catch (error) {
      console.error('Error al descargar PDF:', error);
      onMensaje?.({ 
        type: 'error', 
        text: error.message || 'Error al descargar PDF' 
      });
    }
  };

  // Aplicar filtros
  const aplicarFiltros = () => {
    setFiltros({ ...filtros, pagina: 1 });
    cargarFacturas();
  };

  // Limpiar filtros
  const limpiarFiltros = () => {
    setFiltros({
      fechaDesde: '',
      fechaHasta: '',
      busqueda: '',
      pagina: 1,
      limite: 20
    });
  };

  return (
    <div className="listado-facturas">
      <div className="header-section">
        <h2>📄 Todas las Facturas</h2>
        <p className="subtitle">Gestión de facturas electrónicas AFIP</p>
      </div>

      {/* Filtros */}
      <div className="filters-section">
        <div className="filters-grid">
          <div className="filter-group">
            <label>Fecha Desde:</label>
            <input
              type="date"
              value={filtros.fechaDesde}
              onChange={(e) => setFiltros({ ...filtros, fechaDesde: e.target.value })}
              className="input"
            />
          </div>

          <div className="filter-group">
            <label>Fecha Hasta:</label>
            <input
              type="date"
              value={filtros.fechaHasta}
              onChange={(e) => setFiltros({ ...filtros, fechaHasta: e.target.value })}
              className="input"
            />
          </div>

          <div className="filter-group">
            <label>Buscar:</label>
            <input
              type="text"
              placeholder="N° Factura, CAE o DNI..."
              value={filtros.busqueda}
              onChange={(e) => setFiltros({ ...filtros, busqueda: e.target.value })}
              className="input"
            />
          </div>

          <div className="filter-actions">
            <button onClick={aplicarFiltros} className="button button-primary">
              🔍 Buscar
            </button>
            <button onClick={limpiarFiltros} className="button button-secondary">
              🗑️ Limpiar
            </button>
          </div>
        </div>
      </div>

      {/* Estadísticas */}
      <div className="stats-row">
        <div className="stat-card">
          <span className="stat-value">{paginacion.total}</span>
          <span className="stat-label">Total Facturas</span>
        </div>
      </div>

      {/* Listado */}
      {loading ? (
        <div className="loading-spinner"></div>
      ) : facturas.length === 0 ? (
        <div className="no-data">
          <p>📋 No se encontraron facturas</p>
          <p>Prueba ajustando los filtros de búsqueda</p>
        </div>
      ) : (
        <div className="comprobantes-list">
          {facturas.map(factura => (
            <div key={factura._id} className="comprobante-card">
              <div className="comprobante-header">
                <h4>📄 Factura {factura.nroFactura}</h4>
                <span className="estado-badge estado-aprobado">
                  ✅ Emitida
                </span>
              </div>

              <div className="info-row">
                <strong>CAE:</strong>
                <span>{factura.cae}</span>
              </div>

              <div className="info-row">
                <strong>Vencimiento CAE:</strong>
                <span>{factura.vencimientoCAE ? new Date(factura.vencimientoCAE).toLocaleDateString() : 'N/A'}</span>
              </div>

              <div className="info-row">
                <strong>Cliente:</strong>
                <span>{factura.cliente?.razonSocial || `${factura.cliente?.nombre} ${factura.cliente?.apellido}`}</span>
              </div>

              <div className="info-row">
                <strong>CUIT/DNI:</strong>
                <span>{factura.cliente.numeroDocumento}</span>
              </div>

              <div className="info-row">
                <strong>Tipo Comprobante:</strong>
                <span>{factura.tipoComprobanteDescripcion || `Tipo ${factura.tipoComprobante}`}</span>
              </div>

              <div className="info-row">
                <strong>Importe Total:</strong>
                <span className="monto-total">${factura.importeTotal?.toFixed(2) || '0.00'}</span>
              </div>

              <div className="info-row">
                <strong>Comprobante Relacionado:</strong>
                <span>{factura.comprobanteRelacionado.nroComprobante|| 'N/A'}</span>
              </div>

              <div className="info-row">
                <strong>Fecha Emisión:</strong>
                <span>{factura.fechaEmision ? new Date(factura.fechaEmision).toLocaleString() : 'N/A'}</span>
              </div>

              <div className="action-buttons">
                <button
                  className="button button-primary"
                  onClick={() => handleDescargarPDF(factura.nroFactura)}
                  title="Descargar PDF de la factura"
                >
                  📄 Descargar PDF
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Paginación */}
      {paginacion.totalPaginas > 1 && (
        <div className="pagination">
          <button
            className="button button-secondary"
            onClick={() => setFiltros({ ...filtros, pagina: filtros.pagina - 1 })}
            disabled={filtros.pagina === 1}
          >
            ← Anterior
          </button>
          
          <span className="pagination-info">
            Página {paginacion.pagina} de {paginacion.totalPaginas}
          </span>
          
          <button
            className="button button-secondary"
            onClick={() => setFiltros({ ...filtros, pagina: filtros.pagina + 1 })}
            disabled={filtros.pagina >= paginacion.totalPaginas}
          >
            Siguiente →
          </button>
        </div>
      )}
    </div>
  );
};

export default ListadoFacturas;
