import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  obtenerTodosLosUsuarios, 
  modificarUsuario, 
  eliminarUsuario,
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
    // Cargar usuarios siempre para poder usarlos en formularios
    cargarUsuarios();
    
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
      <h3>Gestión de Usuarios</h3>
      
      {cargando && <p>Cargando usuarios...</p>}
      
      <div className="usuarios-list">
        {usuarios.map(usuario => (
          <div key={usuario.dni} className="usuario-card">
            {usuarioEditando === usuario.dni ? (
              <FormularioEditarUsuario 
                usuario={usuario}
                onGuardar={(datos) => manejarModificarUsuario(usuario.dni, datos)}
                onCancelar={() => setUsuarioEditando(null)}
              />
            ) : (
              <>
                <h3>{usuario.nombre} {usuario.apellido}</h3>
                <p><strong>DNI:</strong> {usuario.dni}</p>
                <p><strong>Email:</strong> {usuario.email}</p>
                <p><strong>Rol:</strong> {usuario.rol}</p>
                <p><strong>Asociado:</strong> {usuario.asociado ? 'Sí' : 'No'}</p>
                <p><strong>Saldo:</strong> ${usuario.montoDisponible || 0}</p>
                <p><strong>Verificado:</strong> {usuario.verificado ? 'Sí' : 'No'}</p>
                
                <div className="usuario-acciones">
                  <button 
                    className="btn btn-primary"
                    onClick={() => setUsuarioEditando(usuario.dni)}
                  >
                    Modificar
                  </button>
                  {usuario.rol !== 'admin' && (
                    <button 
                      className="btn btn-danger"
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
      <div className="vehiculos-header">
        <h3>Gestión de Vehículos</h3>
        <button 
          className="btn btn-success"
          onClick={() => setMostrarFormVehiculo(true)}
        >
          Agregar Vehículo
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
      
      {cargando && <p>Cargando vehículos...</p>}
      
      <div className="vehiculos-list">
        {vehiculos.map(vehiculo => (
          <div key={vehiculo._id} className="vehiculo-card">
            {vehiculoEditando === vehiculo.dominio ? (
              <FormularioEditarVehiculo 
                vehiculo={vehiculo}
                usuarios={usuarios}
                onGuardar={(datos) => manejarModificarVehiculo(vehiculo.dominio, datos)}
                onCancelar={() => setVehiculoEditando(null)}
              />
            ) : (
              <>
                <h3>{vehiculo.dominio}</h3>
                <p><strong>Tipo:</strong> {vehiculo.tipo}</p>
                <p><strong>Marca:</strong> {vehiculo.marca}</p>
                <p><strong>Modelo:</strong> {vehiculo.modelo}</p>
                <p><strong>Año:</strong> {vehiculo.año}</p>
                {vehiculo.propietario && (
                  <p><strong>Propietario:</strong> {vehiculo.propietario.nombre} {vehiculo.propietario.apellido} (DNI: {vehiculo.propietario.dni})</p>
                )}
                
                <div className="vehiculo-acciones">
                  <button 
                    className="btn btn-primary"
                    onClick={() => setVehiculoEditando(vehiculo.dominio)}
                  >
                    Modificar
                  </button>
                  <button 
                    className="btn btn-danger"
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
    <div className="admin-gestion">
      <div className="admin-header">
        <div>
          <h1 className="admin-title">Gestión de Usuarios y Vehículos</h1>
          <p className="admin-subtitle">Administra usuarios y vehículos del sistema</p>
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

      <div className="admin-nav">
        <button 
          className={`btn ${vistaActual === 'usuarios' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setVistaActual('usuarios')}
        >
          Usuarios
        </button>
        <button 
          className={`btn ${vistaActual === 'vehiculos' ? 'btn-primary' : 'btn-secondary'}`}
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
const FormularioEditarUsuario = ({ usuario, onGuardar, onCancelar }) => {
  const [datos, setDatos] = useState({
    nombre: usuario.nombre || '',
    apellido: usuario.apellido || '',
    email: usuario.email || '',
    rol: usuario.rol || 'cliente',
    asociado: usuario.asociado || false,
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

      <div className="form-actions">
        <button type="submit" className="btn btn-success">Guardar</button>
        <button type="button" className="btn btn-secondary" onClick={onCancelar}>
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

      <div className="form-actions">\
        <button type="submit" className="btn btn-success">Agregar Vehículo</button>
        <button type="button" className="btn btn-secondary" onClick={onCancelar}>
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

      <div className="form-actions">\
        <button type="submit" className="btn btn-success">Guardar</button>
        <button type="button" className="btn btn-secondary" onClick={onCancelar}>
          Cancelar
        </button>
      </div>
    </form>
  );
};

export default AdminGestion;
