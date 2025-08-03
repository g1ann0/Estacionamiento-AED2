import React, { useState, useEffect } from 'react';
import { facturaService } from '../services/facturaService';
import '../styles/admin.css';

const GestionFacturas = ({ onMensaje }) => {
  const [facturas, setFacturas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filtros, setFiltros] = useState({
    fechaDesde: '',
    fechaHasta: '',
    busqueda: '',
    estado: 'todos',
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
    emitidas: 0,
    anuladas: 0
  });
  const [mostrandoAnulacion, setMostrandoAnulacion] = useState(null);
  const [motivoAnulacion, setMotivoAnulacion] = useState('');

  // Efecto para cargar facturas cuando cambien los filtros
  useEffect(() => {
    const cargarDatos = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('token');
        const response = await facturaService.obtenerFacturas(filtros, token);
        
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

    cargarDatos();
  }, [filtros, onMensaje]);

  // Manejar cambio en filtros
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
      busqueda: '',
      estado: 'todos',
      pagina: 1,
      limite: 20
    });
  };

  // Descargar PDF
  const descargarPDF = async (nroFactura) => {
    try {
      const token = localStorage.getItem('token');
      await facturaService.descargarPDFFactura(nroFactura, token);
      onMensaje({ type: 'success', text: 'PDF descargado exitosamente' });
    } catch (error) {
      console.error('Error al descargar PDF:', error);
      onMensaje({ type: 'error', text: error.message });
    }
  };

  // Anular factura
  const anularFactura = async () => {
    if (!motivoAnulacion.trim()) {
      onMensaje({ type: 'error', text: 'El motivo de anulación es obligatorio' });
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await facturaService.anularFactura(mostrandoAnulacion, motivoAnulacion, token);
      
      onMensaje({ type: 'success', text: 'Factura anulada exitosamente' });
      setMostrandoAnulacion(null);
      setMotivoAnulacion('');
      
      // Recargar facturas
      const token2 = localStorage.getItem('token');
      const response = await facturaService.obtenerFacturas(filtros, token2);
      setFacturas(response.facturas || []);
      setPaginacion(response.paginacion || {});
      setEstadisticas(response.estadisticas || {});
    } catch (error) {
      console.error('Error al anular factura:', error);
      onMensaje({ type: 'error', text: error.message });
    }
  };

  // Calcular días transcurridos desde emisión
  const calcularDiasTranscurridos = (fechaEmision) => {
    const fecha = new Date(fechaEmision);
    const ahora = new Date();
    return Math.floor((ahora - fecha) / (1000 * 60 * 60 * 24));
  };

  // Verificar si se puede anular (ARCA: máximo 15 días)
  const puedeAnular = (fechaEmision) => {
    return calcularDiasTranscurridos(fechaEmision) <= 15;
  };

  // Obtener estilo de estado
  const getEstadoEstilo = (estado) => {
    const estados = {
      'emitida': { texto: 'Emitida', color: '#27ae60', icono: '✅' },
      'anulada': { texto: 'Anulada', color: '#e74c3c', icono: '❌' }
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
    <div className="gestion-facturas">
      <div className="listado-header">
        <div>
          <h2>🧾 Gestión de Facturas</h2>
          <p>Administra todas las facturas generadas automáticamente por comprobantes aprobados</p>
        </div>
      </div>

      {/* Estadísticas */}
      <div className="estadisticas-facturas" style={{ 
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
          <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem' }}>💰 Total Facturado</h4>
          <p style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0 }}>
            ${estadisticas.totalFacturado?.toLocaleString() || 0}
          </p>
        </div>
        
        <div className="stat-card" style={{
          background: 'linear-gradient(135deg, #f39c12 0%, #e67e22 100%)',
          color: 'white',
          borderRadius: '8px',
          padding: '1rem',
          textAlign: 'center'
        }}>
          <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem' }}>💸 Total Anulado</h4>
          <p style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0 }}>
            ${estadisticas.totalAnulado?.toLocaleString() || 0}
          </p>
        </div>
        
        <div className="stat-card" style={{
          background: 'linear-gradient(135deg, #9b59b6 0%, #8e44ad 100%)',
          color: 'white',
          borderRadius: '8px',
          padding: '1rem',
          textAlign: 'center'
        }}>
          <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem' }}>📄 Total Facturas</h4>
          <p style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0 }}>
            {estadisticas.cantidadFacturas || 0}
          </p>
        </div>
        
        <div className="stat-card" style={{
          background: 'linear-gradient(135deg, #27ae60 0%, #229954 100%)',
          color: 'white',
          borderRadius: '8px',
          padding: '1rem',
          textAlign: 'center'
        }}>
          <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem' }}>✅ Emitidas</h4>
          <p style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0 }}>
            {estadisticas.emitidas || 0}
          </p>
        </div>
        
        <div className="stat-card" style={{
          background: 'linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)',
          color: 'white',
          borderRadius: '8px',
          padding: '1rem',
          textAlign: 'center'
        }}>
          <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem' }}>❌ Anuladas</h4>
          <p style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0 }}>
            {estadisticas.anuladas || 0}
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="filtros-facturas" style={{
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
              <option value="emitida">Emitidas</option>
              <option value="anulada">Anuladas</option>
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
          <label>Buscar (Nº factura, DNI, nombre o comprobante):</label>
          <input
            type="text"
            value={filtros.busqueda}
            onChange={(e) => actualizarFiltro('busqueda', e.target.value)}
            className="input"
            placeholder="Escriba para buscar..."
          />
        </div>

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
          <p>Cargando facturas...</p>
        </div>
      )}

      {/* Lista de facturas */}
      {!loading && (
        <>
          <div className="facturas-lista">
            {facturas.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem' }}>
                <p>No se encontraron facturas con los filtros aplicados.</p>
              </div>
            ) : (
              <div className="grid-container">
                {facturas.map(factura => {
                  const estadoInfo = getEstadoEstilo(factura.estado);
                  const diasTranscurridos = calcularDiasTranscurridos(factura.fechaEmision);
                  const puedeAnularFactura = puedeAnular(factura.fechaEmision);
                  
                  return (
                    <div key={factura.nroFactura} className="factura-card" style={{
                      background: '#fff',
                      border: '1px solid #e9ecef',
                      borderRadius: '8px',
                      padding: '1.5rem',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                    }}>
                      <div className="factura-header" style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '1rem'
                      }}>
                        <h4 style={{ margin: 0 }}>📄 {factura.nroFactura}</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.3rem' }}>
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
                          {factura.estado === 'emitida' && (
                            <span style={{
                              fontSize: '0.7rem',
                              color: diasTranscurridos > 15 ? '#e74c3c' : diasTranscurridos > 10 ? '#f39c12' : '#27ae60',
                              fontWeight: 'bold'
                            }}>
                              {diasTranscurridos > 15 
                                ? `❌ Plazo vencido (${diasTranscurridos} días)`
                                : `⏰ ${15 - diasTranscurridos} días para anular`
                              }
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="info-row">
                        <strong>Cliente:</strong> {factura.cliente.nombre} {factura.cliente.apellido}
                      </div>
                      <div className="info-row">
                        <strong>DNI:</strong> {factura.cliente.dni}
                      </div>
                      <div className="info-row">
                        <strong>Total:</strong> 
                        <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#27ae60' }}>
                          ${factura.total.toLocaleString()}
                        </span>
                      </div>
                      <div className="info-row">
                        <strong>Fecha:</strong> {new Date(factura.fechaEmision).toLocaleString()}
                      </div>
                      <div className="info-row">
                        <strong>Comprobante:</strong> {factura.comprobanteRelacionado.nroComprobante}
                      </div>
                      <div className="info-row">
                        <strong>Generada por:</strong> {factura.generadaPor.nombre} {factura.generadaPor.apellido}
                      </div>

                      {/* Acciones */}
                      <div className="action-buttons" style={{ marginTop: '1rem' }}>
                        <button
                          className="button button-primary"
                          onClick={() => descargarPDF(factura.nroFactura)}
                          style={{ marginRight: '0.5rem' }}
                        >
                          📄 Descargar PDF
                        </button>
                        
                        {factura.estado === 'emitida' && (
                          <>
                            {puedeAnularFactura ? (
                              <button
                                className="button button-danger"
                                onClick={() => setMostrandoAnulacion(factura.nroFactura)}
                              >
                                ❌ Anular
                              </button>
                            ) : (
                              <button
                                className="button button-secondary"
                                disabled
                                title={`No se puede anular. Han transcurrido ${diasTranscurridos} días (máximo 15 según ARCA)`}
                                style={{ 
                                  opacity: 0.6, 
                                  cursor: 'not-allowed',
                                  backgroundColor: '#6c757d'
                                }}
                              >
                                🚫 No anulable
                              </button>
                            )}
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
              <button
                onClick={() => actualizarFiltro('pagina', 1)}
                disabled={paginacion.pagina === 1}
                className="button button-secondary"
                style={{ opacity: paginacion.pagina === 1 ? 0.5 : 1 }}
              >
                ⏮️
              </button>

              <button
                onClick={() => actualizarFiltro('pagina', paginacion.pagina - 1)}
                disabled={paginacion.pagina === 1}
                className="button button-secondary"
                style={{ opacity: paginacion.pagina === 1 ? 0.5 : 1 }}
              >
                ⬅️
              </button>

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

              <button
                onClick={() => actualizarFiltro('pagina', paginacion.pagina + 1)}
                disabled={paginacion.pagina === paginacion.totalPaginas}
                className="button button-secondary"
                style={{ opacity: paginacion.pagina === paginacion.totalPaginas ? 0.5 : 1 }}
              >
                ➡️
              </button>

              <button
                onClick={() => actualizarFiltro('pagina', paginacion.totalPaginas)}
                disabled={paginacion.pagina === paginacion.totalPaginas}
                className="button button-secondary"
                style={{ opacity: paginacion.pagina === paginacion.totalPaginas ? 0.5 : 1 }}
              >
                ⏭️
              </button>

              <span style={{ marginLeft: '1rem', color: '#7f8c8d' }}>
                Página {paginacion.pagina} de {paginacion.totalPaginas} 
                ({paginacion.total} total)
              </span>
            </div>
          )}
        </>
      )}

      {/* Modal de anulación */}
      {mostrandoAnulacion && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            borderRadius: '8px',
            padding: '2rem',
            maxWidth: '500px',
            width: '90%'
          }}>
            <h3>Anular Factura {mostrandoAnulacion}</h3>
            <p>Esta acción no se puede deshacer. Ingrese el motivo de la anulación:</p>
            
            <textarea
              value={motivoAnulacion}
              onChange={(e) => setMotivoAnulacion(e.target.value)}
              className="input"
              rows="3"
              placeholder="Motivo de anulación..."
              style={{ width: '100%', marginBottom: '1rem' }}
            />
            
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setMostrandoAnulacion(null);
                  setMotivoAnulacion('');
                }}
                className="button button-secondary"
              >
                Cancelar
              </button>
              <button
                onClick={anularFactura}
                className="button button-danger"
              >
                Anular Factura
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GestionFacturas;
