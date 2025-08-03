import React, { useState, useEffect } from 'react';
import '../styles/admin.css';

const AuditoriaLogs = ({ onMensaje }) => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filtros, setFiltros] = useState({
    tipoLog: 'todos',
    fechaDesde: '',
    fechaHasta: '',
    busqueda: '',
    pagina: 1,
    limite: 20,
    ordenPor: 'fecha',
    orden: 'desc'
  });
  const [paginacion, setPaginacion] = useState({
    total: 0,
    pagina: 1,
    limite: 20,
    totalPaginas: 1
  });
  const [estadisticas, setEstadisticas] = useState({
    totalLogs: 0,
    logsSaldo: 0,
    logsVehiculo: 0,
    logsPrecio: 0,
    logsConfiguracion: 0
  });

  // Efecto para cargar logs cuando cambien los filtros
  useEffect(() => {
    const cargarDatos = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('token');
        const params = new URLSearchParams({
          ...filtros,
          pagina: filtros.pagina.toString(),
          limite: filtros.limite.toString()
        });

        const response = await fetch(`http://localhost:3000/api/admin/auditoria?${params}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error('Error al cargar logs de auditoría');
        }

        const data = await response.json();
        setLogs(data.logs || []);
        setPaginacion(data.paginacion || {});
        setEstadisticas(data.estadisticas || {});
      } catch (error) {
        console.error('Error:', error);
        onMensaje({ type: 'error', text: error.message });
      } finally {
        setLoading(false);
      }
    };

    cargarDatos();
  }, [filtros, onMensaje]);

  // Actualizar filtro
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
      tipoLog: 'todos',
      fechaDesde: '',
      fechaHasta: '',
      busqueda: '',
      pagina: 1,
      limite: 20,
      ordenPor: 'fecha',
      orden: 'desc'
    });
  };

  // Formatear tipo de operación
  const formatearTipoOperacion = (tipo) => {
    const tipos = {
      'crear': '🆕 Crear',
      'modificar': '✏️ Modificar',
      'eliminar': '🗑️ Eliminar',
      'actualizar': '🔄 Actualizar',
      'cambio_propietario': '👤 Cambio Propietario',
      'ajuste_admin': '⚙️ Ajuste Admin',
      'recarga': '💰 Recarga',
      'descuento': '💸 Descuento',
      'correccion': '🔧 Corrección'
    };
    return tipos[tipo] || tipo;
  };

  // Formatear tipo de log
  const formatearTipoLog = (tipo) => {
    const tipos = {
      'saldo': '💰 Saldo',
      'vehiculo': '🚗 Vehículo',
      'precio': '💲 Precio',
      'configuracion': '⚙️ Configuración'
    };
    return tipos[tipo] || tipo;
  };

  // Generar páginas para paginación
  const generarPaginas = () => {
    const paginas = [];
    const inicio = Math.max(1, paginacion.pagina - 2);
    const fin = Math.min(paginacion.totalPaginas, paginacion.pagina + 2);

    for (let i = inicio; i <= fin; i++) {
      paginas.push(i);
    }
    return paginas;
  };

  // Renderizar contenido del log según el tipo
  const renderizarContenidoLog = (log) => {
    switch (log.tipoLog) {
      case 'saldo':
        return (
          <div className="log-content">
            <div className="log-row">
              <strong>Usuario Afectado:</strong> {log.usuarioAfectado?.nombre} {log.usuarioAfectado?.apellido} ({log.usuarioAfectado?.dni})
            </div>
            <div className="log-row">
              <strong>Saldo:</strong> ${log.saldoAnterior?.toLocaleString()} → ${log.saldoNuevo?.toLocaleString()}
            </div>
            <div className="log-row">
              <strong>Diferencia:</strong> 
              <span className={log.diferencia >= 0 ? 'text-success' : 'text-danger'}>
                {log.diferencia >= 0 ? '+' : ''}${log.diferencia?.toLocaleString()}
              </span>
            </div>
            {log.observaciones && (
              <div className="log-row">
                <strong>Observaciones:</strong> {log.observaciones}
              </div>
            )}
          </div>
        );

      case 'vehiculo':
        return (
          <div className="log-content">
            <div className="log-row">
              <strong>Vehículo:</strong> {log.vehiculo?.dominio} - {log.vehiculo?.marca} {log.vehiculo?.modelo} ({log.vehiculo?.año})
            </div>
            {log.propietarioAnterior && (
              <div className="log-row">
                <strong>Propietario Anterior:</strong> {log.propietarioAnterior.nombre} {log.propietarioAnterior.apellido} ({log.propietarioAnterior.dni})
              </div>
            )}
            {log.propietarioNuevo && (
              <div className="log-row">
                <strong>Propietario Nuevo:</strong> {log.propietarioNuevo.nombre} {log.propietarioNuevo.apellido} ({log.propietarioNuevo.dni})
              </div>
            )}
            {log.cambiosRealizados && Object.keys(log.cambiosRealizados).length > 0 && (
              <div className="log-row">
                <strong>Cambios:</strong>
                <ul style={{ margin: '0.5rem 0', paddingLeft: '1.5rem' }}>
                  {Object.entries(log.cambiosRealizados).map(([campo, valor]) => 
                    valor && (
                      <li key={campo}>
                        {campo.replace('Anterior', '')}: {valor}
                      </li>
                    )
                  )}
                </ul>
              </div>
            )}
          </div>
        );

      case 'precio':
        return (
          <div className="log-content">
            <div className="log-row">
              <strong>Tipo Usuario:</strong> {log.tipoUsuario?.replace('_', ' ').toUpperCase()}
            </div>
            {log.precioAnterior !== null && log.precioNuevo !== null && (
              <div className="log-row">
                <strong>Precio:</strong> ${log.precioAnterior} → ${log.precioNuevo}
              </div>
            )}
            {log.precioAnterior === null && log.precioNuevo !== null && (
              <div className="log-row">
                <strong>Precio Inicial:</strong> ${log.precioNuevo}
              </div>
            )}
            {log.precioAnterior !== null && log.precioNuevo === null && (
              <div className="log-row">
                <strong>Precio Eliminado:</strong> ${log.precioAnterior}
              </div>
            )}
            {(log.descripcionAnterior || log.descripcionNueva) && (
              <div className="log-row">
                <strong>Descripción:</strong> {log.descripcionNueva || log.descripcionAnterior}
              </div>
            )}
          </div>
        );

      case 'configuracion':
        return (
          <div className="log-content">
            <div className="log-row">
              <strong>Configuración de Empresa</strong>
            </div>
            {log.configuracionAnterior && log.configuracionNueva && (
              <div className="log-changes">
                {Object.keys(log.configuracionNueva).map(campo => {
                  const anterior = log.configuracionAnterior[campo];
                  const nuevo = log.configuracionNueva[campo];
                  if (anterior !== nuevo) {
                    return (
                      <div key={campo} className="log-row">
                        <strong>{campo}:</strong> {anterior || 'N/A'} → {nuevo || 'N/A'}
                      </div>
                    );
                  }
                  return null;
                })}
              </div>
            )}
          </div>
        );

      default:
        return (
          <div className="log-content">
            <pre style={{ fontSize: '0.9rem', overflow: 'auto' }}>
              {JSON.stringify(log, null, 2)}
            </pre>
          </div>
        );
    }
  };

  return (
    <div className="auditoria-logs">
      {/* Header */}
      <div className="listado-header">
        <div>
          <h2>🔍 Auditoría de Logs del Sistema</h2>
          <p>Registro completo de todas las operaciones realizadas en el sistema</p>
        </div>
      </div>

      {/* Estadísticas */}
      <div className="estadisticas-comprobantes" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1.5rem',
        marginBottom: '2rem'
      }}>
        <div className="stat-card" style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          borderRadius: '12px',
          padding: '1.5rem',
          textAlign: 'center'
        }}>
          <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem' }}>📊 Total Logs</h4>
          <p style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0 }}>
            {estadisticas.totalLogs || 0}
          </p>
        </div>

        <div className="stat-card" style={{
          background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
          color: 'white',
          borderRadius: '12px',
          padding: '1.5rem',
          textAlign: 'center'
        }}>
          <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem' }}>💰 Saldo</h4>
          <p style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0 }}>
            {estadisticas.logsSaldo || 0}
          </p>
        </div>

        <div className="stat-card" style={{
          background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
          color: 'white',
          borderRadius: '12px',
          padding: '1.5rem',
          textAlign: 'center'
        }}>
          <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem' }}>🚗 Vehículos</h4>
          <p style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0 }}>
            {estadisticas.logsVehiculo || 0}
          </p>
        </div>

        <div className="stat-card" style={{
          background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
          color: 'white',
          borderRadius: '12px',
          padding: '1.5rem',
          textAlign: 'center'
        }}>
          <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem' }}>💲 Precios</h4>
          <p style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0 }}>
            {estadisticas.logsPrecio || 0}
          </p>
        </div>

        <div className="stat-card" style={{
          background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
          color: 'white',
          borderRadius: '12px',
          padding: '1.5rem',
          textAlign: 'center'
        }}>
          <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem' }}>⚙️ Configuración</h4>
          <p style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0 }}>
            {estadisticas.logsConfiguracion || 0}
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="filtros-comprobantes">
        <h3>🔍 Filtros de Auditoría</h3>
        
        <div className="filtros-grid">
          {/* Tipo de Log */}
          <div className="form-control">
            <label>Tipo de Log:</label>
            <select
              value={filtros.tipoLog}
              onChange={(e) => actualizarFiltro('tipoLog', e.target.value)}
              className="input"
            >
              <option value="todos">Todos los tipos</option>
              <option value="saldo">💰 Logs de Saldo</option>
              <option value="vehiculo">🚗 Logs de Vehículos</option>
              <option value="precio">💲 Logs de Precios</option>
              <option value="configuracion">⚙️ Logs de Configuración</option>
            </select>
          </div>

          {/* Fecha desde */}
          <div className="form-control">
            <label>Fecha desde:</label>
            <input
              type="date"
              value={filtros.fechaDesde}
              onChange={(e) => actualizarFiltro('fechaDesde', e.target.value)}
              className="input"
            />
          </div>

          {/* Fecha hasta */}
          <div className="form-control">
            <label>Fecha hasta:</label>
            <input
              type="date"
              value={filtros.fechaHasta}
              onChange={(e) => actualizarFiltro('fechaHasta', e.target.value)}
              className="input"
            />
          </div>

          {/* Ordenar por */}
          <div className="form-control">
            <label>Ordenar por:</label>
            <select
              value={filtros.ordenPor}
              onChange={(e) => actualizarFiltro('ordenPor', e.target.value)}
              className="input"
            >
              <option value="fecha">Fecha</option>
              <option value="tipo">Tipo de Log</option>
              <option value="usuario">Usuario</option>
            </select>
          </div>

          {/* Orden */}
          <div className="form-control">
            <label>Orden:</label>
            <select
              value={filtros.orden}
              onChange={(e) => actualizarFiltro('orden', e.target.value)}
              className="input"
            >
              <option value="desc">Más recientes</option>
              <option value="asc">Más antiguos</option>
            </select>
          </div>

          {/* Límite por página */}
          <div className="form-control">
            <label>Por página:</label>
            <select
              value={filtros.limite}
              onChange={(e) => actualizarFiltro('limite', e.target.value)}
              className="input"
            >
              <option value="10">10</option>
              <option value="20">20</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
          </div>
        </div>

        {/* Búsqueda */}
        <div className="search-section">
          <div className="form-control">
            <label>Buscar (DNI, nombre, motivo, IP, etc.):</label>
            <input
              type="text"
              value={filtros.busqueda}
              onChange={(e) => actualizarFiltro('busqueda', e.target.value)}
              className="input"
              placeholder="Ingresa el término de búsqueda..."
            />
          </div>
        </div>

        {/* Botones de acción */}
        <div className="filtros-actions">
          <button
            type="button"
            onClick={limpiarFiltros}
            className="button button-secondary"
          >
            🔄 Limpiar Filtros
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="button button-primary"
          >
            ♻️ Actualizar
          </button>
        </div>
      </div>

      {/* Lista de Logs */}
      {loading ? (
        <div className="loading-spinner"></div>
      ) : (
        <>
          <div className="logs-lista">
            {logs.length === 0 ? (
              <div className="no-data">
                <p>📋 No se encontraron logs con los filtros aplicados</p>
                <p>Intenta cambiar los criterios de búsqueda</p>
              </div>
            ) : (
              <div className="logs-grid" style={{
                display: 'grid',
                gap: '1.5rem',
                gridTemplateColumns: '1fr'
              }}>
                {logs.map((log, index) => (
                  <div key={index} className="log-card" style={{
                    background: '#fff',
                    borderRadius: '12px',
                    padding: '2rem',
                    border: '1px solid #e9ecef',
                    boxShadow: '0 4px 8px rgba(0, 0, 0, 0.08)',
                    transition: 'all 0.3s ease'
                  }}>
                    {/* Header del log */}
                    <div className="log-header" style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      marginBottom: '1.5rem',
                      paddingBottom: '1rem',
                      borderBottom: '2px solid #f8f9fa'
                    }}>
                      <div>
                        <h4 style={{ 
                          margin: '0 0 0.5rem 0', 
                          color: '#2c3e50',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem'
                        }}>
                          {formatearTipoLog(log.tipoLog)} - {formatearTipoOperacion(log.tipoOperacion)}
                        </h4>
                        <p style={{ margin: 0, color: '#7f8c8d', fontSize: '0.9rem' }}>
                          {new Date(log.fechaModificacion || log.fecha).toLocaleString()}
                        </p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ margin: 0, fontSize: '0.9rem', color: '#5d6d7e' }}>
                          <strong>Por:</strong> {log.modificadoPor?.nombre || log.usuarioInfo?.nombre} {log.modificadoPor?.apellido || log.usuarioInfo?.apellido}
                        </p>
                        <p style={{ margin: 0, fontSize: '0.8rem', color: '#95a5a6' }}>
                          DNI: {log.modificadoPor?.dni || log.usuarioInfo?.dni}
                        </p>
                        {log.ip && (
                          <p style={{ margin: 0, fontSize: '0.8rem', color: '#95a5a6' }}>
                            IP: {log.ip}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Contenido específico del log */}
                    {renderizarContenidoLog(log)}

                    {/* Motivo */}
                    {log.motivo && (
                      <div className="log-footer" style={{
                        marginTop: '1.5rem',
                        paddingTop: '1rem',
                        borderTop: '1px solid #f8f9fa'
                      }}>
                        <p style={{ margin: 0, color: '#5d6d7e' }}>
                          <strong>Motivo:</strong> {log.motivo}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Paginación */}
          {paginacion.totalPaginas > 1 && (
            <div className="paginacion">
              {/* Botón primera página */}
              <button
                onClick={() => actualizarFiltro('pagina', 1)}
                disabled={paginacion.pagina === 1}
                className="button button-secondary"
                style={{ opacity: paginacion.pagina === 1 ? 0.5 : 1 }}
              >
                ⏮️
              </button>

              {/* Botón página anterior */}
              <button
                onClick={() => actualizarFiltro('pagina', paginacion.pagina - 1)}
                disabled={paginacion.pagina === 1}
                className="button button-secondary"
                style={{ opacity: paginacion.pagina === 1 ? 0.5 : 1 }}
              >
                ⬅️
              </button>

              {/* Números de página */}
              {generarPaginas().map(numeroPagina => (
                <button
                  key={numeroPagina}
                  onClick={() => actualizarFiltro('pagina', numeroPagina)}
                  className={`button ${numeroPagina === paginacion.pagina ? 'button-primary' : 'button-secondary'}`}
                  style={{
                    minWidth: '40px',
                    fontWeight: numeroPagina === paginacion.pagina ? 'bold' : 'normal'
                  }}
                >
                  {numeroPagina}
                </button>
              ))}

              {/* Botón página siguiente */}
              <button
                onClick={() => actualizarFiltro('pagina', paginacion.pagina + 1)}
                disabled={paginacion.pagina === paginacion.totalPaginas}
                className="button button-secondary"
                style={{ opacity: paginacion.pagina === paginacion.totalPaginas ? 0.5 : 1 }}
              >
                ➡️
              </button>

              {/* Botón última página */}
              <button
                onClick={() => actualizarFiltro('pagina', paginacion.totalPaginas)}
                disabled={paginacion.pagina === paginacion.totalPaginas}
                className="button button-secondary"
                style={{ opacity: paginacion.pagina === paginacion.totalPaginas ? 0.5 : 1 }}
              >
                ⏭️
              </button>

              {/* Información de paginación */}
              <span>
                Página {paginacion.pagina} de {paginacion.totalPaginas} 
                ({paginacion.total} total)
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AuditoriaLogs;
