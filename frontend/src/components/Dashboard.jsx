import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Navbar from './Navbar';
import '../styles/theme.css';
import { estacionamientoService } from '../services/estacionamientoService';
import { usuarioService } from '../services/usuarioService';
import { vehiculoEstadoService } from '../services/vehiculoEstadoService';
import { precioService } from '../services/precioService';
import { configManager } from '../config/config';

const API_BASE_URL = configManager.getApiUrl();

function Dashboard() {
  const { usuario: usuarioAuth, logout } = useAuth();
  const [usuario, setUsuario] = useState({ vehiculos: [] });
  const [loading, setLoading] = useState(true);
  const [mensaje, setMensaje] = useState(null);
  const [nuevoVehiculo, setNuevoVehiculo] = useState({
    dominio: '',
    tipo: 'auto',
    marca: '',
    modelo: '',
    año: new Date().getFullYear().toString()
  });
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [mostrarFormularioAbono, setMostrarFormularioAbono] = useState(false);
  const [montoAbono, setMontoAbono] = useState('');
  const [portonSeleccionado, setPortonSeleccionado] = useState('Norte');
  const [vehiculoSeleccionado, setVehiculoSeleccionado] = useState(null);
  const [estacionamientoActivo, setEstacionamientoActivo] = useState(null);
  const [tiempoTranscurrido, setTiempoTranscurrido] = useState('00:00:00');
  const [mostrarModalIngreso, setMostrarModalIngreso] = useState(false);
  const [tarifaActual, setTarifaActual] = useState(null);
  const navigate = useNavigate();

  // Función para iniciar estacionamiento
  const iniciarEstacionamiento = async (dominio) => {
    try {
      const token = localStorage.getItem('token');
      console.log('Iniciando estacionamiento para:', dominio);

      // Iniciar nuevo estacionamiento directamente
      // El backend se encargará de verificar si hay un estacionamiento activo
      const resultado = await estacionamientoService.iniciarEstacionamiento(
        usuarioAuth.dni,
        dominio,
        portonSeleccionado,
        token
      );

      console.log('Resultado inicio estacionamiento:', resultado);
      setEstacionamientoActivo(resultado.estacionamiento);
      iniciarContador(resultado.estacionamiento.horaInicio);
      setMensaje({ type: 'success', text: 'Estacionamiento iniciado correctamente' });
      setMostrarModalIngreso(false);
      setVehiculoSeleccionado(null);
      
    } catch (error) {
      console.error('Error al iniciar estacionamiento:', error);
      setMensaje({ 
        type: 'error', 
        text: error.message || 'Error al iniciar estacionamiento'
      });
    }
  };

  // Función para finalizar estacionamiento
  const finalizarEstacionamiento = async (dominio) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        logout();
        navigate('/login');
        return;
      }
      
      const resultado = await estacionamientoService.finalizarEstacionamiento(usuarioAuth.dni, dominio, token);
      console.log('Resultado finalización:', resultado);
      
      setEstacionamientoActivo(null);
      detenerContador();
      
      try {
        // Actualizar datos del usuario para reflejar el nuevo saldo
        const usuario = await usuarioService.obtenerDatosUsuario(usuarioAuth.dni, token);
        console.log('Usuario actualizado:', usuario);
        
        // Actualizar el saldo en el estado
        setUsuario({
          ...usuario,
          montoDisponible: resultado.montoDisponible || usuario.montoDisponible
        });
      } catch (error) {
        if (error.message.includes('Sesión expirada')) {
          logout();
          navigate('/login');
          return;
        }
        throw error;
      }

      setMensaje({ 
        type: 'success', 
        text: `Estacionamiento finalizado. Duración: ${resultado.duracionHoras} horas. Monto: $${resultado.montoTotal}` 
      });
      
    } catch (error) {
      if (error.message.includes('Sesión expirada')) {
        logout();
        navigate('/login');
        return;
      }
      setMensaje({ type: 'error', text: error.message });
    }
  };

  // Función para manejar el contador
  const iniciarContador = (horaInicio) => {
    const intervalo = setInterval(() => {
      const ahora = new Date();
      const inicio = new Date(horaInicio);
      const diferencia = ahora - inicio;
      
      const horas = Math.floor(diferencia / (1000 * 60 * 60));
      const minutos = Math.floor((diferencia % (1000 * 60 * 60)) / (1000 * 60));
      const segundos = Math.floor((diferencia % (1000 * 60)) / 1000);
      
      setTiempoTranscurrido(
        `${horas.toString().padStart(2, '0')}:${minutos.toString().padStart(2, '0')}:${segundos.toString().padStart(2, '0')}`
      );
    }, 1000);

    return () => clearInterval(intervalo);
  };

  const detenerContador = () => {
    setTiempoTranscurrido('00:00:00');
  };

  // Función para obtener datos actualizados del usuario
  const obtenerDatosUsuario = async () => {
    const token = localStorage.getItem('token');
    // Usar la ruta que incluye la tarifa poblada
    const res = await fetch(`${API_BASE_URL}/usuarios`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        throw new Error('Sesión expirada o no autorizada');
      }
      throw new Error('Error al obtener datos del usuario');
    }
    
    const data = await res.json();
    // Buscar el usuario actual en la lista
    const usuarioActual = data.find(u => u.dni === usuarioAuth.dni);
    if (!usuarioActual) {
      throw new Error('Usuario no encontrado');
    }
    return usuarioActual;
  };

  // Función para cargar la tarifa actual
  const cargarTarifaActual = React.useCallback(async (usuario) => {
    try {
      console.log('Cargando tarifa para usuario:', usuario);
      
      // Priorizar tarifa asignada específicamente al usuario
      if (usuario?.tarifaAsignada?.precioPorHora) {
        console.log('Usando tarifa asignada específica:', usuario.tarifaAsignada.precioPorHora);
        setTarifaActual(usuario.tarifaAsignada.precioPorHora);
        return usuario.tarifaAsignada.precioPorHora;
      }
      
      // Si no tiene tarifa asignada, usar el sistema tradicional
      const esAsociado = usuario?.asociado || false;
      console.log('Cargando tarifa por tipo de usuario asociado:', esAsociado);
      const precio = await precioService.obtenerPrecioParaUsuario(esAsociado);
      console.log('Tarifa obtenida:', precio);
      setTarifaActual(precio);
      return precio;
    } catch (error) {
      console.error('Error al cargar tarifa:', error);
      // Valor por defecto en caso de error
      const esAsociado = usuario?.asociado || false;
      const tarifaDefault = esAsociado ? 250 : 500;
      setTarifaActual(tarifaDefault);
      return tarifaDefault;
    }
  }, []);


  // Función para obtener la tarifa a mostrar
  const obtenerTarifaDisplay = () => {
    // Prioridad 1: Tarifa específica asignada al usuario
    if (usuario?.tarifaAsignada?.precioPorHora) {
      return usuario.tarifaAsignada.precioPorHora;
    }
    
    // Prioridad 2: Tarifa cargada desde el servicio
    if (tarifaActual !== null) {
      return tarifaActual;
    }
    
    // Prioridad 3: Valor por defecto basado en si es asociado
    return usuario?.asociado ? 250 : 500;
  };
  const handleAbonoSubmit = async (e) => {
    e.preventDefault();
    
    // Validar que el monto sea un número válido
    const montoNumerico = parseFloat(montoAbono);
    if (isNaN(montoNumerico) || montoNumerico <= 0) {
      setMensaje({ type: 'error', text: 'Por favor ingrese un monto válido mayor a 0' });
      return;
    }
    
    setLoading(true);
    
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/comprobantes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          dni: usuarioAuth.dni,
          montoAcreditado: montoNumerico,
          usuario: {
            dni: usuarioAuth.dni,
            nombre: usuario.nombre,
            apellido: usuario.apellido
          }
        })
      });

      const data = await res.json();

      if (res.ok) {
        setMensaje({ 
          type: 'success', 
          text: `Comprobante generado exitosamente. Su número de comprobante es: ${data.comprobante.nroComprobante}. Por favor, diríjase a la caja con este número para validar su pago.`
        });
        setMontoAbono('');
        setMostrarFormularioAbono(false);
      } else {
        setMensaje({ type: 'error', text: data.mensaje || 'Error al generar comprobante' });
      }
    } catch (error) {
      console.error('Error:', error);
      setMensaje({ type: 'error', text: 'Error al conectar con el servidor' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!usuarioAuth) {
      navigate('/login');
      return;
    }

    // Verificar que el usuario no sea admin
    if (usuarioAuth.rol === 'admin') {
      navigate('/admin');
      return;
    }

    setLoading(true);
    setUsuario({ vehiculos: [] }); // Resetear el estado del usuario mientras cargamos

    // Cargar datos iniciales
    const cargarDatosIniciales = async () => {
      try {
        const token = localStorage.getItem('token');
        // Primero obtenemos los datos del usuario
        const res = await fetch(`${API_BASE_URL}/usuarios/${usuarioAuth.dni}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!res.ok) {
          if (res.status === 401) {
            logout(); // Token inválido o expirado
            navigate('/login');
            return;
          }
          throw new Error('Error al obtener datos del usuario');
        }
        
        const data = await res.json();
        setUsuario(data.usuario);

        // Cargar tarifa actual inmediatamente después de obtener los datos del usuario
        console.log('Datos del usuario cargados:', data.usuario);
        await cargarTarifaActual(data.usuario);

        // Verificar estados de vehículos
        if (data.usuario.vehiculos && data.usuario.vehiculos.length > 0) {
          try {
            // Primero, resetear el estado del estacionamiento activo
            setEstacionamientoActivo(null);
            
            // Verificar el estado de cada vehículo
            for (const vehiculo of data.usuario.vehiculos) {
              try {
                const estado = await vehiculoEstadoService.verificarEstado(vehiculo.dominio, token);
                
                if (estado.estActivo && estado.estacionamiento) {
                  console.log('Estacionamiento activo encontrado:', estado.estacionamiento);
                  setEstacionamientoActivo(estado.estacionamiento);
                  iniciarContador(estado.estacionamiento.horaInicio);
                  // Si encontramos un estacionamiento activo, salimos del bucle
                  break;
                }
              } catch (error) {
                console.error('Error al verificar estado del vehículo:', error);
              }
            }
          } catch (error) {
            console.error('Error al verificar estacionamiento:', error);
          }
        }
      } catch (error) {
        console.error('Error:', error);
        setMensaje({ type: 'error', text: 'Error al cargar los datos del usuario' });
        setUsuario(usuarioAuth); // Usar datos del contexto como respaldo
      } finally {
        setLoading(false);
      }
    };

    cargarDatosIniciales();
  }, [usuarioAuth, navigate, logout, cargarTarifaActual]);

  const handleNuevoVehiculo = (e) => {
    setNuevoVehiculo({
      ...nuevoVehiculo,
      [e.target.name]: e.target.value
    });
  };

  const agregarVehiculo = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const vehiculoData = {
        dni: usuarioAuth.dni,
        nuevoVehiculo: {
          dominio: nuevoVehiculo.dominio.toUpperCase(),
          tipo: nuevoVehiculo.tipo.toLowerCase(),
          marca: nuevoVehiculo.marca,
          modelo: nuevoVehiculo.modelo,
          año: nuevoVehiculo.año
        }
      };

      const res = await fetch(`${API_BASE_URL}/vehiculos/agregar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(vehiculoData)
      });
      const data = await res.json();
      
      if (res.ok) {
        setMensaje({ type: 'success', text: 'Vehículo agregado correctamente' });
        const usuarioActualizado = await obtenerDatosUsuario();
        setUsuario(usuarioActualizado);
        setMostrarFormulario(false);
        setNuevoVehiculo({ dominio: '', tipo: 'auto', marca: '', modelo: '', año: '' });
      } else {
        setMensaje({ type: 'error', text: data.mensaje || 'Error al agregar el vehículo' });
      }
    } catch (error) {
      setMensaje({ type: 'error', text: 'Error al conectar con el servidor' });
    } finally {
      setLoading(false);
    }
  };



  if (loading || !usuario) {
    return (
      <div className="container">
        <div className="card" style={{ textAlign: 'center' }}>
          <p>Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <Navbar />
      <div className="container">
        <div className="dashboard-wrapper">
          <div className="dashboard-main">
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
            
            <div className="dashboard-header">
              <div className="saldo-info" style={{ 
                marginTop: '20px', 
                marginBottom: '20px', 
                backgroundColor: '#f8f9fa',
                padding: '15px',
                borderRadius: '8px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <h2 style={{ margin: 0, color: '#2c3e50' }}>Panel de Usuario</h2>
                  <p style={{ margin: '5px 0 0 0', color: '#6c757d', fontSize: '0.9em' }}>
                    {usuario?.tarifaAsignada ? (
                      <span style={{ color: '#007bff', fontWeight: 'bold' }}>
                        {usuario.tarifaAsignada.tipoUsuario} - ${usuario.tarifaAsignada.precioPorHora}/hora • 
                      </span>
                    ) : (
                      <span style={{ color: '#28a745', fontWeight: 'bold' }}>
                        {usuario?.asociado ? 'Usuario Asociado' : 'Usuario Público'} • 
                      </span>
                    )}
                    Registrado el: {usuario?.fechaRegistro ? new Date(usuario.fechaRegistro).toLocaleDateString('es-AR', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    }) : 'Fecha no disponible'}
                  </p>
                </div>
                <h3 style={{ margin: 0, color: '#2c3e50' }}>
                  Saldo Disponible: <span style={{ color: '#28a745', fontWeight: 'bold' }}>${usuario?.montoDisponible}</span>
                </h3>
              </div>
            </div>

            <div className="main-content">
              {/* Sección de vehículos */}
              <div className="card">
                <div className="card-header">
                  <h2>Mis Vehículos</h2>
                  <button
                    className="button button-secondary"
                    onClick={() => setMostrarFormulario(!mostrarFormulario)}
                  >
                    {mostrarFormulario ? 'Cancelar' : 'Agregar Vehículo'}
                  </button>
                </div>

                {mostrarFormulario && (
                  <form onSubmit={agregarVehiculo} className="form-grid">
                    <div className="form-control">
                      <input
                        className="input"
                        name="dominio"
                        placeholder="Dominio"
                        value={nuevoVehiculo.dominio}
                        onChange={handleNuevoVehiculo}
                        required
                      />
                    </div>
                    <div className="form-control">
                      <select
                        className="input"
                        name="tipo"
                        value={nuevoVehiculo.tipo}
                        onChange={handleNuevoVehiculo}
                        required
                      >
                        <option value="auto">Auto</option>
                        <option value="moto">Moto</option>
                      </select>
                    </div>
                    <div className="form-control">
                      <input
                        className="input"
                        name="marca"
                        placeholder="Marca"
                        value={nuevoVehiculo.marca}
                        onChange={handleNuevoVehiculo}
                        required
                      />
                    </div>
                    <div className="form-control">
                      <input
                        className="input"
                        name="modelo"
                        placeholder="Modelo"
                        value={nuevoVehiculo.modelo}
                        onChange={handleNuevoVehiculo}
                        required
                      />
                    </div>
                    <div className="form-control">
                      <input
                        className="input"
                        name="año"
                        type="number"
                        placeholder="Año"
                        value={nuevoVehiculo.año}
                        onChange={handleNuevoVehiculo}
                        required
                      />
                    </div>
                    <div className="form-control">
                      <button
                        type="submit"
                        className="button button-primary"
                        disabled={loading}
                      >
                        {loading ? 'Agregando...' : 'Agregar Vehículo'}
                      </button>
                    </div>
                  </form>
                )}

                <div className="vehiculos-grid">
                  {!usuario?.vehiculos ? (
                    <div className="no-vehiculos">
                      <p>Cargando vehículos...</p>
                    </div>
                  ) : usuario.vehiculos.length === 0 ? (
                    <div className="no-vehiculos">
                      <p>No tienes vehículos registrados. ¡Agrega uno para comenzar!</p>
                    </div>
                  ) : (
                    usuario.vehiculos.map((vehiculo) => {
                      const estaActivo = estacionamientoActivo?.vehiculoDominio === vehiculo.dominio;
                      
                      return (
                        <div key={vehiculo.dominio} className="vehiculo-card">
                          <h3>{vehiculo.marca} {vehiculo.modelo}</h3>
                          <p>Dominio: {vehiculo.dominio}</p>
                          <p>Tipo: {vehiculo.tipo}</p>
                          <p>Año: {vehiculo.año}</p>
                          
                          {estaActivo ? (
                            <div className="estacionamiento-activo">
                              <p className="text-green-600 font-semibold">Estacionamiento Activo</p>
                              <p className="text-lg font-bold timer">{tiempoTranscurrido}</p>
                              <button
                                onClick={() => finalizarEstacionamiento(vehiculo.dominio)}
                                className="button button-danger w-full mb-2"
                                disabled={loading}
                              >
                                Finalizar Estacionamiento
                              </button>
                            </div>
                          ) : (
                            <div className="estacionamiento-control">
                              <button
                                onClick={() => {
                                  setVehiculoSeleccionado(vehiculo.dominio);
                                  setMostrarModalIngreso(true);
                                }}
                                className="button button-success w-full mb-2"
                                disabled={loading}
                              >
                                Iniciar Estacionamiento
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Sección de Abono */}
              <div className="card">
                <div className="card-header">
                  <h2>Gestión de Abono</h2>
                  <button
                    className="button button-primary"
                    onClick={() => setMostrarFormularioAbono(true)}
                  >
                    Acreditar Saldo
                  </button>
                </div>

                {mostrarFormularioAbono && (
                  <form onSubmit={handleAbonoSubmit}>
                    <div className="form-control">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={montoAbono}
                        onChange={(e) => setMontoAbono(e.target.value)}
                        placeholder="Monto a acreditar"
                        className="input"
                        required
                      />
                    </div>
                    <div className="form-control">
                      <button type="submit" className="button button-primary" disabled={loading}>
                        {loading ? 'Procesando...' : 'Confirmar Abono'}
                      </button>
                      <button
                        type="button"
                        className="button button-secondary"
                        onClick={() => setMostrarFormularioAbono(false)}
                        disabled={loading}
                      >
                        Cancelar
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>

            {/* Modal de Ingreso */}
            {mostrarModalIngreso && (
              <div className="modal-overlay">
                <div className="modal-content">
                  <h2>Iniciar Estacionamiento</h2>
                  <p>
                    <strong>Vehículo:</strong>{' '}
                    {usuario?.vehiculos?.find(v => v.dominio === vehiculoSeleccionado)?.marca}{' '}
                    {usuario?.vehiculos?.find(v => v.dominio === vehiculoSeleccionado)?.modelo}
                  </p>
                  <p>
                    <strong>Dominio:</strong> {vehiculoSeleccionado}
                  </p>
                  <p>
                    <strong>Tarifa:</strong> ${obtenerTarifaDisplay()}/hora
                    {usuario?.tarifaAsignada ? (
                      <span style={{ 
                        color: '#007bff', 
                        fontWeight: 'bold', 
                        marginLeft: '8px',
                        fontSize: '0.9em'
                      }}>
                        ({usuario.tarifaAsignada.tipoUsuario})
                      </span>
                    ) : (
                      <span style={{ 
                        color: '#28a745', 
                        fontWeight: 'bold', 
                        marginLeft: '8px',
                        fontSize: '0.9em'
                      }}>
                        ({usuario?.asociado ? 'Precio Asociado' : 'Precio Público'})
                      </span>
                    )}
                  </p>
                  
                  <div className="form-control">
                    <select
                      value={portonSeleccionado}
                      onChange={(e) => setPortonSeleccionado(e.target.value)}
                      className="input"
                    >
                      <option value="Norte">Portón Norte</option>
                      <option value="Sur">Portón Sur</option>
                      <option value="Este">Portón Este</option>
                      <option value="Oeste">Portón Oeste</option>
                    </select>
                  </div>

                  <div className="modal-actions">
                    <button
                      onClick={() => iniciarEstacionamiento(vehiculoSeleccionado)}
                      className="button button-primary"
                      disabled={loading}
                    >
                      Confirmar Ingreso
                    </button>
                    <button
                      onClick={() => {
                        setMostrarModalIngreso(false);
                        setVehiculoSeleccionado(null);
                      }}
                      className="button button-secondary"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
