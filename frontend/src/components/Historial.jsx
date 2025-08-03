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
        
        // Cargar tarifa actual - priorizar tarifa asignada específica
        let precio;
        if (data.usuario?.tarifaAsignada?.precioPorHora) {
          console.log('Usando tarifa asignada específica:', data.usuario.tarifaAsignada.precioPorHora);
          precio = data.usuario.tarifaAsignada.precioPorHora;
        } else {
          console.log('Usando tarifa por tipo de usuario asociado:', data.usuario.asociado);
          precio = await precioService.obtenerPrecioParaUsuario(data.usuario.asociado);
        }
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
    // Priorizar tarifa asignada específica
    if (usuario?.tarifaAsignada?.precioPorHora) {
      return usuario.tarifaAsignada.precioPorHora;
    }
    
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
    <div className="transacciones-section" style={{
      backgroundColor: 'white',
      borderRadius: '12px',
      padding: '2rem',
      marginBottom: '2rem',
      boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
      border: '1px solid #e9ecef'
    }}>
      <div className="section-header" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '2rem',
        paddingBottom: '1rem',
        borderBottom: '2px solid #f8f9fa'
      }}>
        <h2 style={{ color: '#2c3e50', margin: 0 }}>
          Mis Transacciones ({transaccionesFiltradas.length})
        </h2>
        <div className="header-controls" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Buscar por vehículo, tipo, portón..."
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            style={{
              padding: '0.75rem',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '1rem',
              width: '300px'
            }}
          />
          <button
            onClick={cargarTransacciones}
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
          >
            🔄 Actualizar
          </button>
        </div>
      </div>

      <div className="transacciones-container">
        {transaccionesFiltradas.length > 0 ? (
          <div className="transacciones-grid" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))',
            gap: '1.5rem'
          }}>
            {transaccionesFiltradas.map((transaccion) => {
              const vehiculo = usuario?.vehiculos?.find(v => v.dominio === transaccion.vehiculo?.dominio);
              const esIngreso = transaccion.tipo === 'ingreso';
              
              return (
                <div key={transaccion._id} className="transaccion-card" style={{
                  background: '#fff',
                  border: '1px solid #e9ecef',
                  borderRadius: '12px',
                  padding: '1.5rem',
                  boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
                  transition: 'all 0.3s ease',
                  borderLeft: `4px solid ${esIngreso ? '#28a745' : '#dc3545'}`
                }}>
                  <div className="transaccion-header" style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '1rem',
                    paddingBottom: '0.5rem',
                    borderBottom: '1px solid #f8f9fa'
                  }}>
                    <h3 style={{ 
                      color: '#2c3e50', 
                      margin: 0,
                      fontSize: '1.3rem',
                      fontWeight: 'bold'
                    }}>
                      {transaccion.vehiculo?.dominio || 'No disponible'}
                    </h3>
                    <span style={{
                      backgroundColor: esIngreso ? '#d4edda' : '#f8d7da',
                      color: esIngreso ? '#155724' : '#721c24',
                      padding: '0.25rem 0.75rem',
                      borderRadius: '20px',
                      fontSize: '0.8rem',
                      fontWeight: 'bold',
                      textTransform: 'uppercase'
                    }}>
                      {esIngreso ? '📥 INGRESO' : '📤 EGRESO'}
                    </span>
                  </div>
                  
                  <div className="transaccion-details">
                    <p style={{ color: '#34495e', marginBottom: '0.5rem' }}>
                      <strong style={{ color: '#2c3e50' }}>Fecha/Hora:</strong> 
                      <span style={{ marginLeft: '0.5rem' }}>
                        {new Date(transaccion.fechaHora || transaccion.fecha).toLocaleString('es-AR', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </p>
                    
                    <p style={{ color: '#34495e', marginBottom: '0.5rem' }}>
                      <strong style={{ color: '#2c3e50' }}>Vehículo:</strong> 
                      <span style={{ 
                        backgroundColor: vehiculo?.tipo === 'auto' ? '#17a2b8' : '#ffc107',
                        color: vehiculo?.tipo === 'moto' ? '#212529' : 'white',
                        padding: '2px 6px',
                        borderRadius: '10px',
                        fontSize: '0.8rem',
                        marginLeft: '0.5rem'
                      }}>
                        {vehiculo?.tipo || 'N/A'}
                      </span>
                      <br />
                      <span style={{ marginLeft: '0.5rem' }}>
                        {vehiculo?.marca} {vehiculo?.modelo}
                      </span>
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
                        {transaccion.porton || 'No especificado'}
                      </span>
                    </p>
                    
                    {!esIngreso && (
                      <>
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
                            {transaccion.duracion || 'No especificada'}
                          </span>
                        </p>
                        
                        <p style={{ color: '#34495e', marginBottom: '0.5rem' }}>
                          <strong style={{ color: '#2c3e50' }}>Tarifa Aplicada:</strong> 
                          <span style={{ 
                            color: '#28a745',
                            fontWeight: 'bold',
                            fontSize: '1.1rem',
                            marginLeft: '0.5rem'
                          }}>
                            ${obtenerTarifaDisplay()}/hora
                          </span>
                        </p>
                        
                        <p style={{ color: '#34495e', marginBottom: '0.5rem' }}>
                          <strong style={{ color: '#2c3e50' }}>Monto Total:</strong> 
                          <span style={{
                            backgroundColor: '#f57c00',
                            color: 'white',
                            padding: '4px 12px',
                            borderRadius: '20px',
                            fontSize: '1.1rem',
                            fontWeight: 'bold',
                            marginLeft: '0.5rem'
                          }}>
                            -${typeof transaccion.montoTotal === 'number' ? transaccion.montoTotal.toFixed(2) : (transaccion.monto || 0).toFixed(2)}
                          </span>
                        </p>
                      </>
                    )}
                    
                    {esIngreso && (
                      <p style={{ color: '#34495e', marginBottom: '0.5rem' }}>
                        <strong style={{ color: '#2c3e50' }}>Estado:</strong> 
                        <span style={{
                          backgroundColor: '#d4edda',
                          color: '#155724',
                          padding: '4px 12px',
                          borderRadius: '20px',
                          fontSize: '0.9rem',
                          fontWeight: 'bold',
                          marginLeft: '0.5rem'
                        }}>
                          Vehículo en estacionamiento
                        </span>
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="no-data" style={{
            textAlign: 'center',
            padding: '3rem',
            color: '#6c757d',
            backgroundColor: '#f8f9fa',
            borderRadius: '8px',
            border: '1px solid #e9ecef'
          }}>
            <h3 style={{ color: '#6c757d', marginBottom: '1rem' }}>📊 No hay transacciones</h3>
            <p style={{ margin: '0.5rem 0' }}>No hay transacciones para mostrar</p>
            {filtro && (
              <p style={{ margin: '0.5rem 0', fontStyle: 'italic' }}>
                Intenta cambiar los filtros de búsqueda
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );

  const renderComprobantes = () => (
    <div className="comprobantes-section" style={{
      backgroundColor: 'white',
      borderRadius: '12px',
      padding: '2rem',
      marginBottom: '2rem',
      boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
      border: '1px solid #e9ecef'
    }}>
      <div className="section-header" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '2rem',
        paddingBottom: '1rem',
        borderBottom: '2px solid #f8f9fa'
      }}>
        <h2 style={{ color: '#2c3e50', margin: 0 }}>
          Mis Comprobantes ({comprobantesFiltrados.length})
        </h2>
        <div className="header-controls" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Buscar por número, estado, monto..."
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            style={{
              padding: '0.75rem',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '1rem',
              width: '300px'
            }}
          />
          <button
            onClick={cargarComprobantes}
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
          >
            🔄 Actualizar
          </button>
        </div>
      </div>

      <div className="comprobantes-container">
        {comprobantesFiltrados.length > 0 ? (
          <div className="comprobantes-grid" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))',
            gap: '1.5rem'
          }}>
            {comprobantesFiltrados.map((comprobante) => {
              const estadoColor = comprobante.estado === 'aprobado' ? '#28a745' : 
                                 comprobante.estado === 'rechazado' ? '#dc3545' : '#ffc107';
              const estadoBg = comprobante.estado === 'aprobado' ? '#d4edda' : 
                              comprobante.estado === 'rechazado' ? '#f8d7da' : '#fff3cd';
              const estadoTexto = comprobante.estado === 'aprobado' ? '#155724' : 
                                 comprobante.estado === 'rechazado' ? '#721c24' : '#856404';
              
              return (
                <div key={comprobante.nroComprobante} className="comprobante-card" style={{
                  background: '#fff',
                  border: '1px solid #e9ecef',
                  borderRadius: '12px',
                  padding: '1.5rem',
                  boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
                  transition: 'all 0.3s ease',
                  borderLeft: `4px solid ${estadoColor}`
                }}>
                  <div className="comprobante-header" style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '1rem',
                    paddingBottom: '0.5rem',
                    borderBottom: '1px solid #f8f9fa'
                  }}>
                    <h3 style={{ 
                      color: '#2c3e50', 
                      margin: 0,
                      fontSize: '1.3rem',
                      fontWeight: 'bold'
                    }}>
                      Comprobante #{comprobante.nroComprobante}
                    </h3>
                    <span style={{
                      backgroundColor: estadoBg,
                      color: estadoTexto,
                      padding: '0.25rem 0.75rem',
                      borderRadius: '20px',
                      fontSize: '0.8rem',
                      fontWeight: 'bold',
                      textTransform: 'uppercase'
                    }}>
                      {comprobante.estado === 'aprobado' ? '✅ APROBADO' : 
                       comprobante.estado === 'rechazado' ? '❌ RECHAZADO' : '⏳ PENDIENTE'}
                    </span>
                  </div>
                  
                  <div className="comprobante-details">
                    <p style={{ color: '#34495e', marginBottom: '0.5rem' }}>
                      <strong style={{ color: '#2c3e50' }}>Fecha:</strong> 
                      <span style={{ marginLeft: '0.5rem' }}>
                        {new Date(comprobante.fecha).toLocaleString('es-AR', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </p>
                    
                    <p style={{ color: '#34495e', marginBottom: '0.5rem' }}>
                      <strong style={{ color: '#2c3e50' }}>Propietario:</strong> 
                      <span style={{ color: '#007bff', fontWeight: 'bold', marginLeft: '0.5rem' }}>
                        {usuario?.nombre} {usuario?.apellido}
                      </span>
                      <br />
                      <small style={{ color: '#6c757d', marginLeft: '0.5rem' }}>DNI: {usuario?.dni}</small>
                    </p>
                    
                    <p style={{ color: '#34495e', marginBottom: '0.5rem' }}>
                      <strong style={{ color: '#2c3e50' }}>Monto Acreditado:</strong> 
                      <span style={{
                        backgroundColor: '#28a745',
                        color: 'white',
                        padding: '4px 12px',
                        borderRadius: '20px',
                        fontSize: '1.1rem',
                        fontWeight: 'bold',
                        marginLeft: '0.5rem'
                      }}>
                        +${comprobante.montoAcreditado}
                      </span>
                    </p>
                    
                    {comprobante.estado !== 'pendiente' && (
                      <p style={{ color: '#34495e', marginBottom: '1rem' }}>
                        <strong style={{ color: '#2c3e50' }}>Saldo Disponible:</strong> 
                        <span style={{ 
                          color: '#28a745',
                          fontWeight: 'bold',
                          fontSize: '1.1rem',
                          marginLeft: '0.5rem'
                        }}>
                          ${comprobante.montoDisponible}
                        </span>
                      </p>
                    )}
                    
                    {usuario?.vehiculos && usuario.vehiculos.length > 0 && (
                      <div className="vehiculos-registrados" style={{
                        backgroundColor: '#f8f9fa',
                        padding: '1rem',
                        borderRadius: '8px',
                        marginBottom: '1rem',
                        border: '1px solid #e9ecef'
                      }}>
                        <p style={{ 
                          color: '#2c3e50', 
                          fontWeight: 'bold', 
                          marginBottom: '0.5rem' 
                        }}>
                          Vehículos Registrados:
                        </p>
                        <div className="vehiculos-list">
                          {usuario.vehiculos.map(v => (
                            <div key={v.dominio} style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              padding: '0.25rem 0',
                              borderBottom: '1px solid #e9ecef'
                            }}>
                              <span style={{ fontWeight: 'bold', color: '#2c3e50' }}>
                                {v.dominio}
                              </span>
                              <span style={{ 
                                color: '#6c757d',
                                fontSize: '0.9rem'
                              }}>
                                {v.marca} {v.modelo}
                                <span style={{ 
                                  backgroundColor: v.tipo === 'auto' ? '#17a2b8' : '#ffc107',
                                  color: v.tipo === 'moto' ? '#212529' : 'white',
                                  padding: '2px 6px',
                                  borderRadius: '10px',
                                  fontSize: '0.7rem',
                                  marginLeft: '0.5rem'
                                }}>
                                  {v.tipo}
                                </span>
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Botón para descargar PDF */}
                    <div className="comprobante-actions" style={{ 
                      marginTop: '1rem', 
                      borderTop: '1px solid #eee', 
                      paddingTop: '1rem' 
                    }}>
                      <button
                        onClick={() => descargarPDFComprobante(comprobante.nroComprobante)}
                        style={{
                          width: '100%',
                          backgroundColor: '#007bff',
                          color: 'white',
                          border: '1px solid #007bff',
                          padding: '0.75rem 1.5rem',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontWeight: 'bold',
                          transition: 'all 0.2s ease',
                          fontSize: '1rem'
                        }}
                      >
                        📄 Descargar Comprobante PDF
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="no-data" style={{
            textAlign: 'center',
            padding: '3rem',
            color: '#6c757d',
            backgroundColor: '#f8f9fa',
            borderRadius: '8px',
            border: '1px solid #e9ecef'
          }}>
            <h3 style={{ color: '#6c757d', marginBottom: '1rem' }}>📄 No hay comprobantes</h3>
            <p style={{ margin: '0.5rem 0' }}>No hay comprobantes para mostrar</p>
            {filtro && (
              <p style={{ margin: '0.5rem 0', fontStyle: 'italic' }}>
                Intenta cambiar los filtros de búsqueda
              </p>
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
    <div className="dashboard" style={{ backgroundColor: '#f8f9fa', minHeight: '100vh' }}>
      <Navbar />
      <div className="container" style={{ padding: '2rem' }}>
        {mensaje && (
          <div className={`message message-${mensaje.type}`} style={{ 
            margin: '0 0 2rem 0', 
            position: 'relative',
            backgroundColor: mensaje.type === 'error' ? '#f8d7da' : '#d4edda',
            color: mensaje.type === 'error' ? '#721c24' : '#155724',
            padding: '1rem 1.5rem',
            borderRadius: '8px',
            border: `1px solid ${mensaje.type === 'error' ? '#f5c6cb' : '#c3e6cb'}`
          }}>
            {mensaje.text}
            <button 
              onClick={() => setMensaje(null)} 
              style={{
                position: 'absolute',
                right: '15px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '20px',
                fontWeight: 'bold',
                color: mensaje.type === 'error' ? '#721c24' : '#155724'
              }}
            >
              ×
            </button>
          </div>
        )}

        <div className="historial-dashboard">
          <div className="historial-header" style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '2rem',
            marginBottom: '2rem',
            boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
            border: '1px solid #e9ecef'
          }}>
            <div className="header-content" style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: '2rem'
            }}>
              <div className="title-section">
                <h1 style={{ color: '#2c3e50', margin: '0 0 1rem 0', fontSize: '2.5rem' }}>
                  Mi Historial
                </h1>
                <p style={{ color: '#6c757d', margin: 0, fontSize: '1.1rem' }}>
                  Consulta tus transacciones y comprobantes de estacionamiento
                </p>
              </div>
              
              <div className="saldo-info" style={{ 
                backgroundColor: '#f8f9fa',
                padding: '1.5rem',
                borderRadius: '12px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                border: '1px solid #e9ecef',
                minWidth: '300px',
                textAlign: 'center'
              }}>
                <h3 style={{ margin: '0 0 0.5rem 0', color: '#2c3e50', fontSize: '1.2rem' }}>
                  Saldo Disponible
                </h3>
                <p style={{ 
                  margin: '0 0 1rem 0', 
                  color: '#28a745', 
                  fontWeight: 'bold',
                  fontSize: '2rem'
                }}>
                  ${usuario?.montoDisponible || 0}
                </p>
                <div className="tarifa-info" style={{
                  borderTop: '1px solid #dee2e6',
                  paddingTop: '1rem'
                }}>
                  <p style={{ margin: '0 0 0.5rem 0', color: '#6c757d', fontSize: '0.9rem' }}>
                    <strong>Tarifa actual:</strong> ${obtenerTarifaDisplay()}/hora
                  </p>
                  {usuario?.tarifaAsignada?.nombre && (
                    <span style={{ 
                      backgroundColor: '#007bff',
                      color: 'white',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontSize: '0.8rem',
                      fontWeight: 'bold'
                    }}>
                      {usuario.tarifaAsignada.nombre}
                    </span>
                  )}
                  {!usuario?.tarifaAsignada?.nombre && usuario?.asociado && (
                    <span style={{ 
                      backgroundColor: '#28a745',
                      color: 'white',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontSize: '0.8rem',
                      fontWeight: 'bold'
                    }}>
                      Usuario Asociado
                    </span>
                  )}
                  <p style={{ margin: '0.5rem 0 0 0', color: '#6c757d', fontSize: '0.8rem' }}>
                    Registrado el: {usuario?.fechaRegistro ? new Date(usuario.fechaRegistro).toLocaleDateString('es-AR', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    }) : 'Fecha no disponible'}
                  </p>
                </div>
              </div>
            </div>

            <div className="navigation-tabs" style={{
              display: 'flex',
              gap: '1rem',
              borderTop: '1px solid #e9ecef',
              paddingTop: '2rem'
            }}>
              <button 
                onClick={() => {
                  setVistaActual('transacciones');
                  setFiltro('');
                }}
                style={{
                  backgroundColor: vistaActual === 'transacciones' ? '#007bff' : '#6c757d',
                  color: 'white',
                  border: 'none',
                  padding: '0.75rem 2rem',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: '1rem',
                  transition: 'all 0.2s ease',
                  boxShadow: vistaActual === 'transacciones' ? '0 2px 4px rgba(0,123,255,0.3)' : 'none'
                }}
              >
                📊 Transacciones
              </button>
              <button 
                onClick={() => {
                  setVistaActual('comprobantes');
                  setFiltro('');
                }}
                style={{
                  backgroundColor: vistaActual === 'comprobantes' ? '#007bff' : '#6c757d',
                  color: 'white',
                  border: 'none',
                  padding: '0.75rem 2rem',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: '1rem',
                  transition: 'all 0.2s ease',
                  boxShadow: vistaActual === 'comprobantes' ? '0 2px 4px rgba(0,123,255,0.3)' : 'none'
                }}
              >
                📄 Comprobantes
              </button>
            </div>
          </div>

          <div className="historial-content">
            {vistaActual === 'transacciones' && renderTransacciones()}
            {vistaActual === 'comprobantes' && renderComprobantes()}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Historial;
