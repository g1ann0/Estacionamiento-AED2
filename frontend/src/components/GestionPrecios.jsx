import React, { useState, useEffect } from 'react';
import { precioService } from '../services/precioService';
import '../styles/admin.css';

function GestionPrecios() {
  const [precios, setPrecios] = useState([]);
  const [historialPrecios, setHistorialPrecios] = useState([]);
  const [estadisticasPrecios, setEstadisticasPrecios] = useState(null);
  const [editandoPrecios, setEditandoPrecios] = useState({});
  const [valoresTemp, setValoresTemp] = useState({});
  const [mensaje, setMensaje] = useState(null);
  const [mostrandoFormularioNuevoPrecio, setMostrandoFormularioNuevoPrecio] = useState(false);
  const [nuevoPrecios, setNuevoPrecio] = useState({
    tipoUsuario: '',
    precioPorHora: '',
    descripcion: ''
  });

  useEffect(() => {
    cargarPrecios();
    cargarHistorialPrecios();
    cargarEstadisticasPrecios();
  }, []);

  const cargarPrecios = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await precioService.obtenerTodosLosPrecios(token);
      setPrecios(res.precios || []);
    } catch (error) {
      setMensaje({ type: 'error', text: error.message });
    }
  };

  const cargarHistorialPrecios = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await precioService.obtenerHistorialPrecios(null, 20, 1, token);
      setHistorialPrecios(res.historial || []);
    } catch (error) {
      console.error('Error al cargar historial de precios:', error);
    }
  };

  const cargarEstadisticasPrecios = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await precioService.obtenerEstadisticasPrecios(token);
      setEstadisticasPrecios(res.estadisticas || null);
    } catch (error) {
      console.error('Error al cargar estadísticas:', error);
    }
  };

  const actualizarPrecio = async (tipoUsuario, nuevoPrecio, descripcion, motivo) => {
    try {
      const token = localStorage.getItem('token');
      await precioService.actualizarPrecio(tipoUsuario, nuevoPrecio, descripcion, motivo, token);
      setMensaje({ type: 'success', text: 'Precio actualizado exitosamente' });
      cargarPrecios();
      cargarHistorialPrecios();
      cargarEstadisticasPrecios();
    } catch (error) {
      throw error;
    }
  };

  const iniciarEdicion = (precio) => {
    setEditandoPrecios({ ...editandoPrecios, [precio.tipoUsuario]: true });
    setValoresTemp({
      ...valoresTemp,
      [precio.tipoUsuario]: {
        precioPorHora: precio.precioPorHora,
        descripcion: precio.descripcion || '',
        motivo: ''
      }
    });
  };

  const cancelarEdicion = (tipoUsuario) => {
    setEditandoPrecios({ ...editandoPrecios, [tipoUsuario]: false });
    setValoresTemp({ ...valoresTemp, [tipoUsuario]: {} });
  };

  const guardarCambios = async (tipoUsuario) => {
    const valores = valoresTemp[tipoUsuario];
    
    if (!valores || !valores.precioPorHora || valores.precioPorHora <= 0) {
      setMensaje({ type: 'error', text: 'El precio debe ser mayor a 0' });
      return;
    }

    try {
      await actualizarPrecio(tipoUsuario, valores.precioPorHora, valores.descripcion, valores.motivo);
      setEditandoPrecios({ ...editandoPrecios, [tipoUsuario]: false });
      setValoresTemp({ ...valoresTemp, [tipoUsuario]: {} });
    } catch (error) {
      setMensaje({ type: 'error', text: error.message || 'Error al guardar cambios' });
    }
  };

  const actualizarValorTemp = (tipoUsuario, campo, valor) => {
    setValoresTemp({
      ...valoresTemp,
      [tipoUsuario]: {
        ...valoresTemp[tipoUsuario],
        [campo]: valor
      }
    });
  };

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

  const eliminarPrecio = async (tipoUsuario) => {
    if (window.confirm(`¿Está seguro de que desea eliminar la configuración de precio para "${formatearTipoUsuario(tipoUsuario)}"?`)) {
      try {
        const token = localStorage.getItem('token');
        await precioService.eliminarPrecio(tipoUsuario, token);

        setMensaje({ type: 'success', text: 'Configuración de precio eliminada exitosamente' });
        cargarPrecios();
        cargarHistorialPrecios();
      } catch (error) {
        setMensaje({ type: 'error', text: error.message });
      }
    }
  };

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
      {mensaje && (
        <div className={`message message-${mensaje.type}`} style={{ margin: '1rem 0' }}>
          {mensaje.text}
          <button onClick={() => setMensaje(null)} style={{ marginLeft: 'auto' }}>×</button>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div>
          <h2>💰 Gestión de Precios del Estacionamiento</h2>
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
                      onClick={() => guardarCambios(precio.tipoUsuario)}
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
        <h3>📋 Historial de Cambios Recientes</h3>
        {historialPrecios.length === 0 ? (
          <p>No hay cambios de precios registrados.</p>
        ) : (
          <div className="historial-list" style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {historialPrecios.map((log, index) => {
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

                      {log.motivo && (
                        <p style={{ margin: '0.25rem 0', color: '#5d6d7e' }}>
                          <strong>Motivo:</strong> {log.motivo}
                        </p>
                      )}
                      
                      <p style={{ margin: '0.25rem 0', color: '#7f8c8d', fontSize: '0.9rem' }}>
                        <strong>Por:</strong> {log.modificadoPor.nombre} {log.modificadoPor.apellido}
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
    </div>
  );
}

export default GestionPrecios;
