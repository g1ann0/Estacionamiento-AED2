import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Navbar from './Navbar';
import AuditoriaLogs from './AuditoriaLogs';
import '../styles/theme.css';
import '../styles/admin.css';

function ListadosAdmin() {
  const { usuario: usuarioAuth } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [mensaje, setMensaje] = useState(null);
  const [usuarios, setUsuarios] = useState([]);
  const [vehiculos, setVehiculos] = useState([]);
  const [vistaActual, setVistaActual] = useState('usuarios');
  const [filtro, setFiltro] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('todos'); // todos, verificados, pendientes, asociados, no_asociados
  const [filtroVehiculo, setFiltroVehiculo] = useState('todos'); // todos, auto, moto
  const [filtroSaldo, setFiltroSaldo] = useState('todos'); // todos, sin_saldo, con_saldo, alto_saldo
  const [filtroFecha, setFiltroFecha] = useState(''); // filtro por fecha de registro

  // Cargar usuarios
  const cargarUsuarios = async () => {
    try {
      const token = localStorage.getItem('token');
      console.log('Cargando usuarios...');
      const res = await fetch('http://localhost:3000/api/admin/usuarios', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      console.log('Respuesta usuarios:', res.status);
      
      if (res.ok) {
        const data = await res.json();
        setUsuarios(data.usuarios || []);
      } else {
        throw new Error('Error al cargar usuarios');
      }
    } catch (error) {
      console.error('Error:', error);
      setMensaje({ type: 'error', text: 'Error al cargar usuarios' });
    }
  };

  // Cargar vehículos
  const cargarVehiculos = async () => {
    try {
      const token = localStorage.getItem('token');
      console.log('Cargando vehículos...');
      const res = await fetch('http://localhost:3000/api/admin/vehiculos', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      console.log('Respuesta vehículos:', res.status);
      
      if (res.ok) {
        const data = await res.json();
        setVehiculos(data.vehiculos || []);
      } else {
        throw new Error('Error al cargar vehículos');
      }
    } catch (error) {
      console.error('Error:', error);
      setMensaje({ type: 'error', text: 'Error al cargar vehículos' });
    }
  };

  useEffect(() => {
    if (!usuarioAuth || usuarioAuth.rol !== 'admin') {
      navigate('/login');
      return;
    }

    const cargarDatos = async () => {
      setLoading(true);
      try {
        await Promise.all([
          cargarUsuarios(),
          cargarVehiculos()
        ]);
      } catch (error) {
        console.error('Error al cargar datos:', error);
      } finally {
        setLoading(false);
      }
    };

    cargarDatos();
  }, [usuarioAuth, navigate]);

  // Función para filtrar usuarios
  const usuariosFiltrados = usuarios.filter(user => {
    // Filtro por texto
    const matchesText = user.nombre.toLowerCase().includes(filtro.toLowerCase()) ||
                       user.apellido.toLowerCase().includes(filtro.toLowerCase()) ||
                       user.dni.includes(filtro) ||
                       user.email.toLowerCase().includes(filtro.toLowerCase());

    // Filtro por tipo
    let matchesType = true;
    if (filtroTipo === 'verificados') {
      matchesType = user.verificado === true;
    } else if (filtroTipo === 'pendientes') {
      matchesType = user.verificado === false;
    } else if (filtroTipo === 'asociados') {
      matchesType = user.asociado === true;
    } else if (filtroTipo === 'no_asociados') {
      matchesType = user.asociado === false;
    }

    // Filtro por saldo
    let matchesSaldo = true;
    const saldo = user.montoDisponible || 0;
    if (filtroSaldo === 'sin_saldo') {
      matchesSaldo = saldo === 0;
    } else if (filtroSaldo === 'con_saldo') {
      matchesSaldo = saldo > 0 && saldo <= 1000;
    } else if (filtroSaldo === 'alto_saldo') {
      matchesSaldo = saldo > 1000;
    }

    // Filtro por fecha (últimos 30 días, últimos 7 días, etc.)
    let matchesFecha = true;
    if (filtroFecha && user.fechaRegistro) {
      const fechaUsuario = new Date(user.fechaRegistro);
      const hoy = new Date();
      const diferenciaDias = Math.floor((hoy - fechaUsuario) / (1000 * 60 * 60 * 24));
      
      if (filtroFecha === 'ultimos_7') {
        matchesFecha = diferenciaDias <= 7;
      } else if (filtroFecha === 'ultimos_30') {
        matchesFecha = diferenciaDias <= 30;
      } else if (filtroFecha === 'ultimos_90') {
        matchesFecha = diferenciaDias <= 90;
      }
    }

    return matchesText && matchesType && matchesSaldo && matchesFecha;
  });

  // Función para filtrar vehículos
  const vehiculosFiltrados = vehiculos.filter(veh => {
    // Filtro por texto
    const matchesText = veh.dominio.toLowerCase().includes(filtro.toLowerCase()) ||
                       veh.marca.toLowerCase().includes(filtro.toLowerCase()) ||
                       veh.modelo.toLowerCase().includes(filtro.toLowerCase()) ||
                       (veh.propietario && (
                         veh.propietario.nombre.toLowerCase().includes(filtro.toLowerCase()) ||
                         veh.propietario.apellido.toLowerCase().includes(filtro.toLowerCase()) ||
                         veh.propietario.dni.includes(filtro)
                       ));

    // Filtro por tipo de vehículo
    let matchesType = true;
    if (filtroVehiculo === 'auto') {
      matchesType = veh.tipo === 'auto';
    } else if (filtroVehiculo === 'moto') {
      matchesType = veh.tipo === 'moto';
    }

    // Filtro por propietario (si tiene propietario asociado o no)
    let matchesPropietario = true;
    if (filtroTipo === 'con_propietario') {
      matchesPropietario = veh.propietario !== null && veh.propietario !== undefined;
    } else if (filtroTipo === 'sin_propietario') {
      matchesPropietario = !veh.propietario;
    } else if (filtroTipo === 'propietario_asociado') {
      matchesPropietario = veh.propietario && veh.propietario.asociado;
    } else if (filtroTipo === 'propietario_regular') {
      matchesPropietario = veh.propietario && !veh.propietario.asociado;
    }

    // Filtro por fecha de registro del vehículo
    let matchesFecha = true;
    if (filtroFecha && veh.fechaRegistro) {
      const fechaVehiculo = new Date(veh.fechaRegistro);
      const hoy = new Date();
      const diferenciaDias = Math.floor((hoy - fechaVehiculo) / (1000 * 60 * 60 * 24));
      
      if (filtroFecha === 'ultimos_7') {
        matchesFecha = diferenciaDias <= 7;
      } else if (filtroFecha === 'ultimos_30') {
        matchesFecha = diferenciaDias <= 30;
      } else if (filtroFecha === 'ultimos_90') {
        matchesFecha = diferenciaDias <= 90;
      }
    }

    return matchesText && matchesType && matchesPropietario && matchesFecha;
  });

  const renderUsuarios = () => (
    <div className="usuarios-section">
      {/* Estadísticas Resumen */}
      <div className="auditoria-stats">
        <div className="stat-card stat-total">
          <h3>{usuarios.length}</h3>
          <p>Total Usuarios</p>
        </div>
        <div className="stat-card stat-verificados">
          <h3>{usuarios.filter(u => u.verificado).length}</h3>
          <p>Verificados</p>
        </div>
        <div className="stat-card stat-asociados">
          <h3>{usuarios.filter(u => u.asociado).length}</h3>
          <p>Asociados</p>
        </div>
        <div className="stat-card stat-saldo">
          <h3>${usuarios.reduce((sum, u) => sum + (u.montoDisponible || 0), 0).toFixed(2)}</h3>
          <p>Saldo Total</p>
        </div>
      </div>

      <h2>Usuarios Registrados ({usuariosFiltrados.length} de {usuarios.length})</h2>
      
      {/* Controles de filtrado mejorados */}
      <div className="auditoria-filtros">
        <div className="filtros-row">
          <div className="filtro-group">
            <label>Búsqueda General</label>
            <input
              type="text"
              className="input"
              placeholder="Buscar por nombre, apellido, DNI o email..."
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
            />
          </div>
          
          <div className="filtro-group">
            <label>Estado de Verificación</label>
            <select
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value)}
              className="input"
            >
              <option value="todos">Todos los usuarios</option>
              <option value="verificados">✅ Verificados</option>
              <option value="pendientes">⏳ Pendientes</option>
              <option value="asociados">⭐ Asociados</option>
              <option value="no_asociados">👤 No Asociados</option>
            </select>
          </div>

          <div className="filtro-group">
            <label>Filtro por Saldo</label>
            <select
              value={filtroSaldo}
              onChange={(e) => setFiltroSaldo(e.target.value)}
              className="input"
            >
              <option value="todos">Todos los saldos</option>
              <option value="sin_saldo">💸 Sin saldo ($0)</option>
              <option value="con_saldo">💰 Saldo medio ($1-$1000)</option>
              <option value="alto_saldo">🤑 Saldo alto (+$1000)</option>
            </select>
          </div>

          <div className="filtro-group">
            <label>Fecha de Registro</label>
            <select
              value={filtroFecha}
              onChange={(e) => setFiltroFecha(e.target.value)}
              className="input"
            >
              <option value="">Todas las fechas</option>
              <option value="ultimos_7">📅 Últimos 7 días</option>
              <option value="ultimos_30">📅 Últimos 30 días</option>
              <option value="ultimos_90">📅 Últimos 90 días</option>
            </select>
          </div>

          <div className="filtro-group">
            <label>Acciones</label>
            <button
              onClick={() => {
                setFiltro('');
                setFiltroTipo('todos');
                setFiltroSaldo('todos');
                setFiltroFecha('');
              }}
              className="button button-secondary"
            >
              🔄 Limpiar Filtros
            </button>
          </div>
        </div>
      </div>

      <div className="auditoria-grid">
        {usuariosFiltrados.length === 0 ? (
          <div className="no-results">
            <p>📋 No hay usuarios que coincidan con los filtros aplicados</p>
          </div>
        ) : (
          usuariosFiltrados.map(usuario => (
            <div key={usuario.dni} className="auditoria-card usuario-card-enhanced">
              <div className="card-header">
                <div className="card-title">
                  <h4>👤 {usuario.nombre} {usuario.apellido}</h4>
                  <div className="card-badges">
                    <span className={`badge ${usuario.verificado ? 'badge-success' : 'badge-warning'}`}>
                      {usuario.verificado ? '✅ Verificado' : '⏳ Pendiente'}
                    </span>
                    <span className={`badge ${usuario.asociado ? 'badge-info' : 'badge-secondary'}`}>
                      {usuario.asociado ? '⭐ Asociado' : '👤 Regular'}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="card-content">
                <div className="info-grid">
                  <div className="info-item">
                    <span className="info-label">🆔 DNI</span>
                    <span className="info-value">{usuario.dni}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">📧 Email</span>
                    <span className="info-value">{usuario.email}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">💰 Saldo</span>
                    <span className="info-value highlight">${usuario.montoDisponible || 0}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">🚗 Vehículos</span>
                    <span className="info-value">{usuario.vehiculos ? usuario.vehiculos.length : 0}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">📅 Registro</span>
                    <span className="info-value">
                      {usuario.fechaRegistro ? new Date(usuario.fechaRegistro).toLocaleDateString() : 'No disponible'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  const renderVehiculos = () => (
    <div className="vehiculos-section">
      {/* Estadísticas Resumen */}
      <div className="auditoria-stats">
        <div className="stat-card stat-total">
          <h3>{vehiculos.length}</h3>
          <p>Total Vehículos</p>
        </div>
        <div className="stat-card stat-verificados">
          <h3>{vehiculos.filter(v => v.tipo === 'auto').length}</h3>
          <p>Autos</p>
        </div>
        <div className="stat-card stat-asociados">
          <h3>{vehiculos.filter(v => v.tipo === 'moto').length}</h3>
          <p>Motos</p>
        </div>
        <div className="stat-card stat-saldo">
          <h3>{vehiculos.filter(v => v.propietario && v.propietario.asociado).length}</h3>
          <p>De Asociados</p>
        </div>
      </div>

      <h2>Vehículos Registrados ({vehiculosFiltrados.length} de {vehiculos.length})</h2>
      
      {/* Controles de filtrado mejorados */}
      <div className="auditoria-filtros">
        <div className="filtros-row">
          <div className="filtro-group">
            <label>Búsqueda General</label>
            <input
              type="text"
              className="input"
              placeholder="Buscar por dominio, marca, modelo o propietario..."
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
            />
          </div>
          
          <div className="filtro-group">
            <label>Tipo de Vehículo</label>
            <select
              value={filtroVehiculo}
              onChange={(e) => setFiltroVehiculo(e.target.value)}
              className="input"
            >
              <option value="todos">Todos</option>
              <option value="auto">🚗 Autos</option>
              <option value="moto">🏍️ Motos</option>
            </select>
          </div>

          <div className="filtro-group">
            <label>Estado del Propietario</label>
            <select
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value)}
              className="input"
            >
              <option value="todos">Todos los estados</option>
              <option value="con_propietario">👤 Con propietario</option>
              <option value="sin_propietario">❓ Sin propietario</option>
              <option value="propietario_asociado">⭐ Propietario asociado</option>
              <option value="propietario_regular">👤 Propietario regular</option>
            </select>
          </div>

          <div className="filtro-group">
            <label>Fecha de Registro</label>
            <select
              value={filtroFecha}
              onChange={(e) => setFiltroFecha(e.target.value)}
              className="input"
            >
              <option value="">Todas las fechas</option>
              <option value="ultimos_7">📅 Últimos 7 días</option>
              <option value="ultimos_30">📅 Últimos 30 días</option>
              <option value="ultimos_90">📅 Últimos 90 días</option>
            </select>
          </div>

          <div className="filtro-group">
            <label>Acciones</label>
            <button
              onClick={() => {
                setFiltro('');
                setFiltroVehiculo('todos');
                setFiltroTipo('todos');
                setFiltroFecha('');
              }}
              className="button button-secondary"
            >
              🔄 Limpiar Filtros
            </button>
          </div>
        </div>
      </div>

      <div className="auditoria-grid">
        {vehiculosFiltrados.length === 0 ? (
          <div className="no-results">
            <p>🚗 No hay vehículos que coincidan con los filtros aplicados</p>
          </div>
        ) : (
          vehiculosFiltrados.map(vehiculo => (
            <div key={vehiculo.dominio} className="auditoria-card vehiculo-card-enhanced">
              <div className="card-header">
                <div className="card-title">
                  <h4>{vehiculo.tipo === 'auto' ? '🚗' : '🏍️'} {vehiculo.marca} {vehiculo.modelo}</h4>
                  <div className="card-badges">
                    <span className={`badge ${vehiculo.tipo === 'auto' ? 'badge-info' : 'badge-warning'}`}>
                      {vehiculo.tipo.toUpperCase()}
                    </span>
                    {vehiculo.propietario && (
                      <span className={`badge ${vehiculo.propietario.asociado ? 'badge-success' : 'badge-secondary'}`}>
                        {vehiculo.propietario.asociado ? '⭐ Asociado' : '👤 Regular'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="card-content">
                <div className="info-grid">
                  <div className="info-item">
                    <span className="info-label">🔖 Dominio</span>
                    <span className="info-value highlight">{vehiculo.dominio}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">📅 Año</span>
                    <span className="info-value">{vehiculo.año}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">👤 Propietario</span>
                    <span className="info-value">
                      {vehiculo.propietario
                        ? `${vehiculo.propietario.nombre} ${vehiculo.propietario.apellido}`
                        : 'No encontrado'}
                    </span>
                  </div>
                  {vehiculo.propietario && (
                    <>
                      <div className="info-item">
                        <span className="info-label">🆔 DNI Propietario</span>
                        <span className="info-value">{vehiculo.propietario.dni}</span>
                      </div>
                      <div className="info-item">
                        <span className="info-label">📧 Email</span>
                        <span className="info-value">{vehiculo.propietario.email}</span>
                      </div>
                    </>
                  )}
                  <div className="info-item">
                    <span className="info-label">📅 Registro</span>
                    <span className="info-value">
                      {vehiculo.fechaRegistro ? new Date(vehiculo.fechaRegistro).toLocaleDateString() : 'No disponible'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="container">
        <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
          <div className="spinner"></div>
          <p style={{ marginTop: '1rem' }}>Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Navbar />
      <div className="container">
        <div className="admin-header">
          <div>
            <h1 className="admin-title">Listados y Auditoría del Sistema</h1>
            <p className="admin-subtitle">Consulta y filtrado avanzado de datos y registros de auditoría</p>
          </div>
          
          <div className="admin-nav">
            <button 
              className={`button ${vistaActual === 'usuarios' ? 'button-primary' : 'button-secondary'}`}
              onClick={() => {
                setVistaActual('usuarios');
                setFiltro('');
                setFiltroTipo('todos');
                setFiltroSaldo('todos');
                setFiltroFecha('');
              }}
            >
              Usuarios ({usuarios.length})
            </button>
            <button 
              className={`button ${vistaActual === 'vehiculos' ? 'button-primary' : 'button-secondary'}`}
              onClick={() => {
                setVistaActual('vehiculos');
                setFiltro('');
                setFiltroVehiculo('todos');
                setFiltroTipo('todos');
                setFiltroFecha('');
              }}
            >
              Vehículos ({vehiculos.length})
            </button>
            <button 
              className={`button ${vistaActual === 'auditoria' ? 'button-primary' : 'button-secondary'}`}
              onClick={() => {
                setVistaActual('auditoria');
                setFiltro('');
              }}
            >
              Auditoría
            </button>
          </div>
        </div>

        {mensaje && (
          <div className={`message message-${mensaje.type}`} style={{ margin: '1rem 0', position: 'relative' }}>
            {mensaje.text}
            <button 
              onClick={() => setMensaje(null)} 
              style={{
                position: 'absolute',
                right: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '18px',
                color: mensaje.type === 'error' ? '#721c24' : '#155724'
              }}
            >
              ×
            </button>
          </div>
        )}

        <div className="admin-content">
          {vistaActual === 'usuarios' && renderUsuarios()}
          {vistaActual === 'vehiculos' && renderVehiculos()}
          {vistaActual === 'auditoria' && (
            <div className="auditoria-section">
              <h2>Auditoría del Sistema</h2>
              <p style={{ marginBottom: '1.5rem', color: '#666' }}>
                Consulta los registros de auditoría del sistema para seguimiento de cambios y actividades.
              </p>
              <AuditoriaLogs onMensaje={setMensaje} />
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default ListadosAdmin;
