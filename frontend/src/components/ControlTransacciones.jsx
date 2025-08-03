import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  obtenerIngresos, 
  obtenerEgresos, 
  obtenerEstadisticasTransacciones 
} from '../services/adminGestionService';
import '../styles/admin.css';

const ControlTransacciones = () => {
  const navigate = useNavigate();
  const [vistaActual, setVistaActual] = useState('ingresos');
  const [ingresos, setIngresos] = useState([]);
  const [egresos, setEgresos] = useState([]);
  const [estadisticas, setEstadisticas] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  
  // Estados para filtros
  const [filtros, setFiltros] = useState({
    fechaDesde: '',
    fechaHasta: '',
    dominio: '',
    dniPropietario: '',
    porton: '',
    tipoVehiculo: '',
    limite: 50,
    pagina: 1
  });

  // Estados para paginación
  const [paginacion, setPaginacion] = useState({
    total: 0,
    pagina: 1,
    limite: 50,
    totalPaginas: 1
  });

  useEffect(() => {
    cargarDatos();
  }, [vistaActual, filtros]);

  useEffect(() => {
    cargarEstadisticas();
  }, []);

  const cargarDatos = async () => {
    try {
      setCargando(true);
      setError('');
      
      if (vistaActual === 'ingresos') {
        const response = await obtenerIngresos(filtros);
        setIngresos(response.ingresos);
        setPaginacion(response.pagination);
      } else if (vistaActual === 'egresos') {
        const response = await obtenerEgresos(filtros);
        setEgresos(response.egresos);
        setPaginacion(response.pagination);
      }
    } catch (error) {
      setError('Error al cargar datos: ' + error.message);
    } finally {
      setCargando(false);
    }
  };

  const cargarEstadisticas = async () => {
    try {
      const response = await obtenerEstadisticasTransacciones({
        fechaDesde: filtros.fechaDesde,
        fechaHasta: filtros.fechaHasta
      });
      setEstadisticas(response.estadisticas);
    } catch (error) {
      console.error('Error al cargar estadísticas:', error);
    }
  };

  const manejarCambioFiltro = (campo, valor) => {
    setFiltros({
      ...filtros,
      [campo]: valor,
      pagina: 1 // Resetear a página 1 cuando cambian los filtros
    });
  };

  const limpiarFiltros = () => {
    setFiltros({
      fechaDesde: '',
      fechaHasta: '',
      dominio: '',
      dniPropietario: '',
      porton: '',
      tipoVehiculo: '',
      limite: 50,
      pagina: 1
    });
  };

  const cambiarPagina = (nuevaPagina) => {
    setFiltros({
      ...filtros,
      pagina: nuevaPagina
    });
  };

  const formatearFecha = (fecha) => {
    return new Date(fecha).toLocaleString('es-AR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatearDuracion = (duracion) => {
    if (!duracion) return '-';
    const horas = Math.floor(duracion);
    const minutos = Math.round((duracion - horas) * 60);
    return `${horas}h ${minutos}m`;
  };

  const renderFiltros = () => (
    <div className="filtros-container" style={{
      backgroundColor: 'white',
      borderRadius: '12px',
      padding: '2rem',
      marginBottom: '2rem',
      boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
      border: '1px solid #e9ecef'
    }}>
      <h3 style={{ color: '#2c3e50', marginBottom: '1.5rem' }}>Filtros de Búsqueda</h3>
      <div className="filtros-grid" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1rem',
        marginBottom: '1.5rem'
      }}>
        <div className="filtro-grupo">
          <label style={{ 
            display: 'block', 
            fontWeight: 'bold', 
            marginBottom: '0.5rem', 
            color: '#2c3e50' 
          }}>
            Fecha Desde:
          </label>
          <input
            type="date"
            className="form-control"
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '1rem'
            }}
            value={filtros.fechaDesde}
            onChange={(e) => manejarCambioFiltro('fechaDesde', e.target.value)}
          />
        </div>

        <div className="filtro-grupo">
          <label style={{ 
            display: 'block', 
            fontWeight: 'bold', 
            marginBottom: '0.5rem', 
            color: '#2c3e50' 
          }}>
            Fecha Hasta:
          </label>
          <input
            type="date"
            className="form-control"
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '1rem'
            }}
            value={filtros.fechaHasta}
            onChange={(e) => manejarCambioFiltro('fechaHasta', e.target.value)}
          />
        </div>

        <div className="filtro-grupo">
          <label style={{ 
            display: 'block', 
            fontWeight: 'bold', 
            marginBottom: '0.5rem', 
            color: '#2c3e50' 
          }}>
            Dominio:
          </label>
          <input
            type="text"
            className="form-control"
            placeholder="ABC123"
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '1rem'
            }}
            value={filtros.dominio}
            onChange={(e) => manejarCambioFiltro('dominio', e.target.value.toUpperCase())}
          />
        </div>

        <div className="filtro-grupo">
          <label style={{ 
            display: 'block', 
            fontWeight: 'bold', 
            marginBottom: '0.5rem', 
            color: '#2c3e50' 
          }}>
            DNI Propietario:
          </label>
          <input
            type="text"
            className="form-control"
            placeholder="12345678"
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '1rem'
            }}
            value={filtros.dniPropietario}
            onChange={(e) => manejarCambioFiltro('dniPropietario', e.target.value)}
          />
        </div>

        <div className="filtro-grupo">
          <label style={{ 
            display: 'block', 
            fontWeight: 'bold', 
            marginBottom: '0.5rem', 
            color: '#2c3e50' 
          }}>
            Portón:
          </label>
          <select
            className="form-control"
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '1rem'
            }}
            value={filtros.porton}
            onChange={(e) => manejarCambioFiltro('porton', e.target.value)}
          >
            <option value="">Todos</option>
            <option value="Norte">Norte</option>
            <option value="Sur">Sur</option>
            <option value="Este">Este</option>
            <option value="Oeste">Oeste</option>
          </select>
        </div>

        <div className="filtro-grupo">
          <label style={{ 
            display: 'block', 
            fontWeight: 'bold', 
            marginBottom: '0.5rem', 
            color: '#2c3e50' 
          }}>
            Tipo Vehículo:
          </label>
          <select
            className="form-control"
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '1rem'
            }}
            value={filtros.tipoVehiculo}
            onChange={(e) => manejarCambioFiltro('tipoVehiculo', e.target.value)}
          >
            <option value="">Todos</option>
            <option value="auto">Auto</option>
            <option value="moto">Moto</option>
          </select>
        </div>
      </div>
      
      <div className="filtros-acciones" style={{
        display: 'flex',
        gap: '1rem',
        justifyContent: 'center'
      }}>
        <button 
          className="btn btn-secondary" 
          style={{
            backgroundColor: '#6c757d',
            color: 'white',
            border: '1px solid #6c757d',
            padding: '0.75rem 1.5rem',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 'bold',
            transition: 'all 0.2s ease'
          }}
          onClick={limpiarFiltros}
        >
          Limpiar Filtros
        </button>
        <button 
          className="btn btn-primary" 
          style={{
            backgroundColor: '#007bff',
            color: 'white',
            border: '1px solid #007bff',
            padding: '0.75rem 1.5rem',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 'bold',
            transition: 'all 0.2s ease'
          }}
          onClick={cargarEstadisticas}
        >
          Actualizar Estadísticas
        </button>
      </div>
    </div>
  );

  const renderEstadisticas = () => {
    if (!estadisticas) return null;

    return (
      <div className="estadisticas-container" style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '2rem',
        marginBottom: '2rem',
        boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
        border: '1px solid #e9ecef'
      }}>
        <h3 style={{ color: '#2c3e50', marginBottom: '1.5rem' }}>Estadísticas del Estacionamiento</h3>
        <div className="estadisticas-grid" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1.5rem'
        }}>
          <div className="estadistica-card" style={{
            backgroundColor: '#e3f2fd',
            padding: '1.5rem',
            borderRadius: '8px',
            textAlign: 'center',
            border: '1px solid #bbdefb'
          }}>
            <h4 style={{ color: '#1976d2', margin: '0 0 0.5rem 0' }}>Vehículos Actualmente</h4>
            <p className="estadistica-numero" style={{ 
              fontSize: '2rem', 
              fontWeight: 'bold', 
              color: '#1976d2',
              margin: 0 
            }}>
              {estadisticas.resumen.vehiculosActualmente}
            </p>
          </div>
          <div className="estadistica-card" style={{
            backgroundColor: '#e8f5e8',
            padding: '1.5rem',
            borderRadius: '8px',
            textAlign: 'center',
            border: '1px solid #c8e6c9'
          }}>
            <h4 style={{ color: '#388e3c', margin: '0 0 0.5rem 0' }}>Total Ingresos</h4>
            <p className="estadistica-numero" style={{ 
              fontSize: '2rem', 
              fontWeight: 'bold', 
              color: '#388e3c',
              margin: 0 
            }}>
              {estadisticas.resumen.totalIngresos}
            </p>
          </div>
          <div className="estadistica-card" style={{
            backgroundColor: '#ffebee',
            padding: '1.5rem',
            borderRadius: '8px',
            textAlign: 'center',
            border: '1px solid #ffcdd2'
          }}>
            <h4 style={{ color: '#d32f2f', margin: '0 0 0.5rem 0' }}>Total Egresos</h4>
            <p className="estadistica-numero" style={{ 
              fontSize: '2rem', 
              fontWeight: 'bold', 
              color: '#d32f2f',
              margin: 0 
            }}>
              {estadisticas.resumen.totalEgresos}
            </p>
          </div>
          <div className="estadistica-card" style={{
            backgroundColor: '#fff3e0',
            padding: '1.5rem',
            borderRadius: '8px',
            textAlign: 'center',
            border: '1px solid #ffcc02'
          }}>
            <h4 style={{ color: '#f57c00', margin: '0 0 0.5rem 0' }}>Recaudación Total</h4>
            <p className="estadistica-numero" style={{ 
              fontSize: '2rem', 
              fontWeight: 'bold', 
              color: '#f57c00',
              margin: 0 
            }}>
              ${estadisticas.resumen.totalRecaudado?.toFixed(2) || '0.00'}
            </p>
          </div>
          <div className="estadistica-card" style={{
            backgroundColor: '#f3e5f5',
            padding: '1.5rem',
            borderRadius: '8px',
            textAlign: 'center',
            border: '1px solid #ce93d8'
          }}>
            <h4 style={{ color: '#7b1fa2', margin: '0 0 0.5rem 0' }}>Promedio Estadía</h4>
            <p className="estadistica-numero" style={{ 
              fontSize: '2rem', 
              fontWeight: 'bold', 
              color: '#7b1fa2',
              margin: 0 
            }}>
              {formatearDuracion(estadisticas.resumen.promedioEstadia)}
            </p>
          </div>
        </div>
      </div>
    );
  };

  const renderIngresos = () => (
    <div className="transacciones-section">
      <h3 style={{ color: '#2c3e50', marginBottom: '1.5rem' }}>Ingresos al Estacionamiento</h3>
      
      {cargando && <p style={{ textAlign: 'center', color: '#666' }}>Cargando ingresos...</p>}
      
      <div className="transacciones-list" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
        gap: '1.5rem'
      }}>
        {ingresos.map(ingreso => (
          <div key={ingreso._id} className="transaccion-card ingreso" style={{
            background: 'linear-gradient(135deg, #e8f5e8 0%, #ffffff 100%)',
            border: '1px solid #c8e6c9',
            borderRadius: '12px',
            padding: '1.5rem',
            boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
            transition: 'all 0.3s ease'
          }}>
            <div className="transaccion-header" style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1rem',
              borderBottom: '2px solid #e8f5e8',
              paddingBottom: '0.5rem'
            }}>
              <h4 style={{ 
                color: '#2c3e50', 
                margin: 0,
                fontSize: '1.3rem',
                fontWeight: 'bold'
              }}>
                {ingreso.vehiculo.dominio}
              </h4>
              <span className="badge badge-success" style={{
                backgroundColor: '#28a745',
                color: 'white',
                padding: '0.25rem 0.75rem',
                borderRadius: '20px',
                fontSize: '0.8rem',
                fontWeight: 'bold',
                textTransform: 'uppercase'
              }}>
                📥 INGRESO
              </span>
            </div>
            <div className="transaccion-details">
              <p style={{ color: '#34495e', marginBottom: '0.5rem' }}>
                <strong style={{ color: '#2c3e50' }}>Fecha/Hora:</strong> {formatearFecha(ingreso.fechaHora)}
              </p>
              <p style={{ color: '#34495e', marginBottom: '0.5rem' }}>
                <strong style={{ color: '#2c3e50' }}>Vehículo:</strong> 
                <span style={{ 
                  backgroundColor: ingreso.vehiculo.tipo === 'auto' ? '#17a2b8' : '#ffc107',
                  color: ingreso.vehiculo.tipo === 'moto' ? '#212529' : 'white',
                  padding: '2px 6px',
                  borderRadius: '10px',
                  fontSize: '0.8rem',
                  marginLeft: '0.5rem'
                }}>
                  {ingreso.vehiculo.tipo}
                </span>
                <br />
                {ingreso.vehiculo.marca} {ingreso.vehiculo.modelo}
              </p>
              <p style={{ color: '#34495e', marginBottom: '0.5rem' }}>
                <strong style={{ color: '#2c3e50' }}>Propietario:</strong> 
                <span style={{ color: '#007bff', fontWeight: 'bold' }}>
                  {ingreso.propietario.nombre} {ingreso.propietario.apellido}
                </span>
                <br />
                <small style={{ color: '#6c757d' }}>DNI: {ingreso.propietario.dni}</small>
              </p>
              <p style={{ color: '#34495e', marginBottom: '0.5rem' }}>
                <strong style={{ color: '#2c3e50' }}>Portón:</strong> 
                <span style={{ 
                  backgroundColor: '#6c757d',
                  color: 'white',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  fontSize: '0.8rem',
                  marginLeft: '0.5rem'
                }}>
                  {ingreso.porton}
                </span>
              </p>
              <p style={{ color: '#34495e', marginBottom: '0.5rem' }}>
                <strong style={{ color: '#2c3e50' }}>Tarifa:</strong> 
                <span style={{ 
                  color: '#28a745',
                  fontWeight: 'bold',
                  fontSize: '1.1rem'
                }}>
                  ${ingreso.tarifa}/hora
                </span>
              </p>
              <p style={{ color: '#34495e', marginBottom: '0' }}>
                <strong style={{ color: '#2c3e50' }}>Estado:</strong> 
                <span className={`estado ${ingreso.estado}`} style={{
                  color: ingreso.estado === 'activo' ? '#28a745' : '#6c757d',
                  fontWeight: 'bold',
                  textTransform: 'capitalize'
                }}>
                  {ingreso.estado}
                </span>
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderEgresos = () => (
    <div className="transacciones-section">
      <h3 style={{ color: '#2c3e50', marginBottom: '1.5rem' }}>Egresos del Estacionamiento</h3>
      
      {cargando && <p style={{ textAlign: 'center', color: '#666' }}>Cargando egresos...</p>}
      
      <div className="transacciones-list" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
        gap: '1.5rem'
      }}>
        {egresos.map(egreso => (
          <div key={egreso._id} className="transaccion-card egreso" style={{
            background: 'linear-gradient(135deg, #ffebee 0%, #ffffff 100%)',
            border: '1px solid #ffcdd2',
            borderRadius: '12px',
            padding: '1.5rem',
            boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
            transition: 'all 0.3s ease'
          }}>
            <div className="transaccion-header" style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1rem',
              borderBottom: '2px solid #ffebee',
              paddingBottom: '0.5rem'
            }}>
              <h4 style={{ 
                color: '#2c3e50', 
                margin: 0,
                fontSize: '1.3rem',
                fontWeight: 'bold'
              }}>
                {egreso.vehiculo.dominio}
              </h4>
              <span className="badge badge-danger" style={{
                backgroundColor: '#dc3545',
                color: 'white',
                padding: '0.25rem 0.75rem',
                borderRadius: '20px',
                fontSize: '0.8rem',
                fontWeight: 'bold',
                textTransform: 'uppercase'
              }}>
                📤 EGRESO
              </span>
            </div>
            <div className="transaccion-details">
              <p style={{ color: '#34495e', marginBottom: '0.5rem' }}>
                <strong style={{ color: '#2c3e50' }}>Fecha/Hora:</strong> {formatearFecha(egreso.fechaHora)}
              </p>
              <p style={{ color: '#34495e', marginBottom: '0.5rem' }}>
                <strong style={{ color: '#2c3e50' }}>Vehículo:</strong> 
                <span style={{ 
                  backgroundColor: egreso.vehiculo.tipo === 'auto' ? '#17a2b8' : '#ffc107',
                  color: egreso.vehiculo.tipo === 'moto' ? '#212529' : 'white',
                  padding: '2px 6px',
                  borderRadius: '10px',
                  fontSize: '0.8rem',
                  marginLeft: '0.5rem'
                }}>
                  {egreso.vehiculo.tipo}
                </span>
                <br />
                {egreso.vehiculo.marca} {egreso.vehiculo.modelo}
              </p>
              <p style={{ color: '#34495e', marginBottom: '0.5rem' }}>
                <strong style={{ color: '#2c3e50' }}>Propietario:</strong> 
                <span style={{ color: '#007bff', fontWeight: 'bold' }}>
                  {egreso.propietario.nombre} {egreso.propietario.apellido}
                </span>
                <br />
                <small style={{ color: '#6c757d' }}>DNI: {egreso.propietario.dni}</small>
              </p>
              <p style={{ color: '#34495e', marginBottom: '0.5rem' }}>
                <strong style={{ color: '#2c3e50' }}>Portón:</strong> 
                <span style={{ 
                  backgroundColor: '#6c757d',
                  color: 'white',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  fontSize: '0.8rem',
                  marginLeft: '0.5rem'
                }}>
                  {egreso.porton}
                </span>
              </p>
              <p style={{ color: '#34495e', marginBottom: '0.5rem' }}>
                <strong style={{ color: '#2c3e50' }}>Duración:</strong> 
                <span style={{ 
                  backgroundColor: '#17a2b8',
                  color: 'white',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  fontSize: '0.9rem',
                  fontWeight: 'bold',
                  marginLeft: '0.5rem'
                }}>
                  {egreso.duracion || formatearDuracion(egreso.duracionHorasReal)}
                </span>
              </p>
              <p style={{ color: '#34495e', marginBottom: '0.5rem' }}>
                <strong style={{ color: '#2c3e50' }}>Tarifa:</strong> 
                <span style={{ 
                  color: '#28a745',
                  fontWeight: 'bold',
                  fontSize: '1.1rem'
                }}>
                  ${egreso.tarifa}/hora
                </span>
              </p>
              <p style={{ color: '#34495e', marginBottom: '0.5rem' }}>
                <strong style={{ color: '#2c3e50' }}>Monto Total:</strong> 
                <span className="monto-total" style={{
                  backgroundColor: '#f57c00',
                  color: 'white',
                  padding: '4px 12px',
                  borderRadius: '20px',
                  fontSize: '1.1rem',
                  fontWeight: 'bold',
                  marginLeft: '0.5rem'
                }}>
                  ${egreso.montoTotal}
                </span>
              </p>
              <p style={{ color: '#34495e', marginBottom: '0' }}>
                <strong style={{ color: '#2c3e50' }}>Estado:</strong> 
                <span className={`estado ${egreso.estado}`} style={{
                  color: egreso.estado === 'completado' ? '#28a745' : '#6c757d',
                  fontWeight: 'bold',
                  textTransform: 'capitalize'
                }}>
                  {egreso.estado}
                </span>
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderPaginacion = () => {
    if (paginacion.totalPaginas <= 1) return null;

    return (
      <div className="paginacion" style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '1rem',
        marginTop: '2rem',
        backgroundColor: 'white',
        padding: '1rem',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
      }}>
        <button 
          className="btn btn-secondary"
          style={{
            backgroundColor: paginacion.pagina === 1 ? '#e9ecef' : '#6c757d',
            color: paginacion.pagina === 1 ? '#6c757d' : 'white',
            border: `1px solid ${paginacion.pagina === 1 ? '#e9ecef' : '#6c757d'}`,
            padding: '0.5rem 1rem',
            borderRadius: '4px',
            cursor: paginacion.pagina === 1 ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s ease'
          }}
          disabled={paginacion.pagina === 1}
          onClick={() => cambiarPagina(paginacion.pagina - 1)}
        >
          ← Anterior
        </button>
        
        <span className="paginacion-info" style={{
          color: '#2c3e50',
          fontWeight: 'bold',
          padding: '0 1rem'
        }}>
          Página {paginacion.pagina} de {paginacion.totalPaginas} 
          <br />
          <small style={{ color: '#6c757d' }}>({paginacion.total} registros)</small>
        </span>
        
        <button 
          className="btn btn-secondary"
          style={{
            backgroundColor: paginacion.pagina === paginacion.totalPaginas ? '#e9ecef' : '#6c757d',
            color: paginacion.pagina === paginacion.totalPaginas ? '#6c757d' : 'white',
            border: `1px solid ${paginacion.pagina === paginacion.totalPaginas ? '#e9ecef' : '#6c757d'}`,
            padding: '0.5rem 1rem',
            borderRadius: '4px',
            cursor: paginacion.pagina === paginacion.totalPaginas ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s ease'
          }}
          disabled={paginacion.pagina === paginacion.totalPaginas}
          onClick={() => cambiarPagina(paginacion.pagina + 1)}
        >
          Siguiente →
        </button>
      </div>
    );
  };

  return (
    <div className="control-transacciones" style={{ padding: '2rem', backgroundColor: '#f8f9fa', minHeight: '100vh' }}>
      <div className="admin-header" style={{ 
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '2rem',
        backgroundColor: 'white',
        padding: '2rem',
        borderRadius: '12px',
        boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
        border: '1px solid #e9ecef'
      }}>
        <div>
          <h1 className="admin-title" style={{ 
            color: '#2c3e50',
            margin: '0 0 0.5rem 0',
            fontSize: '2rem'
          }}>
            Control de Ingresos y Egresos
          </h1>
          <p className="admin-subtitle" style={{ 
            color: '#6c757d',
            margin: 0,
            fontSize: '1.1rem'
          }}>
            Monitoreo de vehículos en el estacionamiento
          </p>
        </div>
        <button 
          className="btn btn-secondary"
          style={{
            backgroundColor: '#6c757d',
            color: 'white',
            border: '1px solid #6c757d',
            padding: '0.75rem 1.5rem',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 'bold',
            transition: 'all 0.2s ease'
          }}
          onClick={() => navigate('/admin')}
        >
          ← Volver al Inicio
        </button>
      </div>

      {mensaje && (
        <div className="alert alert-success" style={{
          backgroundColor: '#d4edda',
          color: '#155724',
          padding: '1rem',
          borderRadius: '8px',
          border: '1px solid #c3e6cb',
          marginBottom: '1rem'
        }}>
          {mensaje}
        </div>
      )}
      {error && (
        <div className="alert alert-danger" style={{
          backgroundColor: '#f8d7da',
          color: '#721c24',
          padding: '1rem',
          borderRadius: '8px',
          border: '1px solid #f5c6cb',
          marginBottom: '1rem'
        }}>
          {error}
        </div>
      )}

      {renderEstadisticas()}
      {renderFiltros()}

      <div className="admin-nav" style={{
        display: 'flex',
        gap: '1rem',
        marginBottom: '2rem',
        backgroundColor: 'white',
        padding: '1rem',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
      }}>
        <button 
          className={`btn ${vistaActual === 'ingresos' ? 'btn-primary' : 'btn-secondary'}`}
          style={{
            backgroundColor: vistaActual === 'ingresos' ? '#28a745' : '#6c757d',
            color: 'white',
            border: `1px solid ${vistaActual === 'ingresos' ? '#28a745' : '#6c757d'}`,
            padding: '0.75rem 1.5rem',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 'bold',
            transition: 'all 0.2s ease',
            fontSize: '1rem',
            flex: 1
          }}
          onClick={() => setVistaActual('ingresos')}
        >
          📥 Ingresos ({estadisticas?.resumen?.totalIngresos || 0})
        </button>
        <button 
          className={`btn ${vistaActual === 'egresos' ? 'btn-primary' : 'btn-secondary'}`}
          style={{
            backgroundColor: vistaActual === 'egresos' ? '#dc3545' : '#6c757d',
            color: 'white',
            border: `1px solid ${vistaActual === 'egresos' ? '#dc3545' : '#6c757d'}`,
            padding: '0.75rem 1.5rem',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 'bold',
            transition: 'all 0.2s ease',
            fontSize: '1rem',
            flex: 1
          }}
          onClick={() => setVistaActual('egresos')}
        >
          📤 Egresos ({estadisticas?.resumen?.totalEgresos || 0})
        </button>
      </div>

      {vistaActual === 'ingresos' ? renderIngresos() : renderEgresos()}
      {renderPaginacion()}
    </div>
  );
};

export default ControlTransacciones;
