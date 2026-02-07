import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Navbar from './Navbar';
import ListadoComprobantes from './ListadoComprobantes';
import ListadoFacturas from './ListadoFacturas';
import '../styles/theme.css';
import '../styles/admin.css';
import { precioService } from '../services/precioService';

function AdminDashboard() {
  const { usuario: usuarioAuth } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [mensaje, setMensaje] = useState(null);
  const [comprobantes, setComprobantes] = useState([]);
  const [precios, setPrecios] = useState([]);
  const [historialPrecios, setHistorialPrecios] = useState([]);
  const [estadisticasPrecios, setEstadisticasPrecios] = useState(null);
  const [editandoPrecios, setEditandoPrecios] = useState({});
  const [valoresTemp, setValoresTemp] = useState({});
  const [vistaActual, setVistaActual] = useState('comprobantes');
  const [filtro, setFiltro] = useState('');
  const [mostrandoFormularioNuevoPrecio, setMostrandoFormularioNuevoPrecio] = useState(false);
  const [nuevoPrecios, setNuevoPrecio] = useState({
    tipoUsuario: '',
    precioPorHora: '',
    descripcion: ''
  });

  // Cargar comprobantes pendientes
  const cargarComprobantes = async () => {
    try {
      const token = localStorage.getItem('token');
      console.log('Cargando comprobantes...');
      const res = await fetch('http://localhost:3000/api/admin/comprobantes/pendientes', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      console.log('Respuesta del servidor:', res.status);
      
      if (res.ok) {
        const data = await res.json();
        console.log('📄 Comprobantes pendientes recibidos:', data.comprobantes);
        if (data.comprobantes && data.comprobantes.length > 0) {
          console.log('🔍 Primer comprobante pendiente:', data.comprobantes[0]);
          console.log('🔍 Campo facturado:', data.comprobantes[0].facturado);
        }
        setComprobantes(data.comprobantes || []);
      } else {
        throw new Error('Error al cargar comprobantes');
      }
    } catch (error) {
      console.error('Error:', error);
      setMensaje({ type: 'error', text: 'Error al cargar comprobantes pendientes' });
    }
  };

  // Cargar precios
  const cargarPrecios = async () => {
    try {
      const token = localStorage.getItem('token');
      console.log('Cargando precios...');
      const res = await precioService.obtenerTodosLosPrecios(token);
      setPrecios(res.precios || []);
    } catch (error) {
      console.error('Error:', error);
      setMensaje({ type: 'error', text: 'Error al cargar configuración de precios' });
    }
  };

  // Cargar historial de precios
  const cargarHistorialPrecios = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await precioService.obtenerHistorialPrecios(null, 20, 1, token);
      setHistorialPrecios(res.historial || []);
    } catch (error) {
      console.error('Error:', error);
      setMensaje({ type: 'error', text: 'Error al cargar historial de precios' });
    }
  };

  // Cargar estadísticas de precios
  const cargarEstadisticasPrecios = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await precioService.obtenerEstadisticasPrecios(token);
      setEstadisticasPrecios(res.estadisticas || null);
    } catch (error) {
      console.error('Error:', error);
      setMensaje({ type: 'error', text: 'Error al cargar estadísticas de precios' });
    }
  };

  // Actualizar precio
  const actualizarPrecio = async (tipoUsuario, nuevoPrecio, descripcion, motivo) => {
    console.log('actualizarPrecio llamado con:', { tipoUsuario, nuevoPrecio, descripcion, motivo });
    
    const confirmacion = window.confirm(`¿Estás seguro de que deseas actualizar el precio para ${tipoUsuario.replace('_', ' ')}?`);
    console.log('Resultado de confirmación:', confirmacion);
    
    if (!confirmacion) {
      console.log('Usuario canceló la operación');
      return;
    }

    console.log('Usuario confirmó, procediendo con la actualización...');

    try {
      const token = localStorage.getItem('token');
      console.log('Token:', token ? 'Presente' : 'No presente');
      
      if (!token) {
        throw new Error('No hay token de autenticación');
      }
      
      console.log('Llamando al servicio precioService.actualizarPrecio...');
      const resultado = await precioService.actualizarPrecio(tipoUsuario, nuevoPrecio, descripcion, motivo, token);
      console.log('Resultado del servicio:', resultado);
      
      if (resultado && resultado.success) {
        setMensaje({ 
          type: 'success', 
          text: `Precio para ${tipoUsuario.replace('_', ' ')} actualizado correctamente` 
        });
        
        console.log('Recargando precios...');
        // Recargar precios y historial
        await cargarPrecios();
        await cargarHistorialPrecios();
        console.log('Precios recargados exitosamente');
      } else {
        throw new Error(resultado?.mensaje || 'Respuesta inesperada del servidor');
      }
    } catch (error) {
      console.error('Error completo:', error);
      console.error('Error stack:', error.stack);
      setMensaje({ type: 'error', text: error.message || 'Error al actualizar precio' });
    }
  };

  // Validar comprobante
  const validarComprobante = async (nroComprobante) => {
    if (!window.confirm('¿Estás seguro de que deseas validar este comprobante?')) {
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`http://localhost:3000/api/admin/comprobantes/${nroComprobante}/validar`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await res.json();

      if (res.ok) {
        let mensaje = 'Comprobante aprobado exitosamente. El saldo del usuario ha sido actualizado.';
        
        if (data.facturaGenerada) {
          mensaje += ` Se generó la factura ${data.facturaGenerada.nroFactura} por $${data.facturaGenerada.total.toLocaleString()}.`;
        }
        
        setMensaje({ 
          type: 'success', 
          text: mensaje
        });
        await cargarComprobantes();
      } else {
        setMensaje({ type: 'error', text: data.mensaje || 'Error al validar comprobante' });
      }
    } catch (error) {
      console.error('Error:', error);
      setMensaje({ type: 'error', text: 'Error al conectar con el servidor' });
    }
  };

  // Rechazar comprobante
  const rechazarComprobante = async (nroComprobante) => {
    if (!window.confirm('¿Estás seguro de que deseas rechazar este comprobante?')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`http://localhost:3000/api/admin/comprobantes/${nroComprobante}/rechazar`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await res.json();

      if (res.ok) {
        setMensaje({ 
          type: 'success', 
          text: 'Comprobante rechazado' 
        });
        await cargarComprobantes();
      } else {
        setMensaje({ type: 'error', text: data.mensaje || 'Error al rechazar comprobante' });
      }
    } catch (error) {
      console.error('Error:', error);
      setMensaje({ type: 'error', text: 'Error al conectar con el servidor' });
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
          cargarComprobantes(),
          cargarPrecios()
        ]);
      } catch (error) {
        console.error('Error al cargar datos:', error);
      } finally {
        setLoading(false);
      }
    };

    cargarDatos();
  }, [usuarioAuth, navigate]);

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

  const renderComprobantes = () => (
    <div className="comprobantes-section">
      <h2>Comprobantes Pendientes</h2>
      <input
        type="text"
        className="search-bar"
        placeholder="Buscar por número de comprobante o DNI..."
        value={filtro}
        onChange={(e) => setFiltro(e.target.value)}
      />
      <div className="grid-container">
        {comprobantes.length === 0 ? (
          <p>No hay comprobantes pendientes</p>
        ) : (
          comprobantes
            .filter(comp => 
              comp.nroComprobante.toLowerCase().includes(filtro.toLowerCase()) ||
              comp.usuario.dni.includes(filtro)
            )
            .map(comprobante => (
              <div key={comprobante.nroComprobante} className="comprobante-card">
                <div className="comprobante-header">
                  <h4>Comprobante #{comprobante.nroComprobante}</h4>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span className={`estado-badge estado-${comprobante.estado}`}>
                      {comprobante.estado === 'pendiente' && '⏳ Pendiente'}
                      {comprobante.estado === 'aprobado' && '✅ Aprobado'}
                      {comprobante.estado === 'rechazado' && '❌ Rechazado'}
                    </span>
                    {comprobante.facturado && (
                      <span className="facturado-badge" title="Este comprobante ya fue facturado">
                        📄 Facturado
                      </span>
                    )}
                  </div>
                </div>
                <div className="info-row">
                  <strong>Usuario:</strong> {comprobante.usuario.nombre} {comprobante.usuario.apellido}
                </div>
                <div className="info-row">
                  <strong>DNI:</strong> {comprobante.usuario.dni}
                </div>
                <div className="info-row">
                  <strong>Monto:</strong> ${comprobante.montoAcreditado}
                </div>
                <div className="info-row">
                  <strong>Facturado:</strong> {comprobante.facturado ? 'Sí' : 'No'}
                </div>
                <div className="info-row">
                  <strong>Fecha:</strong> {new Date(comprobante.fecha).toLocaleString()}
                </div>
                <div className="action-buttons">
                  <button
                    className="button button-success"
                    onClick={() => validarComprobante(comprobante.nroComprobante)}
                  >
                    Aprobar
                  </button>
                  <button
                    className="button button-danger"
                    onClick={() => rechazarComprobante(comprobante.nroComprobante)}
                  >
                    Rechazar
                  </button>
                </div>
              </div>
            ))
        )}
      </div>
    </div>
  );

  const renderPrecios = () => {
    const iniciarEdicion = (precio) => {
      console.log('=== INICIAR EDICIÓN ===');
      console.log('Precio:', precio);
      console.log('Tipo de usuario:', precio.tipoUsuario);
      
      setEditandoPrecios({ ...editandoPrecios, [precio.tipoUsuario]: true });
      setValoresTemp({
        ...valoresTemp,
        [precio.tipoUsuario]: {
          precioPorHora: precio.precioPorHora,
          descripcion: precio.descripcion || '',
          motivo: ''
        }
      });
      
      console.log('Estado editandoPrecios actualizado para:', precio.tipoUsuario);
      console.log('Valores temp iniciales:', {
        precioPorHora: precio.precioPorHora,
        descripcion: precio.descripcion || '',
        motivo: ''
      });
    };

    const cancelarEdicion = (tipoUsuario) => {
      setEditandoPrecios({ ...editandoPrecios, [tipoUsuario]: false });
      setValoresTemp({ ...valoresTemp, [tipoUsuario]: {} });
    };

    const guardarCambios = async (tipoUsuario) => {
      console.log('=== INICIO guardarCambios ===');
      console.log('Tipo de usuario recibido:', tipoUsuario);
      console.log('Estado valoresTemp completo:', valoresTemp);
      
      const valores = valoresTemp[tipoUsuario];
      console.log('Valores a guardar:', valores);
      console.log('Tipo de usuario:', tipoUsuario);
      
      if (!valores || !valores.precioPorHora || valores.precioPorHora <= 0) {
        console.log('ERROR: Validación falló');
        console.log('Valores:', valores);
        console.log('PrecioPorHora:', valores?.precioPorHora);
        setMensaje({ type: 'error', text: 'El precio debe ser mayor a 0' });
        return;
      }

      try {
        console.log('Llamando a actualizarPrecio...');
        await actualizarPrecio(tipoUsuario, valores.precioPorHora, valores.descripcion, valores.motivo);
        setEditandoPrecios({ ...editandoPrecios, [tipoUsuario]: false });
        setValoresTemp({ ...valoresTemp, [tipoUsuario]: {} });
        console.log('=== FIN guardarCambios EXITOSO ===');
      } catch (error) {
        console.error('Error en guardarCambios:', error);
        setMensaje({ type: 'error', text: error.message || 'Error al guardar cambios' });
      }
    };

    const actualizarValorTemp = (tipoUsuario, campo, valor) => {
      console.log('actualizarValorTemp:', { tipoUsuario, campo, valor });
      const nuevosValores = {
        ...valoresTemp,
        [tipoUsuario]: {
          ...valoresTemp[tipoUsuario],
          [campo]: valor
        }
      };
      console.log('Nuevos valores temp:', nuevosValores);
      setValoresTemp(nuevosValores);
    };

    // Funciones para crear nuevo precio
    const manejarCrearPrecio = async (e) => {
      e.preventDefault();
      
      if (!nuevoPrecios.tipoUsuario || !nuevoPrecios.precioPorHora) {
        setMensaje({ type: 'error', text: 'El tipo de usuario y precio son obligatorios' });
        return;
      }

      if (nuevoPrecios.precioPorHora <= 0) {
        setMensaje({ type: 'error', text: 'El precio debe ser mayor a 0' });
        return;
      }

      try {
        const token = localStorage.getItem('token');
        await precioService.crearPrecio(
          nuevoPrecios.tipoUsuario,
          parseFloat(nuevoPrecios.precioPorHora),
          nuevoPrecios.descripcion,
          token
        );

        setMensaje({ type: 'success', text: 'Nuevo precio creado exitosamente' });
        setMostrandoFormularioNuevoPrecio(false);
        setNuevoPrecio({
          tipoUsuario: '',
          precioPorHora: '',
          descripcion: ''
        });
        
        // Recargar precios y historial
        cargarPrecios();
        cargarHistorialPrecios();
      } catch (error) {
        setMensaje({ type: 'error', text: error.message });
      }
    };

    const actualizarNuevoPrecio = (campo, valor) => {
      setNuevoPrecio({
        ...nuevoPrecios,
        [campo]: valor
      });
    };

    // Función para eliminar precio
    const eliminarPrecio = async (tipoUsuario) => {
      if (window.confirm(`¿Está seguro de que desea eliminar la configuración de precio para "${formatearTipoUsuario(tipoUsuario)}"?`)) {
        try {
          const token = localStorage.getItem('token');
          await precioService.eliminarPrecio(tipoUsuario, token);

          setMensaje({ type: 'success', text: 'Configuración de precio eliminada exitosamente' });
          cargarPrecios(); // Recargar precios
          cargarHistorialPrecios(); // Recargar historial para mostrar el log
        } catch (error) {
          setMensaje({ type: 'error', text: error.message });
        }
      }
    };

    // Función para formatear nombres de tipos de usuario
    const formatearTipoUsuario = (tipoUsuario) => {
      const formateos = {
        'asociado': 'Usuarios Asociados',
        'no_asociado': 'Usuarios No Asociados',
        'estudiante': 'Estudiantes',
        'tercera_edad': 'Tercera Edad',
        'corporativo': 'Usuarios Corporativos'
      };
      
      return formateos[tipoUsuario] || 
             tipoUsuario.split('_').map(palabra => 
               palabra.charAt(0).toUpperCase() + palabra.slice(1)
             ).join(' ');
    };

    return (
      <div className="precios-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <h2>Gestión de Precios del Estacionamiento</h2>
            <p>Configura las tarifas por hora para diferentes tipos de usuarios.</p>
          </div>
          <button 
            className="button button-success"
            onClick={() => setMostrandoFormularioNuevoPrecio(true)}
            style={{ height: 'fit-content' }}
          >
            + Agregar Nuevo Precio
          </button>
        </div>

        {/* Formulario para crear nuevo precio */}
        {mostrandoFormularioNuevoPrecio && (
          <div className="precio-card" style={{ marginBottom: '1rem', border: '2px solid #28a745' }}>
            <h3>Crear Nueva Configuración de Precio</h3>
            <form onSubmit={manejarCrearPrecio}>
              <div className="form-control">
                <label>Tipo de Usuario:</label>
                <input
                  type="text"
                  value={nuevoPrecios.tipoUsuario}
                  onChange={(e) => actualizarNuevoPrecio('tipoUsuario', e.target.value)}
                  className="input"
                  placeholder="Ej: estudiante, tercera_edad, corporativo..."
                  required
                />
              </div>
              
              <div className="form-control">
                <label>Precio por hora ($):</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={nuevoPrecios.precioPorHora}
                  onChange={(e) => actualizarNuevoPrecio('precioPorHora', e.target.value)}
                  className="input"
                  required
                />
              </div>
              
              <div className="form-control">
                <label>Descripción:</label>
                <textarea
                  value={nuevoPrecios.descripcion}
                  onChange={(e) => actualizarNuevoPrecio('descripcion', e.target.value)}
                  className="input"
                  rows="2"
                  placeholder="Descripción opcional para este tipo de precio..."
                />
              </div>
              
              <div className="precio-edit-actions">
                <button type="submit" className="button button-primary">
                  Crear Precio
                </button>
                <button 
                  type="button" 
                  className="button button-secondary"
                  onClick={() => {
                    setMostrandoFormularioNuevoPrecio(false);
                    setNuevoPrecio({
                      tipoUsuario: '',
                      precioPorHora: '',
                      descripcion: ''
                    });
                  }}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        )}
        
        <div className="precios-grid">
          {!precios || precios.length === 0 ? (
            <p>Cargando configuración de precios...</p>
          ) : (
            precios.map(precio => (
              <div key={precio.tipoUsuario} className="precio-card">
                <h3>
                  {formatearTipoUsuario(precio.tipoUsuario)}
                </h3>
                
                {!editandoPrecios[precio.tipoUsuario] ? (
                  <>
                    <div className="precio-info">
                      <div className="precio-amount">
                        <strong>${precio.precioPorHora}</strong>
                        <span>/hora</span>
                      </div>
                      <div className="precio-descripcion">
                        {precio.descripcion || 'Sin descripción'}
                      </div>
                      <div className="precio-meta">
                        <small>Última actualización: {new Date(precio.fechaActualizacion).toLocaleString()}</small>
                        <br />
                        <small>Actualizado por: {precio.actualizadoPor}</small>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <button 
                        className="button button-primary"
                        onClick={() => iniciarEdicion(precio)}
                      >
                        Editar Precio
                      </button>
                      {precio.tipoUsuario !== 'asociado' && precio.tipoUsuario !== 'no_asociado' && (
                        <button 
                          className="button button-danger"
                          onClick={() => eliminarPrecio(precio.tipoUsuario)}
                          style={{ backgroundColor: '#dc3545', borderColor: '#dc3545' }}
                        >
                          Eliminar
                        </button>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="precio-edit">
                    <div className="form-control">
                      <label>Precio por hora ($):</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={valoresTemp[precio.tipoUsuario]?.precioPorHora || ''}
                        onChange={(e) => actualizarValorTemp(precio.tipoUsuario, 'precioPorHora', e.target.value)}
                        className="input"
                      />
                    </div>
                    <div className="form-control">
                      <label>Descripción:</label>
                      <textarea
                        value={valoresTemp[precio.tipoUsuario]?.descripcion || ''}
                        onChange={(e) => actualizarValorTemp(precio.tipoUsuario, 'descripcion', e.target.value)}
                        className="input"
                        rows="2"
                        placeholder="Descripción opcional..."
                      />
                    </div>
                    <div className="form-control">
                      <label>Motivo del cambio:</label>
                      <input
                        type="text"
                        value={valoresTemp[precio.tipoUsuario]?.motivo || ''}
                        onChange={(e) => actualizarValorTemp(precio.tipoUsuario, 'motivo', e.target.value)}
                        className="input"
                        placeholder="Motivo del cambio de precio..."
                      />
                    </div>
                    <div className="precio-edit-actions">
                      <button 
                        className="button button-primary"
                        onClick={(e) => {
                          console.log('BOTÓN GUARDAR CLICKEADO');
                          console.log('Evento:', e);
                          console.log('Tipo de usuario:', precio.tipoUsuario);
                          e.preventDefault();
                          guardarCambios(precio.tipoUsuario);
                        }}
                      >
                        Guardar
                      </button>
                      <button 
                        className="button button-secondary"
                        onClick={() => cancelarEdicion(precio.tipoUsuario)}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
        
        <div className="precios-info">
          <h3>Información Importante</h3>
          <ul>
            <li>Los cambios en los precios se aplicarán inmediatamente a nuevos estacionamientos.</li>
            <li>Los estacionamientos activos mantendrán la tarifa con la que iniciaron.</li>
            <li>Los precios se muestran en pesos argentinos ($).</li>
            <li>Las fracciones de hora se redondean hacia arriba para la facturación.</li>
          </ul>
        </div>

        {/* Historial de cambios */}
        <div className="historial-precios-section" style={{ marginTop: '2rem' }}>
          <h3>Historial de Cambios Recientes</h3>
          {historialPrecios.length === 0 ? (
            <p>No hay cambios de precios registrados.</p>
          ) : (
            <div className="historial-list" style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {historialPrecios.map((log, index) => {
                // Determinar el tipo de acción
                let tipoAccion = 'modificación';
                let colorAccion = '#17a2b8';
                let iconoAccion = '✏️';
                
                if (log.precioAnterior === null && log.precioNuevo !== null) {
                  tipoAccion = 'creación';
                  colorAccion = '#28a745';
                  iconoAccion = '➕';
                } else if (log.precioAnterior !== null && log.precioNuevo === null) {
                  tipoAccion = 'eliminación';
                  colorAccion = '#dc3545';
                  iconoAccion = '🗑️';
                }

                return (
                  <div key={index} className="historial-item" style={{
                    background: '#f8f9fa',
                    border: `1px solid ${colorAccion}`,
                    borderLeft: `4px solid ${colorAccion}`,
                    borderRadius: '6px',
                    padding: '1rem',
                    marginBottom: '0.5rem'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <h4 style={{ margin: '0 0 0.5rem 0', color: '#2c3e50', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          {iconoAccion} {formatearTipoUsuario(log.tipoUsuario)} - {tipoAccion.charAt(0).toUpperCase() + tipoAccion.slice(1)}
                        </h4>
                        
                        {tipoAccion === 'creación' && (
                          <p style={{ margin: '0.25rem 0', color: '#5d6d7e' }}>
                            <strong>Precio inicial:</strong> ${log.precioNuevo}
                          </p>
                        )}
                        
                        {tipoAccion === 'modificación' && (
                          <p style={{ margin: '0.25rem 0', color: '#5d6d7e' }}>
                            <strong>Precio:</strong> ${log.precioAnterior} → ${log.precioNuevo}
                          </p>
                        )}
                        
                        {tipoAccion === 'eliminación' && (
                          <p style={{ margin: '0.25rem 0', color: '#5d6d7e' }}>
                            <strong>Precio eliminado:</strong> ${log.precioAnterior}
                          </p>
                        )}

                        {(log.descripcionNueva || log.descripcionAnterior) && (
                          <p style={{ margin: '0.25rem 0', color: '#5d6d7e' }}>
                            <strong>Descripción:</strong> {log.descripcionNueva || log.descripcionAnterior}
                          </p>
                        )}
                        
                        {log.motivo && (
                          <p style={{ margin: '0.25rem 0', color: '#5d6d7e' }}>
                            <strong>Motivo:</strong> {log.motivo}
                          </p>
                        )}
                        
                        <p style={{ margin: '0.25rem 0', color: '#7f8c8d', fontSize: '0.9rem' }}>
                          <strong>Modificado por:</strong> {log.modificadoPor.nombre} {log.modificadoPor.apellido} ({log.modificadoPor.dni})
                        </p>
                      </div>
                      <div style={{ textAlign: 'right', fontSize: '0.85rem', color: '#95a5a6' }}>
                        {new Date(log.fechaModificacion).toLocaleString()}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Estadísticas mejoradas */}
        {estadisticasPrecios && (
          <div className="estadisticas-precios-section" style={{ marginTop: '2rem' }}>
            <h3>📊 Resumen de Actividad de Precios</h3>
            
            {/* Estadísticas generales */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
              <div className="estadistica-card" style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                borderRadius: '12px',
                padding: '1.5rem',
                textAlign: 'center',
                boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
              }}>
                <h4 style={{ color: 'white', margin: '0 0 0.5rem 0', fontSize: '1rem' }}>📈 Total de Cambios</h4>
                <p style={{ fontSize: '2.5rem', fontWeight: 'bold', margin: 0 }}>
                  {estadisticasPrecios.totalCambios}
                </p>
                <small style={{ opacity: 0.9 }}>Desde el inicio del sistema</small>
              </div>
              
              <div className="estadistica-card" style={{
                background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                color: 'white',
                borderRadius: '12px',
                padding: '1.5rem',
                textAlign: 'center',
                boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
              }}>
                <h4 style={{ color: 'white', margin: '0 0 0.5rem 0', fontSize: '1rem' }}>🔥 Actividad Reciente</h4>
                <p style={{ fontSize: '2.5rem', fontWeight: 'bold', margin: 0 }}>
                  {estadisticasPrecios.actividadReciente}
                </p>
                <small style={{ opacity: 0.9 }}>Cambios en los últimos 30 días</small>
              </div>
            </div>

            {/* Tipos de operaciones */}
            {estadisticasPrecios.operacionesPorTipo && estadisticasPrecios.operacionesPorTipo.length > 0 && (
              <div style={{ marginBottom: '2rem' }}>
                <h4 style={{ color: '#2c3e50', marginBottom: '1rem' }}>🛠️ Tipos de Operaciones Realizadas</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                  {estadisticasPrecios.operacionesPorTipo.map((operacion, index) => {
                    const iconos = {
                      'creacion': '➕',
                      'modificacion': '✏️',
                      'eliminacion': '🗑️'
                    };
                    const nombres = {
                      'creacion': 'Nuevos Precios',
                      'modificacion': 'Modificaciones',
                      'eliminacion': 'Eliminaciones'
                    };
                    const colores = {
                      'creacion': '#27ae60',
                      'modificacion': '#3498db',
                      'eliminacion': '#e74c3c'
                    };
                    
                    return (
                      <div key={index} style={{
                        background: '#fff',
                        border: `2px solid ${colores[operacion._id]}`,
                        borderRadius: '8px',
                        padding: '1rem',
                        textAlign: 'center'
                      }}>
                        <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>
                          {iconos[operacion._id]}
                        </div>
                        <h5 style={{ color: colores[operacion._id], margin: '0 0 0.5rem 0' }}>
                          {nombres[operacion._id]}
                        </h5>
                        <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#2c3e50', margin: 0 }}>
                          {operacion.cantidad}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Tipos de usuario afectados */}
            {estadisticasPrecios.cambiosPorTipo && estadisticasPrecios.cambiosPorTipo.length > 0 && (
              <div style={{ marginBottom: '2rem' }}>
                <h4 style={{ color: '#2c3e50', marginBottom: '1rem' }}>👥 Tipos de Usuario Más Modificados</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                  {estadisticasPrecios.cambiosPorTipo.map((tipo, index) => (
                    <div key={index} style={{
                      background: '#fff',
                      border: '1px solid #e9ecef',
                      borderRadius: '8px',
                      padding: '1rem',
                      textAlign: 'center',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                    }}>
                      <h5 style={{ color: '#2c3e50', margin: '0 0 0.5rem 0' }}>
                        {formatearTipoUsuario(tipo._id)}
                      </h5>
                      <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#27ae60', margin: 0 }}>
                        {tipo.cantidad} cambios
                      </p>
                      <small style={{ color: '#7f8c8d' }}>
                        Último: {new Date(tipo.ultimoCambio).toLocaleDateString()}
                      </small>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Administradores más activos */}
            {estadisticasPrecios.cambiosPorUsuario && estadisticasPrecios.cambiosPorUsuario.length > 0 && (
              <div>
                <h4 style={{ color: '#2c3e50', marginBottom: '1rem' }}>👨‍💼 Administradores Más Activos</h4>
                <div style={{ 
                  background: '#f8f9fa', 
                  borderRadius: '8px', 
                  padding: '1rem',
                  border: '1px solid #e9ecef'
                }}>
                  {estadisticasPrecios.cambiosPorUsuario.map((admin, index) => (
                    <div key={index} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '0.75rem',
                      background: '#fff',
                      borderRadius: '6px',
                      marginBottom: index < estadisticasPrecios.cambiosPorUsuario.length - 1 ? '0.5rem' : 0,
                      border: '1px solid #e9ecef'
                    }}>
                      <div>
                        <strong style={{ color: '#2c3e50' }}>
                          {admin.nombre} {admin.apellido}
                        </strong>
                        <br />
                        <small style={{ color: '#7f8c8d' }}>DNI: {admin._id}</small>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ 
                          fontSize: '1.2rem', 
                          fontWeight: 'bold', 
                          color: '#3498db',
                          display: 'block'
                        }}>
                          {admin.cantidad} cambios
                        </span>
                        <small style={{ color: '#7f8c8d' }}>
                          Último: {new Date(admin.ultimoCambio).toLocaleDateString()}
                        </small>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <Navbar />
      <div className="container">
        <div className="admin-header">
          <div>
            <h1 className="admin-title">Panel de Administración</h1>
            <p className="admin-subtitle">Gestión de comprobantes, usuarios y vehículos</p>
          </div>
          
          <div className="admin-nav">
            <button 
              className={`button ${vistaActual === 'comprobantes' ? 'button-primary' : 'button-secondary'}`}
              onClick={() => {
                setVistaActual('comprobantes');
                setFiltro('');
              }}
            >
              Comprobantes Pendientes
            </button>
            <button 
              className={`button ${vistaActual === 'listado-comprobantes' ? 'button-primary' : 'button-secondary'}`}
              onClick={() => {
                setVistaActual('listado-comprobantes');
                setFiltro('');
              }}
            >
              Todos los Comprobantes
            </button>
            <button 
              className={`button ${vistaActual === 'facturas' ? 'button-primary' : 'button-secondary'}`}
              onClick={() => {
                setVistaActual('facturas');
                setFiltro('');
              }}
            >
              📄 Todas las Facturas
            </button>
            <button 
              className="button button-secondary"
              onClick={() => navigate('/admin/facturador')}
              style={{ background: '#4caf50', color: 'white', border: 'none' }}
            >
              📄 Facturador AFIP
            </button>
            <button 
              className={`button ${vistaActual === 'precios' ? 'button-primary' : 'button-secondary'}`}
              onClick={() => {
                setVistaActual('precios');
                setFiltro('');
                cargarPrecios();
                cargarHistorialPrecios();
                cargarEstadisticasPrecios();
              }}
            >
              Gestión de Precios
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
          {vistaActual === 'comprobantes' && renderComprobantes()}
          {vistaActual === 'listado-comprobantes' && (
            <ListadoComprobantes 
              onMensaje={setMensaje}
            />
          )}
          {vistaActual === 'facturas' && (
            <ListadoFacturas 
              onMensaje={setMensaje}
            />
          )}
          {vistaActual === 'precios' && renderPrecios()}
        </div>
      </div>
    </>
  );
}

export default AdminDashboard;
