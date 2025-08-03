import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  obtenerTodosLosUsuarios, 
  modificarUsuario, 
  eliminarUsuario,
  obtenerTarifasDisponibles,
  obtenerTodosLosVehiculos,
  agregarVehiculo,
  modificarVehiculo,
  eliminarVehiculo,
  obtenerHistorialSaldos,
  obtenerEstadisticasSaldos,
  obtenerHistorialVehiculos,
  obtenerEstadisticasVehiculos
} from '../services/adminGestionService';
import '../styles/admin.css';

const AdminGestion = () => {
  const navigate = useNavigate();
  const [vistaActual, setVistaActual] = useState('usuarios');
  const [usuarios, setUsuarios] = useState([]);
  const [vehiculos, setVehiculos] = useState([]);
  const [tarifasDisponibles, setTarifasDisponibles] = useState([]);
  const [historialSaldos, setHistorialSaldos] = useState([]);
  const [estadisticasSaldos, setEstadisticasSaldos] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');

  // Estados para edición
  const [usuarioEditando, setUsuarioEditando] = useState(null);
  const [vehiculoEditando, setVehiculoEditando] = useState(null);
  const [mostrarFormVehiculo, setMostrarFormVehiculo] = useState(false);
  const [nuevoVehiculo, setNuevoVehiculo] = useState({
    usuarioDni: '',
    dominio: '',
    tipo: 'auto',
    marca: '',
    modelo: '',
    año: '',
    motivo: ''
  });

  useEffect(() => {
    // Cargar usuarios y tarifas siempre para poder usarlos en formularios
    cargarUsuarios();
    cargarTarifas();
    
    if (vistaActual === 'usuarios') {
      // Ya se cargaron arriba
    } else {
      cargarVehiculos();
    }
  }, [vistaActual]);

  const cargarUsuarios = async () => {
    try {
      setCargando(true);
      const usuariosData = await obtenerTodosLosUsuarios();
      setUsuarios(usuariosData);
    } catch (error) {
      setError('Error al cargar usuarios: ' + error.message);
    } finally {
      setCargando(false);
    }
  };

  const cargarTarifas = async () => {
    try {
      const tarifasData = await obtenerTarifasDisponibles();
      setTarifasDisponibles(tarifasData);
    } catch (error) {
      console.error('Error al cargar tarifas:', error);
      setError('Error al cargar tarifas: ' + error.message);
    }
  };

  const cargarVehiculos = async () => {
    try {
      setCargando(true);
      const vehiculosData = await obtenerTodosLosVehiculos();
      setVehiculos(vehiculosData);
    } catch (error) {
      setError('Error al cargar vehículos: ' + error.message);
    } finally {
      setCargando(false);
    }
  };

  const manejarModificarUsuario = async (dni, datosActualizados) => {
    try {
      await modificarUsuario(dni, datosActualizados);
      setMensaje('Usuario modificado correctamente');
      setUsuarioEditando(null);
      cargarUsuarios();
    } catch (error) {
      setError('Error al modificar usuario: ' + error.message);
    }
  };

  const manejarEliminarUsuario = async (dni) => {
    if (window.confirm('¿Está seguro de que desea eliminar este usuario? Esta acción también eliminará todos sus vehículos.')) {
      try {
        await eliminarUsuario(dni);
        setMensaje('Usuario eliminado correctamente');
        cargarUsuarios();
      } catch (error) {
        setError('Error al eliminar usuario: ' + error.message);
      }
    }
  };

  const manejarAgregarVehiculo = async (e) => {
    e.preventDefault();
    
    // Validar que el motivo esté presente
    if (!nuevoVehiculo.motivo || nuevoVehiculo.motivo.trim() === '') {
      setError('El motivo es obligatorio para agregar un vehículo');
      return;
    }
    
    try {
      await agregarVehiculo(nuevoVehiculo);
      setMensaje('Vehículo agregado correctamente');
      setMostrarFormVehiculo(false);
      setNuevoVehiculo({
        usuarioDni: '',
        dominio: '',
        tipo: 'auto',
        marca: '',
        modelo: '',
        año: '',
        motivo: ''
      });
      cargarVehiculos();
    } catch (error) {
      setError('Error al agregar vehículo: ' + error.message);
    }
  };

  const manejarModificarVehiculo = async (dominio, datosActualizados) => {
    // Validar que el motivo esté presente
    if (!datosActualizados.motivo || datosActualizados.motivo.trim() === '') {
      setError('El motivo es obligatorio para modificar un vehículo');
      return;
    }
    
    try {
      await modificarVehiculo(dominio, datosActualizados);
      setMensaje('Vehículo modificado correctamente');
      setVehiculoEditando(null);
      cargarVehiculos();
    } catch (error) {
      setError('Error al modificar vehículo: ' + error.message);
    }
  };

  const manejarEliminarVehiculo = async (dominio) => {
    const motivo = prompt('Ingrese el motivo para eliminar este vehículo (obligatorio):');
    
    if (!motivo || motivo.trim() === '') {
      setError('El motivo es obligatorio para eliminar un vehículo');
      return;
    }
    
    if (window.confirm('¿Está seguro de que desea eliminar este vehículo?')) {
      try {
        await eliminarVehiculo(dominio, motivo.trim());
        setMensaje('Vehículo eliminado correctamente');
        cargarVehiculos();
      } catch (error) {
        setError('Error al eliminar vehículo: ' + error.message);
      }
    }
  };

  const renderUsuarios = () => (
    <div className="usuarios-section">
      <h3 style={{ color: '#2c3e50', marginBottom: '1.5rem' }}>Gestión de Usuarios</h3>
      
      {cargando && <p style={{ textAlign: 'center', color: '#666' }}>Cargando usuarios...</p>}
      
      <div className="usuarios-list" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
        gap: '1.5rem',
        marginTop: '1rem'
      }}>
        {usuarios.map(usuario => (
          <div key={usuario.dni} className="usuario-card" style={{ 
            background: '#fff',
            border: '1px solid #e9ecef',
            borderRadius: '12px',
            padding: '1.5rem',
            boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
            transition: 'all 0.3s ease'
          }}>
            {usuarioEditando === usuario.dni ? (
              <FormularioEditarUsuario 
                usuario={usuario}
                tarifasDisponibles={tarifasDisponibles}
                onGuardar={(datos) => manejarModificarUsuario(usuario.dni, datos)}
                onCancelar={() => setUsuarioEditando(null)}
              />
            ) : (
              <>
                <h3 style={{ 
                  color: '#2c3e50', 
                  marginBottom: '1rem',
                  borderBottom: '2px solid #f8f9fa',
                  paddingBottom: '0.5rem'
                }}>
                  {usuario.nombre} {usuario.apellido}
                </h3>
                <p style={{ color: '#34495e', marginBottom: '0.5rem' }}>
                  <strong style={{ color: '#2c3e50' }}>DNI:</strong> {usuario.dni}
                </p>
                <p style={{ color: '#34495e', marginBottom: '0.5rem' }}>
                  <strong style={{ color: '#2c3e50' }}>Email:</strong> {usuario.email}
                </p>
                <p style={{ color: '#34495e', marginBottom: '0.5rem' }}>
                  <strong style={{ color: '#2c3e50' }}>Rol:</strong> 
                  <span style={{ 
                    backgroundColor: usuario.rol === 'admin' ? '#e74c3c' : '#3498db',
                    color: 'white',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    fontSize: '0.8rem',
                    marginLeft: '0.5rem'
                  }}>
                    {usuario.rol}
                  </span>
                </p>
                <p style={{ color: '#34495e', marginBottom: '0.5rem' }}>
                  <strong style={{ color: '#2c3e50' }}>Asociado:</strong> 
                  <span style={{ 
                    color: usuario.asociado ? '#28a745' : '#6c757d',
                    fontWeight: 'bold'
                  }}>
                    {usuario.asociado ? 'Sí' : 'No'}
                  </span>
                </p>
                <p style={{ color: '#34495e', marginBottom: '0.5rem' }}>
                  <strong style={{ color: '#2c3e50' }}>Tarifa:</strong> 
                  {usuario.tarifaAsignada ? (
                    <span style={{ 
                      backgroundColor: '#007bff',
                      color: 'white',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontSize: '0.9rem',
                      marginLeft: '0.5rem'
                    }}>
                      {usuario.tarifaAsignada.tipoUsuario} - ${usuario.tarifaAsignada.precioPorHora}/hora
                    </span>
                  ) : (
                    <span style={{ color: '#6c757d', fontStyle: 'italic' }}>Sin tarifa asignada</span>
                  )}
                </p>
                <p style={{ color: '#34495e', marginBottom: '0.5rem' }}>
                  <strong style={{ color: '#2c3e50' }}>Saldo:</strong> 
                  <span style={{ 
                    color: '#28a745',
                    fontWeight: 'bold',
                    fontSize: '1.1rem'
                  }}>
                    ${usuario.montoDisponible || 0}
                  </span>
                </p>
                <p style={{ color: '#34495e', marginBottom: '1rem' }}>
                  <strong style={{ color: '#2c3e50' }}>Verificado:</strong> 
                  <span style={{ 
                    color: usuario.verificado ? '#28a745' : '#dc3545',
                    fontWeight: 'bold'
                  }}>
                    {usuario.verificado ? 'Sí' : 'No'}
                  </span>
                </p>
                
                <div className="usuario-acciones" style={{ 
                  display: 'flex',
                  gap: '0.5rem',
                  marginTop: '1rem'
                }}>
                  <button 
                    className="btn btn-primary"
                    style={{
                      backgroundColor: '#007bff',
                      color: 'white',
                      border: '1px solid #007bff',
                      padding: '0.5rem 1rem',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      flex: 1
                    }}
                    onClick={() => setUsuarioEditando(usuario.dni)}
                  >
                    Modificar
                  </button>
                  {usuario.rol !== 'admin' && (
                    <button 
                      className="btn btn-danger"
                      style={{
                        backgroundColor: '#dc3545',
                        color: 'white',
                        border: '1px solid #dc3545',
                        padding: '0.5rem 1rem',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        flex: 1
                      }}
                      onClick={() => manejarEliminarUsuario(usuario.dni)}
                    >
                      Eliminar
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  const renderVehiculos = () => (
    <div className="vehiculos-section">
      <div className="vehiculos-header" style={{ 
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1.5rem'
      }}>
        <h3 style={{ color: '#2c3e50', margin: 0 }}>Gestión de Vehículos</h3>
        <button 
          className="btn btn-success"
          style={{
            backgroundColor: '#28a745',
            color: 'white',
            border: '1px solid #28a745',
            padding: '0.75rem 1.5rem',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 'bold',
            transition: 'all 0.2s ease'
          }}
          onClick={() => setMostrarFormVehiculo(true)}
        >
          + Agregar Vehículo
        </button>
      </div>

      {mostrarFormVehiculo && (
        <FormularioNuevoVehiculo 
          vehiculo={nuevoVehiculo}
          usuarios={usuarios}
          onChange={setNuevoVehiculo}
          onSubmit={manejarAgregarVehiculo}
          onCancelar={() => setMostrarFormVehiculo(false)}
        />
      )}
      
      {cargando && <p style={{ textAlign: 'center', color: '#666' }}>Cargando vehículos...</p>}
      
      <div className="vehiculos-list" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
        gap: '1.5rem',
        marginTop: '1rem'
      }}>
        {vehiculos.map(vehiculo => (
          <div key={vehiculo._id} className="vehiculo-card" style={{ 
            background: '#fff',
            border: '1px solid #e9ecef',
            borderRadius: '12px',
            padding: '1.5rem',
            boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
            transition: 'all 0.3s ease'
          }}>
            {vehiculoEditando === vehiculo.dominio ? (
              <FormularioEditarVehiculo 
                vehiculo={vehiculo}
                usuarios={usuarios}
                onGuardar={(datos) => manejarModificarVehiculo(vehiculo.dominio, datos)}
                onCancelar={() => setVehiculoEditando(null)}
              />
            ) : (
              <>
                <h3 style={{ 
                  color: '#2c3e50', 
                  marginBottom: '1rem',
                  borderBottom: '2px solid #f8f9fa',
                  paddingBottom: '0.5rem',
                  fontSize: '1.3rem',
                  fontWeight: 'bold'
                }}>
                  {vehiculo.dominio}
                </h3>
                <p style={{ color: '#34495e', marginBottom: '0.5rem' }}>
                  <strong style={{ color: '#2c3e50' }}>Tipo:</strong> 
                  <span style={{ 
                    backgroundColor: vehiculo.tipo === 'auto' ? '#17a2b8' : vehiculo.tipo === 'moto' ? '#ffc107' : '#6c757d',
                    color: vehiculo.tipo === 'moto' ? '#212529' : 'white',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    fontSize: '0.8rem',
                    marginLeft: '0.5rem',
                    textTransform: 'capitalize'
                  }}>
                    {vehiculo.tipo}
                  </span>
                </p>
                <p style={{ color: '#34495e', marginBottom: '0.5rem' }}>
                  <strong style={{ color: '#2c3e50' }}>Marca:</strong> {vehiculo.marca}
                </p>
                <p style={{ color: '#34495e', marginBottom: '0.5rem' }}>
                  <strong style={{ color: '#2c3e50' }}>Modelo:</strong> {vehiculo.modelo}
                </p>
                <p style={{ color: '#34495e', marginBottom: '0.5rem' }}>
                  <strong style={{ color: '#2c3e50' }}>Año:</strong> 
                  <span style={{ 
                    fontWeight: 'bold',
                    color: '#495057'
                  }}>
                    {vehiculo.año}
                  </span>
                </p>
                {vehiculo.propietario && (
                  <p style={{ 
                    color: '#34495e', 
                    marginBottom: '1rem',
                    backgroundColor: '#f8f9fa',
                    padding: '0.5rem',
                    borderRadius: '4px',
                    border: '1px solid #e9ecef'
                  }}>
                    <strong style={{ color: '#2c3e50' }}>Propietario:</strong> 
                    <span style={{ color: '#007bff', fontWeight: 'bold' }}>
                      {vehiculo.propietario.nombre} {vehiculo.propietario.apellido}
                    </span>
                    <br />
                    <small style={{ color: '#6c757d' }}>DNI: {vehiculo.propietario.dni}</small>
                  </p>
                )}
                
                <div className="vehiculo-acciones" style={{ 
                  display: 'flex',
                  gap: '0.5rem',
                  marginTop: '1rem'
                }}>
                  <button 
                    className="btn btn-primary"
                    style={{
                      backgroundColor: '#007bff',
                      color: 'white',
                      border: '1px solid #007bff',
                      padding: '0.5rem 1rem',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      flex: 1
                    }}
                    onClick={() => setVehiculoEditando(vehiculo.dominio)}
                  >
                    Modificar
                  </button>
                  <button 
                    className="btn btn-danger"
                    style={{
                      backgroundColor: '#dc3545',
                      color: 'white',
                      border: '1px solid #dc3545',
                      padding: '0.5rem 1rem',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      flex: 1
                    }}
                    onClick={() => manejarEliminarVehiculo(vehiculo.dominio)}
                  >
                    Eliminar
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="admin-gestion" style={{ padding: '2rem', backgroundColor: '#f8f9fa', minHeight: '100vh' }}>
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
            Gestión de Usuarios y Vehículos
          </h1>
          <p className="admin-subtitle" style={{ 
            color: '#6c757d',
            margin: 0,
            fontSize: '1.1rem'
          }}>
            Administra usuarios y vehículos del sistema
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
          className={`btn ${vistaActual === 'usuarios' ? 'btn-primary' : 'btn-secondary'}`}
          style={{
            backgroundColor: vistaActual === 'usuarios' ? '#007bff' : '#6c757d',
            color: 'white',
            border: `1px solid ${vistaActual === 'usuarios' ? '#007bff' : '#6c757d'}`,
            padding: '0.75rem 1.5rem',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 'bold',
            transition: 'all 0.2s ease',
            fontSize: '1rem'
          }}
          onClick={() => setVistaActual('usuarios')}
        >
          Usuarios
        </button>
        <button 
          className={`btn ${vistaActual === 'vehiculos' ? 'btn-primary' : 'btn-secondary'}`}
          style={{
            backgroundColor: vistaActual === 'vehiculos' ? '#007bff' : '#6c757d',
            color: 'white',
            border: `1px solid ${vistaActual === 'vehiculos' ? '#007bff' : '#6c757d'}`,
            padding: '0.75rem 1.5rem',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 'bold',
            transition: 'all 0.2s ease',
            fontSize: '1rem'
          }}
          onClick={() => setVistaActual('vehiculos')}
        >
          Vehículos
        </button>
      </div>

      {vistaActual === 'usuarios' ? renderUsuarios() : renderVehiculos()}
    </div>
  );
};

// Componente para editar usuario
const FormularioEditarUsuario = ({ usuario, tarifasDisponibles, onGuardar, onCancelar }) => {
  const [datos, setDatos] = useState({
    nombre: usuario.nombre || '',
    apellido: usuario.apellido || '',
    email: usuario.email || '',
    rol: usuario.rol || 'cliente',
    asociado: usuario.asociado || false,
    tarifaAsignada: usuario.tarifaAsignada?._id || '',
    montoDisponible: usuario.montoDisponible || 0,
    motivo: ''
  });

  const manejarSubmit = (e) => {
    e.preventDefault();
    
    // Validar que si se cambia el saldo, se proporcione un motivo
    if (datos.montoDisponible !== usuario.montoDisponible) {
      if (!datos.motivo || datos.motivo.trim() === '') {
        alert('El motivo es obligatorio cuando se modifica el saldo del usuario');
        return;
      }
    }
    
    onGuardar(datos);
  };

  return (
    <form onSubmit={manejarSubmit} className="formulario-editar">
      <h4>Editando Usuario</h4>
      
      <div className="form-group">
        <label>Nombre:</label>
        <input
          type="text"
          className="form-control"
          value={datos.nombre}
          onChange={(e) => setDatos({ ...datos, nombre: e.target.value })}
          required
        />
      </div>

      <div className="form-group">
        <label>Apellido:</label>
        <input
          type="text"
          className="form-control"
          value={datos.apellido}
          onChange={(e) => setDatos({ ...datos, apellido: e.target.value })}
          required
        />
      </div>

      <div className="form-group">
        <label>Email:</label>
        <input
          type="email"
          className="form-control"
          value={datos.email}
          onChange={(e) => setDatos({ ...datos, email: e.target.value })}
          required
        />
      </div>

      <div className="form-group">
        <label>Rol:</label>
        <select
          className="form-control"
          value={datos.rol}
          onChange={(e) => setDatos({ ...datos, rol: e.target.value })}
          required
        >
          <option value="cliente">Cliente</option>
          <option value="admin">Administrador</option>
        </select>
      </div>

      <div className="form-group">
        <label>
          <input
            type="checkbox"
            checked={datos.asociado}
            onChange={(e) => setDatos({ ...datos, asociado: e.target.checked })}
          />
          Usuario Asociado
        </label>
      </div>

      <div className="form-group">
        <label>Tarifa Asignada:</label>
        <select
          className="form-control"
          value={datos.tarifaAsignada}
          onChange={(e) => setDatos({ ...datos, tarifaAsignada: e.target.value })}
        >
          <option value="">Sin tarifa específica</option>
          {tarifasDisponibles.map(tarifa => (
            <option key={tarifa._id} value={tarifa._id}>
              {tarifa.tipoUsuario} - ${tarifa.precioPorHora}/hora
              {tarifa.descripcion && ` (${tarifa.descripcion})`}
            </option>
          ))}
        </select>
        <small className="form-text text-muted">
          Si no se asigna una tarifa específica, se usará la tarifa por defecto según el tipo de usuario.
        </small>
      </div>

      <div className="form-group">
        <label>Saldo Disponible:</label>
        <input
          type="number"
          className="form-control"
          value={datos.montoDisponible}
          onChange={(e) => setDatos({ ...datos, montoDisponible: parseFloat(e.target.value) || 0 })}
          min="0"
          step="0.01"
        />
      </div>

      {datos.montoDisponible !== usuario.montoDisponible && (
        <div className="form-group">
          <label>Motivo del cambio de saldo (obligatorio):</label>
          <textarea
            className="form-control"
            value={datos.motivo}
            onChange={(e) => setDatos({ ...datos, motivo: e.target.value })}
            placeholder="Explique el motivo del cambio de saldo..."
            rows="3"
            required
          />
        </div>
      )}

      <div className="form-actions" style={{ 
        display: 'flex',
        gap: '0.5rem',
        marginTop: '1rem'
      }}>
        <button type="submit" className="btn btn-success" style={{
          backgroundColor: '#28a745',
          color: 'white',
          border: '1px solid #28a745',
          padding: '0.5rem 1rem',
          borderRadius: '4px',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          flex: 1
        }}>
          Guardar
        </button>
        <button type="button" className="btn btn-secondary" onClick={onCancelar} style={{
          backgroundColor: '#6c757d',
          color: 'white',
          border: '1px solid #6c757d',
          padding: '0.5rem 1rem',
          borderRadius: '4px',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          flex: 1
        }}>
          Cancelar
        </button>
      </div>
    </form>
  );
};

// Componente para agregar nuevo vehículo
const FormularioNuevoVehiculo = ({ vehiculo, usuarios, onChange, onSubmit, onCancelar }) => {
  const manejarCambio = (campo, valor) => {
    onChange({ ...vehiculo, [campo]: valor });
  };

  return (
    <form onSubmit={onSubmit} className="formulario-vehiculo">
      <h4>Agregar Nuevo Vehículo</h4>
      
      <div className="form-group">
        <label>Usuario Propietario:</label>
        <select
          className="form-control"
          value={vehiculo.usuarioDni}
          onChange={(e) => manejarCambio('usuarioDni', e.target.value)}
          required
        >
          <option value="">Seleccionar usuario...</option>
          {usuarios.map(user => (
            <option key={user.dni} value={user.dni}>
              {user.nombre} {user.apellido} (DNI: {user.dni})
            </option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label>Dominio:</label>
        <input
          type="text"
          className="form-control"
          value={vehiculo.dominio}
          onChange={(e) => manejarCambio('dominio', e.target.value.toUpperCase())}
          placeholder="ABC123"
          required
        />
      </div>

      <div className="form-group">
        <label>Tipo:</label>
        <select
          className="form-control"
          value={vehiculo.tipo}
          onChange={(e) => manejarCambio('tipo', e.target.value)}
          required
        >
          <option value="auto">Auto</option>
          <option value="moto">Moto</option>
        </select>
      </div>

      <div className="form-group">
        <label>Marca:</label>
        <input
          type="text"
          className="form-control"
          value={vehiculo.marca}
          onChange={(e) => manejarCambio('marca', e.target.value)}
          required
        />
      </div>

      <div className="form-group">
        <label>Modelo:</label>
        <input
          type="text"
          className="form-control"
          value={vehiculo.modelo}
          onChange={(e) => manejarCambio('modelo', e.target.value)}
          required
        />
      </div>

      <div className="form-group">
        <label>Año:</label>
        <input
          type="number"
          className="form-control"
          value={vehiculo.año}
          onChange={(e) => manejarCambio('año', e.target.value)}
          min="1900"
          max="2030"
          required
        />
      </div>

      <div className="form-group">
        <label>Motivo para agregar el vehículo (obligatorio):</label>
        <textarea
          className="form-control"
          value={vehiculo.motivo}
          onChange={(e) => manejarCambio('motivo', e.target.value)}
          placeholder="Explique el motivo para agregar este vehículo..."
          rows="3"
          required
        />
      </div>

      <div className="form-actions" style={{ 
        display: 'flex',
        gap: '0.5rem',
        marginTop: '1rem'
      }}>
        <button type="submit" className="btn btn-success" style={{
          backgroundColor: '#28a745',
          color: 'white',
          border: '1px solid #28a745',
          padding: '0.5rem 1rem',
          borderRadius: '4px',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          flex: 1
        }}>
          Agregar Vehículo
        </button>
        <button type="button" className="btn btn-secondary" onClick={onCancelar} style={{
          backgroundColor: '#6c757d',
          color: 'white',
          border: '1px solid #6c757d',
          padding: '0.5rem 1rem',
          borderRadius: '4px',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          flex: 1
        }}>
          Cancelar
        </button>
      </div>
    </form>
  );
};

// Componente para editar vehículo
const FormularioEditarVehiculo = ({ vehiculo, usuarios, onGuardar, onCancelar }) => {
  const [datos, setDatos] = useState({
    nuevoDominio: vehiculo.dominio || '',
    tipo: vehiculo.tipo || 'auto',
    marca: vehiculo.marca || '',
    modelo: vehiculo.modelo || '',
    año: vehiculo.año || '',
    usuarioDni: vehiculo.propietario?.dni || '',
    motivo: ''
  });

  const manejarSubmit = (e) => {
    e.preventDefault();
    
    // Validar que el motivo esté presente
    if (!datos.motivo || datos.motivo.trim() === '') {
      alert('El motivo es obligatorio para modificar un vehículo');
      return;
    }
    
    onGuardar(datos);
  };

  return (
    <form onSubmit={manejarSubmit} className="formulario-editar">
      <h4>Editando Vehículo</h4>
      
      <div className="form-group">
        <label>Propietario:</label>
        <select
          className="form-control"
          value={datos.usuarioDni}
          onChange={(e) => setDatos({ ...datos, usuarioDni: e.target.value })}
          required
        >
          <option value="">Seleccionar usuario...</option>
          {usuarios.map(user => (
            <option key={user.dni} value={user.dni}>
              {user.nombre} {user.apellido} (DNI: {user.dni})
            </option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label>Dominio:</label>
        <input
          type="text"
          className="form-control"
          value={datos.nuevoDominio}
          onChange={(e) => setDatos({ ...datos, nuevoDominio: e.target.value.toUpperCase() })}
          required
        />
      </div>

      <div className="form-group">
        <label>Tipo:</label>
        <select
          className="form-control"
          value={datos.tipo}
          onChange={(e) => setDatos({ ...datos, tipo: e.target.value })}
          required
        >
          <option value="auto">Auto</option>
          <option value="moto">Moto</option>
        </select>
      </div>

      <div className="form-group">
        <label>Marca:</label>
        <input
          type="text"
          className="form-control"
          value={datos.marca}
          onChange={(e) => setDatos({ ...datos, marca: e.target.value })}
          required
        />
      </div>

      <div className="form-group">
        <label>Modelo:</label>
        <input
          type="text"
          className="form-control"
          value={datos.modelo}
          onChange={(e) => setDatos({ ...datos, modelo: e.target.value })}
          required
        />
      </div>

      <div className="form-group">
        <label>Año:</label>
        <input
          type="number"
          className="form-control"
          value={datos.año}
          onChange={(e) => setDatos({ ...datos, año: e.target.value })}
          min="1900"
          max="2030"
          required
        />
      </div>

      <div className="form-group">
        <label>Motivo de la modificación (obligatorio):</label>
        <textarea
          className="form-control"
          value={datos.motivo}
          onChange={(e) => setDatos({ ...datos, motivo: e.target.value })}
          placeholder="Explique el motivo de la modificación del vehículo..."
          rows="3"
          required
        />
      </div>

      <div className="form-actions" style={{ 
        display: 'flex',
        gap: '0.5rem',
        marginTop: '1rem'
      }}>
        <button type="submit" className="btn btn-success" style={{
          backgroundColor: '#28a745',
          color: 'white',
          border: '1px solid #28a745',
          padding: '0.5rem 1rem',
          borderRadius: '4px',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          flex: 1
        }}>
          Guardar
        </button>
        <button type="button" className="btn btn-secondary" onClick={onCancelar} style={{
          backgroundColor: '#6c757d',
          color: 'white',
          border: '1px solid #6c757d',
          padding: '0.5rem 1rem',
          borderRadius: '4px',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          flex: 1
        }}>
          Cancelar
        </button>
      </div>
    </form>
  );
};

export default AdminGestion;
