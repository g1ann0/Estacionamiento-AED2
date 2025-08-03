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
    <div className="filtros-container">
      <h3>Filtros de Búsqueda</h3>
      <div className="filtros-grid">
        <div className="filtro-grupo">
          <label>Fecha Desde:</label>
          <input
            type="date"
            className="form-control"
            value={filtros.fechaDesde}
            onChange={(e) => manejarCambioFiltro('fechaDesde', e.target.value)}
          />
        </div>

        <div className="filtro-grupo">
          <label>Fecha Hasta:</label>
          <input
            type="date"
            className="form-control"
            value={filtros.fechaHasta}
            onChange={(e) => manejarCambioFiltro('fechaHasta', e.target.value)}
          />
        </div>

        <div className="filtro-grupo">
          <label>Dominio:</label>
          <input
            type="text"
            className="form-control"
            placeholder="ABC123"
            value={filtros.dominio}
            onChange={(e) => manejarCambioFiltro('dominio', e.target.value.toUpperCase())}
          />
        </div>

        <div className="filtro-grupo">
          <label>DNI Propietario:</label>
          <input
            type="text"
            className="form-control"
            placeholder="12345678"
            value={filtros.dniPropietario}
            onChange={(e) => manejarCambioFiltro('dniPropietario', e.target.value)}
          />
        </div>

        <div className="filtro-grupo">
          <label>Portón:</label>
          <select
            className="form-control"
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
          <label>Tipo Vehículo:</label>
          <select
            className="form-control"
            value={filtros.tipoVehiculo}
            onChange={(e) => manejarCambioFiltro('tipoVehiculo', e.target.value)}
          >
            <option value="">Todos</option>
            <option value="auto">Auto</option>
            <option value="moto">Moto</option>
          </select>
        </div>
      </div>
      
      <div className="filtros-acciones">
        <button className="btn btn-secondary" onClick={limpiarFiltros}>
          Limpiar Filtros
        </button>
        <button className="btn btn-primary" onClick={cargarEstadisticas}>
          Actualizar Estadísticas
        </button>
      </div>
    </div>
  );

  const renderEstadisticas = () => {
    if (!estadisticas) return null;

    return (
      <div className="estadisticas-container">
        <h3>Estadísticas del Estacionamiento</h3>
        <div className="estadisticas-grid">
          <div className="estadistica-card">
            <h4>Vehículos Actualmente</h4>
            <p className="estadistica-numero">{estadisticas.resumen.vehiculosActualmente}</p>
          </div>
          <div className="estadistica-card">
            <h4>Total Ingresos</h4>
            <p className="estadistica-numero">{estadisticas.resumen.totalIngresos}</p>
          </div>
          <div className="estadistica-card">
            <h4>Total Egresos</h4>
            <p className="estadistica-numero">{estadisticas.resumen.totalEgresos}</p>
          </div>
          <div className="estadistica-card">
            <h4>Recaudación Total</h4>
            <p className="estadistica-numero">${estadisticas.resumen.totalRecaudado?.toFixed(2) || '0.00'}</p>
          </div>
          <div className="estadistica-card">
            <h4>Promedio Estadía</h4>
            <p className="estadistica-numero">{formatearDuracion(estadisticas.resumen.promedioEstadia)}</p>
          </div>
        </div>
      </div>
    );
  };

  const renderIngresos = () => (
    <div className="transacciones-section">
      <h3>Ingresos al Estacionamiento</h3>
      
      {cargando && <p>Cargando ingresos...</p>}
      
      <div className="transacciones-list">
        {ingresos.map(ingreso => (
          <div key={ingreso._id} className="transaccion-card ingreso">
            <div className="transaccion-header">
              <h4>{ingreso.vehiculo.dominio}</h4>
              <span className="badge badge-success">INGRESO</span>
            </div>
            <div className="transaccion-details">
              <p><strong>Fecha/Hora:</strong> {formatearFecha(ingreso.fechaHora)}</p>
              <p><strong>Vehículo:</strong> {ingreso.vehiculo.marca} {ingreso.vehiculo.modelo} ({ingreso.vehiculo.tipo})</p>
              <p><strong>Propietario:</strong> {ingreso.propietario.nombre} {ingreso.propietario.apellido} (DNI: {ingreso.propietario.dni})</p>
              <p><strong>Portón:</strong> {ingreso.porton}</p>
              <p><strong>Tarifa:</strong> ${ingreso.tarifa}/hora</p>
              <p><strong>Estado:</strong> <span className={`estado ${ingreso.estado}`}>{ingreso.estado}</span></p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderEgresos = () => (
    <div className="transacciones-section">
      <h3>Egresos del Estacionamiento</h3>
      
      {cargando && <p>Cargando egresos...</p>}
      
      <div className="transacciones-list">
        {egresos.map(egreso => (
          <div key={egreso._id} className="transaccion-card egreso">
            <div className="transaccion-header">
              <h4>{egreso.vehiculo.dominio}</h4>
              <span className="badge badge-danger">EGRESO</span>
            </div>
            <div className="transaccion-details">
              <p><strong>Fecha/Hora:</strong> {formatearFecha(egreso.fechaHora)}</p>
              <p><strong>Vehículo:</strong> {egreso.vehiculo.marca} {egreso.vehiculo.modelo} ({egreso.vehiculo.tipo})</p>
              <p><strong>Propietario:</strong> {egreso.propietario.nombre} {egreso.propietario.apellido} (DNI: {egreso.propietario.dni})</p>
              <p><strong>Portón:</strong> {egreso.porton}</p>
              <p><strong>Duración:</strong> {egreso.duracion || formatearDuracion(egreso.duracionHorasReal)}</p>
              <p><strong>Tarifa:</strong> ${egreso.tarifa}/hora</p>
              <p><strong>Monto Total:</strong> <span className="monto-total">${egreso.montoTotal}</span></p>
              <p><strong>Estado:</strong> <span className={`estado ${egreso.estado}`}>{egreso.estado}</span></p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderPaginacion = () => {
    if (paginacion.totalPaginas <= 1) return null;

    return (
      <div className="paginacion">
        <button 
          className="btn btn-secondary"
          disabled={paginacion.pagina === 1}
          onClick={() => cambiarPagina(paginacion.pagina - 1)}
        >
          Anterior
        </button>
        
        <span className="paginacion-info">
          Página {paginacion.pagina} de {paginacion.totalPaginas} 
          ({paginacion.total} registros)
        </span>
        
        <button 
          className="btn btn-secondary"
          disabled={paginacion.pagina === paginacion.totalPaginas}
          onClick={() => cambiarPagina(paginacion.pagina + 1)}
        >
          Siguiente
        </button>
      </div>
    );
  };

  return (
    <div className="control-transacciones">
      <div className="admin-header">
        <div>
          <h1 className="admin-title">Control de Ingresos y Egresos</h1>
          <p className="admin-subtitle">Monitoreo de vehículos en el estacionamiento</p>
        </div>
        <button 
          className="btn btn-secondary"
          onClick={() => navigate('/admin')}
        >
          ← Volver al Inicio
        </button>
      </div>

      {mensaje && <div className="alert alert-success">{mensaje}</div>}
      {error && <div className="alert alert-danger">{error}</div>}

      {renderEstadisticas()}
      {renderFiltros()}

      <div className="admin-nav">
        <button 
          className={`btn ${vistaActual === 'ingresos' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setVistaActual('ingresos')}
        >
          Ingresos ({estadisticas?.resumen?.totalIngresos || 0})
        </button>
        <button 
          className={`btn ${vistaActual === 'egresos' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setVistaActual('egresos')}
        >
          Egresos ({estadisticas?.resumen?.totalEgresos || 0})
        </button>
      </div>

      {vistaActual === 'ingresos' ? renderIngresos() : renderEgresos()}
      {renderPaginacion()}
    </div>
  );
};

export default ControlTransacciones;
