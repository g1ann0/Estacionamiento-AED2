import React, { useState, useEffect } from 'react';
import comprobanteService from '../services/comprobanteService';
import AuditoriaLogs from './AuditoriaLogs';
import '../styles/admin.css';

const ListadoComprobantes = ({ onMensaje }) => {
  const [activeTab, setActiveTab] = useState('comprobantes');
  const [comprobantes, setComprobantes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filtros, setFiltros] = useState({
    estado: 'todos',
    tipoComprobante: 'todos',
    fechaDesde: '',
    fechaHasta: '',
    busqueda: '',
    pagina: 1,
    limite: 10
  });
  const [paginacion, setPaginacion] = useState({
    total: 0,
    pagina: 1,
    limite: 10,
    totalPaginas: 1
  });

  const [estadisticas, setEstadisticas] = useState({
    total: 0,
    pendientes: 0,
    aprobados: 0,
    rechazados: 0
  });

  // Cargar comprobantes
  const cargarComprobantes = async () => {
    setLoading(true);
    try {
      const params = {
        ...filtros,
        pagina: filtros.pagina.toString(),
        limite: filtros.limite.toString()
      };

      const response = await comprobanteService.obtenerTodos(params);
      
      if (response.success) {
        setComprobantes(response.comprobantes || []);
        setPaginacion(response.paginacion || {
          total: 0,
          pagina: 1,
          limite: 10,
          totalPaginas: 1
        });
        
        // Calcular estadísticas
        const stats = {
          total: response.comprobantes?.length || 0,
          pendientes: response.comprobantes?.filter(c => c.estado === 'pendiente').length || 0,
          aprobados: response.comprobantes?.filter(c => c.estado === 'aprobado').length || 0,
          rechazados: response.comprobantes?.filter(c => c.estado === 'rechazado').length || 0
        };
        setEstadisticas(stats);
      } else {
        throw new Error(response.mensaje || 'Error al cargar comprobantes');
      }
    } catch (error) {
      console.error('Error al cargar comprobantes:', error);
      onMensaje({
        type: 'error',
        text: error.message || 'Error al cargar comprobantes'
      });
    } finally {
      setLoading(false);
    }
  };

  // Efecto para cargar datos cuando cambien los filtros
  useEffect(() => {
    if (activeTab === 'comprobantes') {
      cargarComprobantes();
    }
  }, [filtros, activeTab]);

  // Cambiar estado de comprobante
  const cambiarEstado = async (id, nuevoEstado) => {
    try {
      const response = await comprobanteService.cambiarEstado(id, nuevoEstado);
      
      if (response.success) {
        onMensaje({
          type: 'success',
          text: `Comprobante ${nuevoEstado} exitosamente`
        });
        cargarComprobantes(); // Recargar la lista
      } else {
        throw new Error(response.mensaje || 'Error al cambiar estado');
      }
    } catch (error) {
      console.error('Error al cambiar estado:', error);
      onMensaje({
        type: 'error',
        text: error.message || 'Error al cambiar estado del comprobante'
      });
    }
  };

  // Manejar cambio de filtros
  const handleFiltroChange = (campo, valor) => {
    setFiltros(prev => ({
      ...prev,
      [campo]: valor,
      pagina: 1 // Resetear a la primera página
    }));
  };

  // Limpiar filtros
  const limpiarFiltros = () => {
    setFiltros({
      estado: 'todos',
      tipoComprobante: 'todos',
      fechaDesde: '',
      fechaHasta: '',
      busqueda: '',
      pagina: 1,
      limite: 10
    });
  };

  // Renderizar estadísticas
  const renderEstadisticas = () => (
    <div className="estadisticas-comprobantes">
      <div className="stat-card stat-total">
        <h3>{estadisticas.total}</h3>
        <p>Total Comprobantes</p>
      </div>
      <div className="stat-card stat-verificados">
        <h3>{estadisticas.aprobados}</h3>
        <p>Aprobados</p>
      </div>
      <div className="stat-card stat-asociados">
        <h3>{estadisticas.pendientes}</h3>
        <p>Pendientes</p>
      </div>
      <div className="stat-card stat-saldo">
        <h3>{estadisticas.rechazados}</h3>
        <p>Rechazados</p>
      </div>
    </div>
  );

  // Renderizar filtros
  const renderFiltros = () => (
    <div className="filtros-comprobantes">
      <h3>🔍 Filtros de Búsqueda</h3>
      
      <div className="search-section">
        <div className="form-control">
          <label>Búsqueda General</label>
          <input
            type="text"
            className="input"
            placeholder="Buscar por DNI, nombre, descripción..."
            value={filtros.busqueda}
            onChange={(e) => handleFiltroChange('busqueda', e.target.value)}
          />
        </div>
      </div>

      <div className="filtros-grid">
        <div className="form-control">
          <label>Estado</label>
          <select
            className="input"
            value={filtros.estado}
            onChange={(e) => handleFiltroChange('estado', e.target.value)}
          >
            <option value="todos">Todos los estados</option>
            <option value="pendiente">⏳ Pendientes</option>
            <option value="aprobado">✅ Aprobados</option>
            <option value="rechazado">❌ Rechazados</option>
          </select>
        </div>

        <div className="form-control">
          <label>Tipo de Comprobante</label>
          <select
            className="input"
            value={filtros.tipoComprobante}
            onChange={(e) => handleFiltroChange('tipoComprobante', e.target.value)}
          >
            <option value="todos">Todos los tipos</option>
            <option value="carga_saldo">💰 Carga de Saldo</option>
            <option value="pago_estacionamiento">🅿️ Pago de Estacionamiento</option>
            <option value="otro">📄 Otros</option>
          </select>
        </div>

        <div className="form-control">
          <label>Fecha Desde</label>
          <input
            type="date"
            className="input"
            value={filtros.fechaDesde}
            onChange={(e) => handleFiltroChange('fechaDesde', e.target.value)}
          />
        </div>

        <div className="form-control">
          <label>Fecha Hasta</label>
          <input
            type="date"
            className="input"
            value={filtros.fechaHasta}
            onChange={(e) => handleFiltroChange('fechaHasta', e.target.value)}
          />
        </div>
      </div>

      <div className="filtros-actions">
        <button 
          className="button button-secondary"
          onClick={limpiarFiltros}
        >
          🔄 Limpiar Filtros
        </button>
      </div>
    </div>
  );

  // Renderizar lista de comprobantes
  const renderComprobantes = () => (
    <div className="comprobantes-lista">
      {loading ? (
        <div className="loading-spinner"></div>
      ) : comprobantes.length === 0 ? (
        <div className="no-data">
          <p>📋 No se encontraron comprobantes</p>
          <p>Prueba ajustando los filtros de búsqueda</p>
        </div>
      ) : (
        <div className="comprobantes-list">
          {comprobantes.map(comprobante => (
            <div key={comprobante._id} className="comprobante-card">
              <div className="comprobante-header">
                <h4>📄 Comprobante #{comprobante.numeroComprobante || comprobante._id.slice(-6)}</h4>
                <span className={`estado-badge estado-${comprobante.estado}`}>
                  {comprobante.estado === 'pendiente' && '⏳ Pendiente'}
                  {comprobante.estado === 'aprobado' && '✅ Aprobado'}
                  {comprobante.estado === 'rechazado' && '❌ Rechazado'}
                </span>
              </div>

              <div className="info-row">
                <strong>Usuario:</strong>
                <span>{comprobante.usuario?.nombre} {comprobante.usuario?.apellido} ({comprobante.usuario?.dni})</span>
              </div>

              <div className="info-row">
                <strong>Tipo:</strong>
                <span>{comprobante.tipoComprobante || 'No especificado'}</span>
              </div>

              <div className="info-row">
                <strong>Monto:</strong>
                <span className="monto-total">${comprobante.monto || 0}</span>
              </div>

              <div className="info-row">
                <strong>Fecha:</strong>
                <span>{new Date(comprobante.fechaCreacion).toLocaleDateString()}</span>
              </div>

              {comprobante.descripcion && (
                <div className="info-row">
                  <strong>Descripción:</strong>
                  <span>{comprobante.descripcion}</span>
                </div>
              )}

              {comprobante.estado === 'pendiente' && (
                <div className="action-buttons">
                  <button
                    className="button btn-success"
                    onClick={() => cambiarEstado(comprobante._id, 'aprobado')}
                  >
                    ✅ Aprobar
                  </button>
                  <button
                    className="button btn-danger"
                    onClick={() => cambiarEstado(comprobante._id, 'rechazado')}
                  >
                    ❌ Rechazar
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Paginación */}
      {paginacion.totalPaginas > 1 && (
        <div className="paginacion">
          <button
            disabled={paginacion.pagina === 1}
            onClick={() => handleFiltroChange('pagina', paginacion.pagina - 1)}
          >
            ← Anterior
          </button>
          
          <span>Página {paginacion.pagina} de {paginacion.totalPaginas}</span>
          
          <button
            disabled={paginacion.pagina === paginacion.totalPaginas}
            onClick={() => handleFiltroChange('pagina', paginacion.pagina + 1)}
          >
            Siguiente →
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="listado-comprobantes">
      <div className="listado-header">
        <div>
          <h2>📋 Gestión de Comprobantes y Auditoría</h2>
          <p>Administra comprobantes de pagos y consulta logs del sistema</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button
          className={`tab ${activeTab === 'comprobantes' ? 'active' : ''}`}
          onClick={() => setActiveTab('comprobantes')}
        >
          📋 Comprobantes ({estadisticas.total})
        </button>
        <button
          className={`tab ${activeTab === 'auditoria' ? 'active' : ''}`}
          onClick={() => setActiveTab('auditoria')}
        >
          🔍 Auditoría
        </button>
      </div>

      {/* Contenido de tabs */}
      <div className="tab-content">
        {activeTab === 'comprobantes' && (
          <>
            {renderEstadisticas()}
            {renderFiltros()}
            {renderComprobantes()}
          </>
        )}
        
        {activeTab === 'auditoria' && (
          <div className="auditoria-section">
            <h3>🔍 Auditoría del Sistema</h3>
            <p style={{ marginBottom: '1.5rem', color: '#666' }}>
              Consulta los registros de auditoría del sistema para seguimiento de cambios y actividades.
            </p>
            <AuditoriaLogs onMensaje={onMensaje} />
          </div>
        )}
      </div>
    </div>
  );
};

export default ListadoComprobantes;
