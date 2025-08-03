import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import Navbar from './Navbar';
import '../styles/theme.css';

function Perfil() {
  const { token, updateUser } = useAuth();
  const [datosBasicos, setDatosBasicos] = useState({
    nombre: '',
    apellido: ''
  });
  const [cambioContrasena, setCambioContrasena] = useState({
    contrasenaActual: '',
    nuevaContrasena: '',
    confirmarContrasena: ''
  });
  
  const [mensaje, setMensaje] = useState(null);
  const [loading, setLoading] = useState(false);
  const [perfil, setPerfil] = useState(null);
  const [vistaActiva, setVistaActiva] = useState('datos'); // 'datos', 'contrasena'

  useEffect(() => {
    const cargarPerfil = async () => {
      try {
        const response = await fetch('http://localhost:3000/api/perfil', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          setPerfil(data.usuario);
        }
      } catch (error) {
        console.error('Error al cargar perfil:', error);
        setMensaje({ type: 'error', text: 'Error al cargar el perfil' });
      }
    };

    cargarPerfil();
  }, [token]);

  useEffect(() => {
    if (perfil) {
      setDatosBasicos({
        nombre: perfil.nombre || '',
        apellido: perfil.apellido || ''
      });
    }
  }, [perfil]);

  const actualizarDatosBasicos = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('http://localhost:3000/api/perfil/datos-basicos', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(datosBasicos)
      });

      const data = await response.json();

      if (response.ok) {
        setMensaje({ type: 'success', text: 'Datos actualizados exitosamente' });
        setPerfil(data.usuario);
        updateUser(data.usuario); // Actualizar contexto de autenticación
      } else {
        setMensaje({ type: 'error', text: data.mensaje });
      }
    } catch (error) {
      setMensaje({ type: 'error', text: 'Error al actualizar datos' });
    } finally {
      setLoading(false);
    }
  };

  const cambiarContrasenaHandler = async (e) => {
    e.preventDefault();

    if (cambioContrasena.nuevaContrasena !== cambioContrasena.confirmarContrasena) {
      setMensaje({ type: 'error', text: 'Las contraseñas no coinciden' });
      return;
    }

    if (cambioContrasena.nuevaContrasena.length < 6) {
      setMensaje({ type: 'error', text: 'La nueva contraseña debe tener al menos 6 caracteres' });
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('http://localhost:3000/api/perfil/cambiar-contrasena', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          contrasenaActual: cambioContrasena.contrasenaActual,
          nuevaContrasena: cambioContrasena.nuevaContrasena
        })
      });

      const data = await response.json();

      if (response.ok) {
        setMensaje({ type: 'success', text: 'Contraseña cambiada exitosamente' });
        setCambioContrasena({
          contrasenaActual: '',
          nuevaContrasena: '',
          confirmarContrasena: ''
        });
      } else {
        setMensaje({ type: 'error', text: data.mensaje });
      }
    } catch (error) {
      setMensaje({ type: 'error', text: 'Error al cambiar contraseña' });
    } finally {
      setLoading(false);
    }
  };

  if (!perfil) {
    return (
      <div>
        <Navbar />
        <div className="container">
          <div className="card" style={{ textAlign: 'center', marginTop: '50px' }}>
            <p>Cargando perfil...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Navbar />
      <div className="container" style={{ maxWidth: '800px', margin: '20px auto' }}>
        <div className="card">
          <h2 style={{ textAlign: 'center', marginBottom: '30px' }}>
            Mi Perfil
          </h2>

          {mensaje && (
            <div
              className={`alert ${mensaje.type === 'success' ? 'alert-success' : 'alert-error'}`}
              style={{ marginBottom: '20px' }}
            >
              {mensaje.text}
            </div>
          )}

          {/* Navegación de pestañas */}
          <div style={{
            display: 'flex',
            borderBottom: '2px solid #eee',
            marginBottom: '30px',
            flexWrap: 'wrap'
          }}>
            <button
              onClick={() => setVistaActiva('datos')}
              className={`tab-button ${vistaActiva === 'datos' ? 'active' : ''}`}
              style={{
                padding: '10px 20px',
                border: 'none',
                background: vistaActiva === 'datos' ? '#007bff' : 'transparent',
                color: vistaActiva === 'datos' ? 'white' : '#666',
                cursor: 'pointer',
                borderRadius: '5px 5px 0 0',
                marginRight: '5px'
              }}
            >
              Datos Personales
            </button>
            <button
              onClick={() => setVistaActiva('contrasena')}
              className={`tab-button ${vistaActiva === 'contrasena' ? 'active' : ''}`}
              style={{
                padding: '10px 20px',
                border: 'none',
                background: vistaActiva === 'contrasena' ? '#007bff' : 'transparent',
                color: vistaActiva === 'contrasena' ? 'white' : '#666',
                cursor: 'pointer',
                borderRadius: '5px 5px 0 0'
              }}
            >
              Cambiar Contraseña
            </button>
          </div>

          {/* Vista de Datos Personales */}
          {vistaActiva === 'datos' && (
            <div>
              <h3>Datos Personales</h3>
              
              <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '5px' }}>
                <p><strong>DNI:</strong> {perfil.dni} <span style={{ color: '#666', fontSize: '0.9em' }}>(no modificable)</span></p>
                <p><strong>Email:</strong> {perfil.email} <span style={{ color: '#666', fontSize: '0.9em' }}>(no modificable)</span></p>
                <p><strong>Rol:</strong> {perfil.rol === 'admin' ? 'Administrador' : 'Cliente'}</p>
                <p><strong>Usuario Asociado:</strong> {perfil.asociado ? 'Sí' : 'No'}</p>
                <p><strong>Saldo Disponible:</strong> ${perfil.montoDisponible}</p>
                <p><strong>Vehículos Registrados:</strong> {perfil.vehiculos ? perfil.vehiculos.length : 0} <span style={{ color: '#666', fontSize: '0.9em' }}>(gestionar desde Dashboard)</span></p>
              </div>

              <form onSubmit={actualizarDatosBasicos}>
                <div className="form-control">
                  <label>Nombre:</label>
                  <input
                    className="input"
                    type="text"
                    value={datosBasicos.nombre}
                    onChange={(e) => setDatosBasicos({...datosBasicos, nombre: e.target.value})}
                    required
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  />
                </div>

                <div className="form-control">
                  <label>Apellido:</label>
                  <input
                    className="input"
                    type="text"
                    value={datosBasicos.apellido}
                    onChange={(e) => setDatosBasicos({...datosBasicos, apellido: e.target.value})}
                    required
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  />
                </div>

                <div className="form-control">
                  <button
                    type="submit"
                    className="button button-primary"
                    disabled={loading}
                    style={{ 
                      width: '100%', 
                      boxSizing: 'border-box',
                      minHeight: '44px'
                    }}
                  >
                    {loading ? 'Guardando...' : 'Guardar Cambios'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Vista de Cambiar Contraseña */}
          {vistaActiva === 'contrasena' && (
            <div>
              <h3>Cambiar Contraseña</h3>

              <form onSubmit={cambiarContrasenaHandler}>
                <div className="form-control">
                  <label>Contraseña Actual:</label>
                  <input
                    className="input"
                    type="password"
                    value={cambioContrasena.contrasenaActual}
                    onChange={(e) => setCambioContrasena({...cambioContrasena, contrasenaActual: e.target.value})}
                    required
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  />
                </div>

                <div className="form-control">
                  <label>Nueva Contraseña:</label>
                  <input
                    className="input"
                    type="password"
                    value={cambioContrasena.nuevaContrasena}
                    onChange={(e) => setCambioContrasena({...cambioContrasena, nuevaContrasena: e.target.value})}
                    required
                    minLength="6"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  />
                </div>

                <div className="form-control">
                  <label>Confirmar Nueva Contraseña:</label>
                  <input
                    className="input"
                    type="password"
                    value={cambioContrasena.confirmarContrasena}
                    onChange={(e) => setCambioContrasena({...cambioContrasena, confirmarContrasena: e.target.value})}
                    required
                    minLength="6"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  />
                </div>

                <div className="form-control">
                  <button
                    type="submit"
                    className="button button-primary"
                    disabled={loading}
                    style={{ 
                      width: '100%', 
                      boxSizing: 'border-box',
                      minHeight: '44px'
                    }}
                  >
                    {loading ? 'Cambiando...' : 'Cambiar Contraseña'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Perfil;
