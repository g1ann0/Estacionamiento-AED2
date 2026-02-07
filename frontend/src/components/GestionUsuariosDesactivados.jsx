import React, { useState, useEffect } from 'react';
import '../styles/gestion-usuarios-desactivados.css';

const API_URL = 'http://localhost:3000/api';

const GestionUsuariosDesactivados = () => {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState(null);
  const [mostrarModalReactivacion, setMostrarModalReactivacion] = useState(false);
  const [mostrarHistorial, setMostrarHistorial] = useState(false);
  const [historial, setHistorial] = useState([]);
  
  // Datos para reactivación
  const [nuevoEmail, setNuevoEmail] = useState('');
  const [motivoReactivacion, setMotivoReactivacion] = useState('');

  useEffect(() => {
    cargarUsuariosDesactivados();
  }, []);

  const cargarUsuariosDesactivados = async () => {
    try {
      setLoading(true);
      setError('');
      
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/admin/usuarios/desactivados`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Error al cargar usuarios desactivados');
      }

      const data = await response.json();
      setUsuarios(data.usuarios);
    } catch (err) {
      console.error('Error al cargar usuarios desactivados:', err);
      setError(err.response?.data?.mensaje || 'Error al cargar usuarios desactivados');
    } finally {
      setLoading(false);
    }
  };

  const abrirModalReactivacion = (usuario) => {
    setUsuarioSeleccionado(usuario);
    setNuevoEmail('');
    setMotivoReactivacion('');
    setMostrarModalReactivacion(true);
    setError('');
    setExito('');
  };

  const cerrarModalReactivacion = () => {
    setMostrarModalReactivacion(false);
    setUsuarioSeleccionado(null);
    setNuevoEmail('');
    setMotivoReactivacion('');
  };

  const reactivarUsuario = async (e) => {
    e.preventDefault();
    
    if (!nuevoEmail || !motivoReactivacion) {
      setError('Debe completar todos los campos');
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/admin/usuarios/reactivar`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          dni: usuarioSeleccionado.dniOriginal,
          nuevoEmail,
          motivo: motivoReactivacion
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.mensaje || 'Error al reactivar usuario');
      }

      const data = await response.json();
      setExito(data.mensaje);
      cerrarModalReactivacion();
      cargarUsuariosDesactivados();
      
      setTimeout(() => setExito(''), 5000);
    } catch (err) {
      console.error('Error al reactivar usuario:', err);
      setError(err.response?.data?.mensaje || 'Error al reactivar usuario');
    } finally {
      setLoading(false);
    }
  };

  const verHistorial = async (usuario) => {
    try {
      setLoading(true);
      setError('');
      
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/admin/usuarios/${usuario.dniOriginal}/historial-activaciones`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Error al cargar historial');
      }

      const data = await response.json();
      setHistorial(data.historial);
      setUsuarioSeleccionado(usuario);
      setMostrarHistorial(true);
    } catch (err) {
      console.error('Error al cargar historial:', err);
      setError(err.response?.data?.mensaje || 'Error al cargar historial');
    } finally {
      setLoading(false);
    }
  };

  const cerrarHistorial = () => {
    setMostrarHistorial(false);
    setHistorial([]);
    setUsuarioSeleccionado(null);
  };

  const usuariosFiltrados = usuarios.filter(usuario => {
    const textoBusqueda = busqueda.toLowerCase();
    return (
      usuario.dniOriginal?.toLowerCase().includes(textoBusqueda) ||
      usuario.nombre?.toLowerCase().includes(textoBusqueda) ||
      usuario.apellido?.toLowerCase().includes(textoBusqueda) ||
      usuario.motivoDesactivacion?.toLowerCase().includes(textoBusqueda)
    );
  });

  const formatearFecha = (fecha) => {
    if (!fecha) return '-';
    return new Date(fecha).toLocaleString('es-AR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="gestion-usuarios-desactivados">
      <div className="header-section">
        <h2>👥 Usuarios Desactivados</h2>
        <p className="descripcion">Gestione los usuarios que han sido desactivados del sistema</p>
      </div>

      {error && (
        <div className="alert alert-error">
          <span className="icono">⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {exito && (
        <div className="alert alert-success">
          <span className="icono">✅</span>
          <span>{exito}</span>
        </div>
      )}

      <div className="filtros-section">
        <div className="busqueda-box">
          <input
            type="text"
            placeholder="🔍 Buscar por DNI, nombre o motivo..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="input-busqueda"
          />
        </div>
        <button onClick={cargarUsuariosDesactivados} className="btn-refrescar" disabled={loading}>
          🔄 Actualizar
        </button>
      </div>

      {loading && <div className="loading">⏳ Cargando...</div>}

      {!loading && usuariosFiltrados.length === 0 && (
        <div className="sin-resultados">
          <p>😊 No hay usuarios desactivados{busqueda && ' que coincidan con tu búsqueda'}</p>
        </div>
      )}

      {!loading && usuariosFiltrados.length > 0 && (
        <div className="tabla-container">
          <table className="tabla-usuarios">
            <thead>
              <tr>
                <th>DNI</th>
                <th>Nombre</th>
                <th>Apellido</th>
                <th>Vehículos</th>
                <th>Saldo</th>
                <th>Fecha Desactivación</th>
                <th>Motivo</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {usuariosFiltrados.map((usuario) => (
                <tr key={usuario._id}>
                  <td>{usuario.dniOriginal}</td>
                  <td>{usuario.nombre}</td>
                  <td>{usuario.apellido}</td>
                  <td className="centrado">{usuario.cantidadVehiculos}</td>
                  <td className="monto">${usuario.montoDisponible?.toFixed(2) || '0.00'}</td>
                  <td>{formatearFecha(usuario.fechaDesactivacion)}</td>
                  <td className="motivo">{usuario.motivoDesactivacion || '-'}</td>
                  <td className="acciones">
                    <button
                      onClick={() => verHistorial(usuario)}
                      className="btn-historial"
                      title="Ver historial completo"
                    >
                      📋
                    </button>
                    <button
                      onClick={() => abrirModalReactivacion(usuario)}
                      className="btn-reactivar"
                      title="Reactivar usuario"
                    >
                      ✅ Reactivar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal de Reactivación */}
      {mostrarModalReactivacion && (
        <div className="modal-overlay" onClick={cerrarModalReactivacion}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>✅ Reactivar Usuario</h3>
              <button onClick={cerrarModalReactivacion} className="btn-cerrar">✕</button>
            </div>
            
            <div className="modal-body">
              <div className="info-usuario">
                <p><strong>DNI:</strong> {usuarioSeleccionado?.dniOriginal}</p>
                <p><strong>Nombre:</strong> {usuarioSeleccionado?.nombre} {usuarioSeleccionado?.apellido}</p>
                <p><strong>Desactivado:</strong> {formatearFecha(usuarioSeleccionado?.fechaDesactivacion)}</p>
                <p><strong>Motivo desactivación:</strong> {usuarioSeleccionado?.motivoDesactivacion}</p>
              </div>

              <form onSubmit={reactivarUsuario}>
                <div className="form-group">
                  <label htmlFor="nuevoEmail">Nuevo Email *</label>
                  <input
                    type="email"
                    id="nuevoEmail"
                    value={nuevoEmail}
                    onChange={(e) => setNuevoEmail(e.target.value)}
                    placeholder="correo@ejemplo.com"
                    required
                  />
                  <small>Se enviará un email a esta dirección para que el usuario recupere su cuenta</small>
                </div>

                <div className="form-group">
                  <label htmlFor="motivoReactivacion">Motivo de Reactivación *</label>
                  <textarea
                    id="motivoReactivacion"
                    value={motivoReactivacion}
                    onChange={(e) => setMotivoReactivacion(e.target.value)}
                    placeholder="Indique el motivo de la reactivación..."
                    rows="3"
                    required
                    minLength="10"
                  />
                </div>

                <div className="modal-acciones">
                  <button type="button" onClick={cerrarModalReactivacion} className="btn-cancelar">
                    Cancelar
                  </button>
                  <button type="submit" className="btn-confirmar" disabled={loading}>
                    {loading ? 'Reactivando...' : 'Reactivar Usuario'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Historial */}
      {mostrarHistorial && (
        <div className="modal-overlay" onClick={cerrarHistorial}>
          <div className="modal-content modal-historial" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>📋 Historial de Activaciones</h3>
              <button onClick={cerrarHistorial} className="btn-cerrar">✕</button>
            </div>
            
            <div className="modal-body">
              <div className="info-usuario">
                <p><strong>Usuario:</strong> {usuarioSeleccionado?.nombre} {usuarioSeleccionado?.apellido}</p>
                <p><strong>DNI:</strong> {usuarioSeleccionado?.dniOriginal}</p>
              </div>

              {historial.length === 0 && (
                <p className="sin-historial">No hay historial de activaciones</p>
              )}

              {historial.length > 0 && (
                <div className="lista-historial">
                  {historial.map((log, index) => (
                    <div key={log._id || index} className={`registro-historial ${log.accion}`}>
                      <div className="registro-header">
                        <span className={`badge ${log.accion}`}>
                          {log.accion === 'desactivacion' ? '🔴 Desactivación' : '🟢 Reactivación'}
                        </span>
                        <span className="fecha">{formatearFecha(log.fecha)}</span>
                      </div>
                      
                      <div className="registro-detalle">
                        <p><strong>Admin:</strong> {log.admin.nombre} {log.admin.apellido} (DNI: {log.admin.dni})</p>
                        <p><strong>Motivo:</strong> {log.motivo}</p>
                        
                        {log.datosAdicionales && (
                          <div className="datos-adicionales">
                            {log.datosAdicionales.vehiculosAfectados?.length > 0 && (
                              <p><strong>Vehículos:</strong> {log.datosAdicionales.vehiculosAfectados.join(', ')}</p>
                            )}
                            {log.datosAdicionales.saldoDisponible !== undefined && (
                              <p><strong>Saldo:</strong> ${log.datosAdicionales.saldoDisponible.toFixed(2)}</p>
                            )}
                            {log.datosAdicionales.emailNotificado && (
                              <p><strong>Email notificado:</strong> {log.datosAdicionales.emailNotificado}</p>
                            )}
                            {log.datosAdicionales.ipOrigen && (
                              <p><strong>IP:</strong> {log.datosAdicionales.ipOrigen}</p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GestionUsuariosDesactivados;
