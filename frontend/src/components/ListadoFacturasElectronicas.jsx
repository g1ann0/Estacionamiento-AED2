import React, { useState, useEffect } from 'react';
import { facturaElectronicaService } from '../services/facturaElectronicaService';
import '../styles/facturador.css';

const ListadoFacturasElectronicas = ({ onMensaje }) => {
  const [facturas, setFacturas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [facturaDetalle, setFacturaDetalle] = useState(null);
  const [filtros, setFiltros] = useState({
    fechaDesde: '',
    fechaHasta: '',
    tipoComprobante: '',
    estado: '',
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
  const [estadisticas, setEstadisticas] = useState({
    totalFacturado: 0,
    cantidadFacturas: 0,
    conCAE: 0,
    vencidas: 0
  });

  // Cargar facturas al montar y cuando cambien los filtros
  useEffect(() => {
    cargarFacturas();
  }, [filtros]);

  const cargarFacturas = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await facturaElectronicaService.obtenerFacturasElectronicas(filtros, token);
      
      setFacturas(response.facturas || []);
      setPaginacion(response.paginacion || {});
      setEstadisticas(response.estadisticas || {});
    } catch (error) {
      console.error('Error al cargar facturas:', error);
      onMensaje({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

  // Actualizar filtros
  const actualizarFiltro = (campo, valor) => {
    setFiltros(prev => ({
      ...prev,
      [campo]: valor,
      pagina: campo !== 'pagina' ? 1 : valor
    }));
  };

  // Limpiar filtros
  const limpiarFiltros = () => {
    setFiltros({
      fechaDesde: '',
      fechaHasta: '',
      tipoComprobante: '',
      estado: '',
      busqueda: '',
      pagina: 1,
      limite: 20
    });
  };

  // Ver detalle de factura
  const verDetalle = async (facturaId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await facturaElectronicaService.obtenerFacturaDetalle(facturaId, token);
      setFacturaDetalle(response.factura);
    } catch (error) {
      console.error('Error al obtener detalle:', error);
      onMensaje({ type: 'error', text: error.message });
    }
  };

  // Descargar PDF
  const descargarPDF = async (facturaId) => {
    try {
      const token = localStorage.getItem('token');
      await facturaElectronicaService.descargarPDF(facturaId, token);
      onMensaje({ type: 'success', text: 'PDF descargado correctamente' });
    } catch (error) {
      console.error('Error al descargar PDF:', error);
      onMensaje({ type: 'error', text: error.message });
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

  // Formatear fecha CAE (formato YYYYMMDD)
  const formatearFechaCAE = (fechaCAE) => {
    if (!fechaCAE) return 'N/A';
    const str = fechaCAE.toString();
    return `${str.substring(6, 8)}/${str.substring(4, 6)}/${str.substring(0, 4)}`;
  };

  // Verificar si CAE está vencido
  const caeVencido = (fechaVencimiento) => {
    if (!fechaVencimiento) return false;
    const str = fechaVencimiento.toString();
    const fecha = new Date(
      parseInt(str.substring(0, 4)),
      parseInt(str.substring(4, 6)) - 1,
      parseInt(str.substring(6, 8))
    );
    return fecha < new Date();
  };

  return (
    <div className="listado-facturas-electronicas">
      <div className="listado-header">
        <h2>📊 Facturas Electrónicas AFIP</h2>
        
        {/* Estadísticas */}
        <div className="estadisticas-grid">
          <div className="estadistica-card">
            <div className="estadistica-valor">{estadisticas.cantidadFacturas || 0}</div>
            <div className="estadistica-label">Total Facturas</div>
          </div>
          <div className="estadistica-card">
            <div className="estadistica-valor">{formatearMoneda(estadisticas.totalFacturado || 0)}</div>
            <div className="estadistica-label">Total Facturado</div>
          </div>
          <div className="estadistica-card">
            <div className="estadistica-valor">{estadisticas.conCAE || 0}</div>
            <div className="estadistica-label">Con CAE</div>
          </div>
          <div className="estadistica-card">
            <div className="estadistica-valor">{estadisticas.vencidas || 0}</div>
            <div className="estadistica-label">CAE Vencidos</div>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="filtros-panel">
        <div className="filtros-grid">
          <div className="form-group">
            <label>Buscar</label>
            <input
              type="text"
              placeholder="Nro factura, CAE, usuario..."
              value={filtros.busqueda}
              onChange={(e) => actualizarFiltro('busqueda', e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Desde</label>
            <input
              type="date"
              value={filtros.fechaDesde}
              onChange={(e) => actualizarFiltro('fechaDesde', e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Hasta</label>
            <input
              type="date"
              value={filtros.fechaHasta}
              onChange={(e) => actualizarFiltro('fechaHasta', e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Tipo Comprobante</label>
            <select
              value={filtros.tipoComprobante}
              onChange={(e) => actualizarFiltro('tipoComprobante', e.target.value)}
            >
              <option value="">Todos</option>
              <option value="82">82 - Tique Factura B</option>
              <option value="81">81 - Tique Factura A</option>
              <option value="11">11 - Factura C</option>
              <option value="6">6 - Factura B</option>
              <option value="1">1 - Factura A</option>
            </select>
          </div>

          <div className="form-group">
            <label>Estado</label>
            <select
              value={filtros.estado}
              onChange={(e) => actualizarFiltro('estado', e.target.value)}
            >
              <option value="">Todos</option>
              <option value="emitida">Emitida</option>
              <option value="vencida">CAE Vencido</option>
            </select>
          </div>

          <div className="form-group">
            <button className="btn btn-secondary" onClick={limpiarFiltros}>
              Limpiar Filtros
            </button>
          </div>
        </div>
      </div>

      {/* Tabla de facturas */}
      <div className="facturas-table-container">
        {loading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Cargando facturas...</p>
          </div>
        ) : facturas.length === 0 ? (
          <div className="empty-state">
            <p>No se encontraron facturas electrónicas</p>
          </div>
        ) : (
          <table className="facturas-table">
            <thead>
              <tr>
                <th>Nro. Factura</th>
                <th>CAE</th>
                <th>Fecha Emisión</th>
                <th>Venc. CAE</th>
                <th>Tipo</th>
                <th>Usuario</th>
                <th>Importe</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {facturas.map(factura => (
                <tr key={factura._id}>
                  <td className="factura-numero">{factura.nroFactura}</td>
                  <td className="factura-cae">
                    <code>{factura.cae || 'Sin CAE'}</code>
                  </td>
                  <td>{formatearFecha(factura.fechaEmision)}</td>
                  <td className={caeVencido(factura.caeFechaVencimiento) ? 'cae-vencido' : ''}>
                    {formatearFechaCAE(factura.caeFechaVencimiento)}
                    {caeVencido(factura.caeFechaVencimiento) && ' ⚠️'}
                  </td>
                  <td>
                    <span className="tipo-comprobante">
                      {factura.tipoComprobante} - {factura.tipoComprobanteDescripcion}
                    </span>
                  </td>
                  <td>{factura.usuarioId?.nombre || 'N/A'}</td>
                  <td className="factura-importe">{formatearMoneda(factura.importeTotal)}</td>
                  <td>
                    <span className={`estado-badge ${factura.estado}`}>
                      {factura.estado}
                    </span>
                  </td>
                  <td className="acciones">
                    <button
                      className="btn-icon"
                      onClick={() => verDetalle(factura._id)}
                      title="Ver detalle"
                    >
                      👁️
                    </button>
                    <button
                      className="btn-icon"
                      onClick={() => descargarPDF(factura._id)}
                      title="Descargar PDF"
                    >
                      📥
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Paginación */}
      {paginacion.totalPaginas > 1 && (
        <div className="paginacion">
          <button
            className="btn btn-secondary"
            onClick={() => actualizarFiltro('pagina', filtros.pagina - 1)}
            disabled={filtros.pagina === 1}
          >
            ← Anterior
          </button>
          <span className="paginacion-info">
            Página {paginacion.pagina} de {paginacion.totalPaginas}
          </span>
          <button
            className="btn btn-secondary"
            onClick={() => actualizarFiltro('pagina', filtros.pagina + 1)}
            disabled={filtros.pagina === paginacion.totalPaginas}
          >
            Siguiente →
          </button>
        </div>
      )}

      {/* Modal de detalle */}
      {facturaDetalle && (
        <div className="modal-overlay" onClick={() => setFacturaDetalle(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Detalle de Factura Electrónica</h3>
              <button className="btn-close" onClick={() => setFacturaDetalle(null)}>✕</button>
            </div>
            
            <div className="modal-body">
              <div className="detalle-grid">
                <div className="detalle-section">
                  <h4>Información General</h4>
                  <div className="detalle-item">
                    <label>Nro. Factura:</label>
                    <span>{facturaDetalle.nroFactura}</span>
                  </div>
                  <div className="detalle-item">
                    <label>Tipo:</label>
                    <span>{facturaDetalle.tipoComprobante} - {facturaDetalle.tipoComprobanteDescripcion}</span>
                  </div>
                  <div className="detalle-item">
                    <label>Punto de Venta:</label>
                    <span>{facturaDetalle.puntoVenta}</span>
                  </div>
                  <div className="detalle-item">
                    <label>Fecha Emisión:</label>
                    <span>{formatearFecha(facturaDetalle.fechaEmision)}</span>
                  </div>
                </div>

                <div className="detalle-section">
                  <h4>Datos AFIP</h4>
                  <div className="detalle-item">
                    <label>CAE:</label>
                    <span className="cae-destacado">{facturaDetalle.cae}</span>
                  </div>
                  <div className="detalle-item">
                    <label>Vencimiento CAE:</label>
                    <span className={caeVencido(facturaDetalle.caeFechaVencimiento) ? 'text-danger' : ''}>
                      {formatearFechaCAE(facturaDetalle.caeFechaVencimiento)}
                      {caeVencido(facturaDetalle.caeFechaVencimiento) && ' ⚠️ VENCIDO'}
                    </span>
                  </div>
                  <div className="detalle-item">
                    <label>Estado:</label>
                    <span className={`estado-badge ${facturaDetalle.estado}`}>
                      {facturaDetalle.estado}
                    </span>
                  </div>
                </div>

                <div className="detalle-section">
                  <h4>Cliente</h4>
                  <div className="detalle-item">
                    <label>Nombre:</label>
                    <span>{facturaDetalle.usuarioId?.nombre}</span>
                  </div>
                  <div className="detalle-item">
                    <label>Email:</label>
                    <span>{facturaDetalle.usuarioId?.email}</span>
                  </div>
                  <div className="detalle-item">
                    <label>CUIT:</label>
                    <span>{facturaDetalle.datosCliente?.cuit || 'No informado'}</span>
                  </div>
                </div>

                <div className="detalle-section">
                  <h4>Importes</h4>
                  <div className="detalle-item">
                    <label>Importe Neto:</label>
                    <span>{formatearMoneda(facturaDetalle.importeNeto)}</span>
                  </div>
                  {facturaDetalle.detalleIVA && facturaDetalle.detalleIVA.length > 0 && (
                    <div className="detalle-item">
                      <label>IVA:</label>
                      <div>
                        {facturaDetalle.detalleIVA.map((iva, index) => (
                          <div key={index}>
                            {iva.alicuota}%: {formatearMoneda(iva.importe)}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="detalle-item">
                    <label>Total:</label>
                    <span className="importe-total">{formatearMoneda(facturaDetalle.importeTotal)}</span>
                  </div>
                </div>

                {facturaDetalle.observaciones && (
                  <div className="detalle-section full-width">
                    <h4>Observaciones</h4>
                    <p>{facturaDetalle.observaciones}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setFacturaDetalle(null)}
              >
                Cerrar
              </button>
              <button
                className="btn btn-primary"
                onClick={() => descargarPDF(facturaDetalle._id)}
              >
                📥 Descargar PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ListadoFacturasElectronicas;
