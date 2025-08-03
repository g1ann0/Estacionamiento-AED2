import React, { useState, useEffect } from 'react';
import { comprobanteService } from '../services/comprobanteService';
import '../styles/admin.css';

const ListadoComprobantes = ({ onMensaje }) => {
  const [comprobantes, setComprobantes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filtros, setFiltros] = useState({
    estado: 'todos',
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
    totalMonto: 0,
    pendientes: 0,
    aprobados: 0,
    rechazados: 0
  });

  // Efecto para cargar comprobantes cuando cambien los filtros
  useEffect(() => {
    const cargarDatos = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('token');
        const response = await comprobanteService.obtenerTodosLosComprobantes(filtros, token);
        
        setComprobantes(response.comprobantes || []);
        setPaginacion(response.paginacion || {});
        setEstadisticas(response.estadisticas || {});
      } catch (error) {
        console.error('Error al cargar comprobantes:', error);
        onMensaje({ type: 'error', text: error.message });
      } finally {
        setLoading(false);
      }
    };

    cargarDatos();
  }, [filtros, onMensaje]);

  // Manejar cambio en filtros
  const actualizarFiltro = (campo, valor) => {
    setFiltros(prev => ({
      ...prev,
      [campo]: valor,
      pagina: campo !== 'pagina' ? 1 : valor // Resetear página si no es cambio de página
    }));
  };

  // Limpiar filtros
  const limpiarFiltros = () => {
    setFiltros({
      estado: 'todos',
      fechaDesde: '',
      fechaHasta: '',
      busqueda: '',
      pagina: 1,
      limite: 20,
      ordenPor: 'fecha',
      orden: 'desc'
    });
  };

  // Validar comprobante
  const validarComprobante = async (nroComprobante) => {
    if (!window.confirm('¿Estás seguro de que deseas validar este comprobante?')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:3000/api/admin/comprobantes/${nroComprobante}/validar`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (response.ok) {
        let mensaje = 'Comprobante aprobado exitosamente. El saldo del usuario ha sido actualizado.';
        
        if (data.facturaGenerada) {
          mensaje += ` Se generó la factura ${data.facturaGenerada.nroFactura} por $${data.facturaGenerada.total.toLocaleString()}.`;
        }
        
        onMensaje({ 
          type: 'success', 
          text: mensaje
        });
        
        // Recargar lista usando los mismos datos del useEffect
        const token = localStorage.getItem('token');
        const response2 = await comprobanteService.obtenerTodosLosComprobantes(filtros, token);
        setComprobantes(response2.comprobantes || []);
        setPaginacion(response2.paginacion || {});
        setEstadisticas(response2.estadisticas || {});
      } else {
        onMensaje({ type: 'error', text: data.mensaje || 'Error al validar comprobante' });
      }
    } catch (error) {
      console.error('Error al validar comprobante:', error);
      onMensaje({ type: 'error', text: error.message });
    }
  };

  // Rechazar comprobante
  const rechazarComprobante = async (nroComprobante) => {
    if (!window.confirm('¿Estás seguro de que deseas rechazar este comprobante?')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await comprobanteService.rechazarComprobante(nroComprobante, token);
      
      onMensaje({ 
        type: 'success', 
        text: 'Comprobante rechazado' 
      });
      
      // Recargar lista
      const response = await comprobanteService.obtenerTodosLosComprobantes(filtros, token);
      setComprobantes(response.comprobantes || []);
      setPaginacion(response.paginacion || {});
      setEstadisticas(response.estadisticas || {});
    } catch (error) {
      console.error('Error al rechazar comprobante:', error);
      onMensaje({ type: 'error', text: error.message });
    }
  };

  // Descargar PDF del comprobante
  const descargarPDFComprobante = async (nroComprobante) => {
    try {
      const token = localStorage.getItem('token');
      await comprobanteService.descargarPDFComprobante(nroComprobante, token);
      onMensaje({ type: 'success', text: 'PDF del comprobante descargado exitosamente' });
    } catch (error) {
      console.error('Error al descargar PDF:', error);
      onMensaje({ type: 'error', text: error.message });
    }
  };

  // Formatear estado para mostrar
  const formatearEstado = (estado) => {
    const estados = {
      'pendiente': { texto: 'Pendiente', color: '#f39c12', icono: '⏳' },
      'aprobado': { texto: 'Aprobado', color: '#27ae60', icono: '✅' },
      'rechazado': { texto: 'Rechazado', color: '#e74c3c', icono: '❌' }
    };
    return estados[estado] || { texto: estado, color: '#95a5a6', icono: '❓' };
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

  return (
    <div className="listado-comprobantes">
      <div className="listado-header">
        <div>
          <h2>📋 Listado Completo de Comprobantes</h2>
          <p>Gestiona todos los comprobantes del sistema con filtros avanzados</p>
        </div>
      </div>

      {/* Estadísticas */}
      <div className="estadisticas-comprobantes" style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
        gap: '1rem', 
        marginBottom: '1.5rem' 
      }}>
        <div className="stat-card" style={{
          background: 'linear-gradient(135deg, #3498db 0%, #2980b9 100%)',
          color: 'white',
          borderRadius: '8px',
          padding: '1rem',
          textAlign: 'center'
        }}>
          <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem' }}>💰 Monto Total</h4>
          <p style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0 }}>
            ${estadisticas.totalMonto?.toLocaleString() || 0}
          </p>
        </div>
        
        <div className="stat-card" style={{
          background: 'linear-gradient(135deg, #f39c12 0%, #e67e22 100%)',
          color: 'white',
          borderRadius: '8px',
          padding: '1rem',
          textAlign: 'center'
        }}>
          <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem' }}>⏳ Pendientes</h4>
          <p style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0 }}>
            {estadisticas.pendientes || 0}
          </p>
        </div>
        
        <div className="stat-card" style={{
          background: 'linear-gradient(135deg, #27ae60 0%, #229954 100%)',
          color: 'white',
          borderRadius: '8px',
          padding: '1rem',
          textAlign: 'center'
        }}>
          <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem' }}>✅ Aprobados</h4>
          <p style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0 }}>
            {estadisticas.aprobados || 0}
          </p>
        </div>
        
        <div className="stat-card" style={{
          background: 'linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)',
          color: 'white',
          borderRadius: '8px',
          padding: '1rem',
          textAlign: 'center'
        }}>
          <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem' }}>❌ Rechazados</h4>
          <p style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0 }}>
            {estadisticas.rechazados || 0}
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="filtros-comprobantes" style={{
        background: '#f8f9fa',
        border: '1px solid #e9ecef',
        borderRadius: '8px',
        padding: '1.5rem',
        marginBottom: '1.5rem'
      }}>
        <h3 style={{ margin: '0 0 1rem 0', color: '#2c3e50' }}>🔍 Filtros de Búsqueda</h3>
        
        <div className="filtros-grid" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
          marginBottom: '1rem'
        }}>
          {/* Estado */}
          <div className="form-control">
            <label>Estado:</label>
            <select
              value={filtros.estado}
              onChange={(e) => actualizarFiltro('estado', e.target.value)}
              className="input"
            >
              <option value="todos">Todos los estados</option>
              <option value="pendiente">Pendientes</option>
              <option value="aprobado">Aprobados</option>
              <option value="rechazado">Rechazados</option>
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
              <option value="monto">Monto</option>
              <option value="estado">Estado</option>
              <option value="comprobante">Nº Comprobante</option>
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
              <option value="desc">Descendente</option>
              <option value="asc">Ascendente</option>
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
        <div className="form-control" style={{ marginBottom: '1rem' }}>
          <label>Buscar (Nº comprobante, DNI, nombre o apellido):</label>
          <input
            type="text"
            value={filtros.busqueda}
            onChange={(e) => actualizarFiltro('busqueda', e.target.value)}
            className="input"
            placeholder="Escriba para buscar..."
          />
        </div>

        {/* Botón limpiar filtros */}
        <button 
          onClick={limpiarFiltros}
          className="button button-secondary"
          style={{ marginTop: '0.5rem' }}
        >
          🗑️ Limpiar Filtros
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <div className="spinner"></div>
          <p>Cargando comprobantes...</p>
        </div>
      )}

      {/* Lista de comprobantes */}
      {!loading && (
        <>
          <div className="comprobantes-lista">
            {comprobantes.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem' }}>
                <p>No se encontraron comprobantes con los filtros aplicados.</p>
              </div>
            ) : (
              <div className="grid-container">
                {comprobantes.map(comprobante => {
                  const estadoInfo = formatearEstado(comprobante.estado);
                  
                  return (
                    <div key={comprobante.nroComprobante} className="comprobante-card">
                      <div className="comprobante-header" style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '1rem'
                      }}>
                        <h4 style={{ margin: 0 }}>#{comprobante.nroComprobante}</h4>
                        <span style={{
                          background: estadoInfo.color,
                          color: 'white',
                          padding: '0.3rem 0.8rem',
                          borderRadius: '20px',
                          fontSize: '0.8rem',
                          fontWeight: 'bold',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.3rem'
                        }}>
                          {estadoInfo.icono} {estadoInfo.texto}
                        </span>
                      </div>

                      <div className="info-row">
                        <strong>Usuario:</strong> {comprobante.usuario.nombre} {comprobante.usuario.apellido}
                      </div>
                      <div className="info-row">
                        <strong>DNI:</strong> {comprobante.usuario.dni}
                      </div>
                      <div className="info-row">
                        <strong>Monto:</strong> 
                        <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#27ae60' }}>
                          ${comprobante.montoAcreditado.toLocaleString()}
                        </span>
                      </div>
                      <div className="info-row">
                        <strong>Fecha:</strong> {new Date(comprobante.fecha).toLocaleString()}
                      </div>

                      {/* Acciones */}
                      <div className="action-buttons" style={{ marginTop: '1rem' }}>
                        {/* Botón de descargar PDF siempre disponible */}
                        <button
                          className="button button-primary"
                          onClick={() => descargarPDFComprobante(comprobante.nroComprobante)}
                        >
                          📄 Descargar PDF
                        </button>
                        
                        {/* Acciones solo para pendientes */}
                        {comprobante.estado === 'pendiente' && (
                          <>
                            <button
                              className="button button-success"
                              onClick={() => validarComprobante(comprobante.nroComprobante)}
                            >
                              ✅ Aprobar
                            </button>
                            <button
                              className="button button-danger"
                              onClick={() => rechazarComprobante(comprobante.nroComprobante)}
                            >
                              ❌ Rechazar
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Paginación */}
          {paginacion.totalPaginas > 1 && (
            <div className="paginacion" style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '0.5rem',
              marginTop: '2rem',
              padding: '1rem'
            }}>
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
              <span style={{ marginLeft: '1rem', color: '#7f8c8d' }}>
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

export default ListadoComprobantes;
