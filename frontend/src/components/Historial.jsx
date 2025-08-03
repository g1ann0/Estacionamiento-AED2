import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import Navbar from './Navbar';
import '../styles/theme.css';
import { precioService } from '../services/precioService';
import { comprobanteService } from '../services/comprobanteService';

function Historial() {
  const { usuario: usuarioAuth, logout } = useAuth();
  const [transacciones, setTransacciones] = useState([]);
  const [comprobantes, setComprobantes] = useState([]);
  const [usuario, setUsuario] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mensaje, setMensaje] = useState(null);
  const [filtro, setFiltro] = useState('');
  const [vistaActual, setVistaActual] = useState('transacciones');
  const [tarifaActual, setTarifaActual] = useState(null);
  const navigate = useNavigate();

  // Función para cargar transacciones
  const cargarTransacciones = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        logout();
        navigate('/login');
        return;
      }

      const res = await fetch('http://localhost:3000/api/transacciones', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (res.ok) {
        const data = await res.json();
        setTransacciones(data.transacciones || []);
      } else if (res.status === 401 || res.status === 403) {
        logout();
        navigate('/login');
      } else {
        setMensaje({ type: 'error', text: 'Error al cargar transacciones' });
      }
    } catch (error) {
      console.error('Error al cargar transacciones:', error);
      setMensaje({ type: 'error', text: 'Error al conectar con el servidor' });
    }
  };

  // Cargar comprobantes
  const cargarComprobantes = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:3000/api/comprobantes', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (res.ok) {
        const data = await res.json();
        setComprobantes(data.comprobantes || []);
      }
    } catch (error) {
      console.error('Error al cargar comprobantes:', error);
      setMensaje({ type: 'error', text: 'Error al cargar comprobantes' });
    }
  };

  // Descargar PDF del comprobante
  const descargarPDFComprobante = async (nroComprobante) => {
    try {
      const token = localStorage.getItem('token');
      await comprobanteService.descargarPDFComprobante(nroComprobante, token);
      setMensaje({ type: 'success', text: 'PDF del comprobante descargado exitosamente' });
    } catch (error) {
      console.error('Error al descargar PDF:', error);
      setMensaje({ type: 'error', text: error.message });
    }
  };

  // Función para cargar datos del usuario
  const cargarDatosUsuario = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`http://localhost:3000/api/usuarios/${usuarioAuth.dni}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (res.ok) {
        const data = await res.json();
        setUsuario(data.usuario);
        
        // Cargar tarifa actual
        const precio = await precioService.obtenerPrecioParaUsuario(data.usuario.asociado);
        setTarifaActual(precio);
      } else if (res.status === 401) {
        logout();
        navigate('/login');
      }
    } catch (error) {
      console.error('Error al cargar datos del usuario:', error);
    }
  };

  useEffect(() => {
    if (!usuarioAuth) {
      navigate('/login');
      return;
    }

    if (usuarioAuth.rol === 'admin') {
      navigate('/admin');
      return;
    }

    const cargarDatos = async () => {
      setLoading(true);
      await Promise.all([
        cargarTransacciones(),
        cargarComprobantes(),
        cargarDatosUsuario()
      ]);
      setLoading(false);
    };

    cargarDatos();
  }, [usuarioAuth, navigate, logout]);

  // Función para obtener la tarifa a mostrar
  const obtenerTarifaDisplay = () => {
    if (tarifaActual !== null) {
      return tarifaActual;
    }
    return usuario?.asociado ? 250 : 500;
  };

  // Filtrar transacciones
  const transaccionesFiltradas = transacciones.filter(transaccion => {
    if (!filtro) return true;
    
    const vehiculo = usuario?.vehiculos?.find(v => v.dominio === transaccion.vehiculo?.dominio);
    const textoCompleto = `
      ${transaccion.vehiculo?.dominio || ''}
      ${vehiculo?.marca || ''} ${vehiculo?.modelo || ''}
      ${vehiculo?.tipo || ''}
      ${transaccion.tipo || ''}
      ${transaccion.porton || ''}
      ${new Date(transaccion.fechaHora || transaccion.fecha).toLocaleString()}
    `.toLowerCase();
    
    return textoCompleto.includes(filtro.toLowerCase());
  });

  // Filtrar comprobantes
  const comprobantesFiltrados = comprobantes.filter(comprobante => {
    if (!filtro) return true;
    
    const textoCompleto = `
      ${comprobante.nroComprobante || ''}
      ${comprobante.estado || ''}
      ${comprobante.montoAcreditado || ''}
      ${new Date(comprobante.fecha).toLocaleString()}
    `.toLowerCase();
    
    return textoCompleto.includes(filtro.toLowerCase());
  });

  const renderTransacciones = () => (
    <div className="card">
      <div className="card-header">
        <h2>Mis Transacciones ({transaccionesFiltradas.length})</h2>
        <div className="admin-controls">
          <input
            type="text"
            placeholder="Buscar por vehículo, tipo, portón..."
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            className="input"
            style={{ maxWidth: '300px' }}
          />
          <button
            onClick={cargarTransacciones}
            className="button button-secondary"
          >
            Actualizar
          </button>
        </div>
      </div>

      <div className="transacciones-container">
        {transaccionesFiltradas.length > 0 ? (
          <div className="transacciones-grid">
            {transaccionesFiltradas.map((transaccion) => {
              const vehiculo = usuario?.vehiculos?.find(v => v.dominio === transaccion.vehiculo?.dominio);
              
              return (
                <div key={transaccion._id} className="transaccion-card">
                  <div className="transaccion-header">
                    <h3>{transaccion.vehiculo?.dominio || 'No disponible'}</h3>
                    <span className={`status-badge ${transaccion.tipo === 'ingreso' ? 'pending' : 'verified'}`}>
                      {transaccion.tipo}
                    </span>
                  </div>
                  
                  <div className="transaccion-details">
                    <p><strong>Vehículo:</strong> {vehiculo?.marca} {vehiculo?.modelo}</p>
                    <p><strong>Tipo:</strong> {vehiculo?.tipo}</p>
                    <p><strong>Portón:</strong> {transaccion.porton || 'No especificado'}</p>
                    <p><strong>Fecha y Hora:</strong> {new Date(transaccion.fechaHora || transaccion.fecha).toLocaleString()}</p>
                    
                    {transaccion.tipo === 'egreso' && (
                      <>
                        <p><strong>Tarifa Aplicada:</strong> ${obtenerTarifaDisplay()}/hora</p>
                        <p><strong>Monto Total:</strong> 
                          <span style={{ color: '#dc3545', fontWeight: 'bold' }}>
                            -${typeof transaccion.montoTotal === 'number' ? transaccion.montoTotal.toFixed(2) : (transaccion.monto || 0).toFixed(2)}
                          </span>
                        </p>
                        {transaccion.duracion && (
                          <p><strong>Duración:</strong> {transaccion.duracion}</p>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="no-data">
            <p>No hay transacciones para mostrar</p>
            {filtro && (
              <p>Intenta cambiar los filtros de búsqueda</p>
            )}
          </div>
        )}
      </div>
    </div>
  );

  const renderComprobantes = () => (
    <div className="card">
      <div className="card-header">
        <h2>Mis Comprobantes ({comprobantesFiltrados.length})</h2>
        <div className="admin-controls">
          <input
            type="text"
            placeholder="Buscar por número, estado, monto..."
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            className="input"
            style={{ maxWidth: '300px' }}
          />
          <button
            onClick={cargarComprobantes}
            className="button button-secondary"
          >
            Actualizar
          </button>
        </div>
      </div>

      <div className="comprobantes-container">
        {comprobantesFiltrados.length > 0 ? (
          <div className="comprobantes-grid">
            {comprobantesFiltrados.map((comprobante) => (
              <div key={comprobante.nroComprobante} className="comprobante-card">
                <div className="comprobante-header">
                  <h3>#{comprobante.nroComprobante}</h3>
                  <span className={`status-badge ${comprobante.estado === 'aprobado' ? 'verified' : 
                    comprobante.estado === 'rechazado' ? 'rejected' : 'pending'}`}>
                    {comprobante.estado === 'aprobado' ? 'Aprobado' : 
                     comprobante.estado === 'rechazado' ? 'Rechazado' : 'Pendiente'}
                  </span>
                </div>
                
                <div className="comprobante-details">
                  <p><strong>Usuario:</strong> {usuario?.nombre} {usuario?.apellido}</p>
                  <p><strong>DNI:</strong> {usuario?.dni}</p>
                  <p><strong>Fecha:</strong> {new Date(comprobante.fecha).toLocaleString()}</p>
                  <p><strong>Monto Acreditado:</strong> 
                    <span style={{ color: '#28a745', fontWeight: 'bold' }}>
                      +${comprobante.montoAcreditado}
                    </span>
                  </p>
                  {comprobante.estado !== 'pendiente' && (
                    <p><strong>Saldo Disponible:</strong> ${comprobante.montoDisponible}</p>
                  )}
                  
                  {usuario?.vehiculos && usuario.vehiculos.length > 0 && (
                    <div className="vehiculos-registrados">
                      <p><strong>Vehículos Registrados:</strong></p>
                      <ul>
                        {usuario.vehiculos.map(v => (
                          <li key={v.dominio}>{v.dominio} - {v.marca} {v.modelo}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {/* Botón para descargar PDF */}
                  <div className="comprobante-actions" style={{ marginTop: '1rem', borderTop: '1px solid #eee', paddingTop: '1rem' }}>
                    <button
                      className="button button-primary"
                      onClick={() => descargarPDFComprobante(comprobante.nroComprobante)}
                      style={{ width: '100%' }}
                    >
                      📄 Descargar Comprobante PDF
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="no-data">
            <p>No hay comprobantes para mostrar</p>
            {filtro && (
              <p>Intenta cambiar los filtros de búsqueda</p>
            )}
          </div>
        )}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="dashboard">
        <Navbar />
        <div className="container">
          <div className="card" style={{ textAlign: 'center' }}>
            <p>Cargando historial...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <Navbar />
      <div className="container">
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

        <div className="admin-dashboard">
          <div className="admin-header">
            <h1>Mi Historial</h1>
            <div className="saldo-info" style={{ 
              backgroundColor: '#f8f9fa',
              padding: '15px',
              borderRadius: '8px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              marginBottom: '20px'
            }}>
              <h3 style={{ margin: 0, color: '#2c3e50' }}>
                Saldo Disponible: <span style={{ color: '#28a745', fontWeight: 'bold' }}>${usuario?.montoDisponible || 0}</span>
              </h3>
              <p style={{ margin: '5px 0 0 0', color: '#6c757d' }}>
                Tarifa actual: ${obtenerTarifaDisplay()}/hora
                {usuario?.asociado && <span style={{ color: '#28a745', fontWeight: 'bold' }}> (Usuario Asociado)</span>}
              </p>
              <p style={{ margin: '5px 0 0 0', color: '#6c757d', fontSize: '0.9em' }}>
                Registrado el: {usuario?.fechaRegistro ? new Date(usuario.fechaRegistro).toLocaleDateString('es-AR', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                }) : 'Fecha no disponible'}
              </p>
            </div>

            <div className="admin-nav">
              <button 
                className={`button ${vistaActual === 'transacciones' ? 'button-primary' : 'button-secondary'}`}
                onClick={() => {
                  setVistaActual('transacciones');
                  setFiltro('');
                }}
              >
                Transacciones
              </button>
              <button 
                className={`button ${vistaActual === 'comprobantes' ? 'button-primary' : 'button-secondary'}`}
                onClick={() => {
                  setVistaActual('comprobantes');
                  setFiltro('');
                }}
              >
                Comprobantes
              </button>
            </div>
          </div>

          <div className="admin-content">
            {vistaActual === 'transacciones' && renderTransacciones()}
            {vistaActual === 'comprobantes' && renderComprobantes()}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Historial;
