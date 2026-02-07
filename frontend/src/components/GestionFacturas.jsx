import React, { useState, useEffect, useCallback } from 'react';
import { facturadorService } from '../services/facturadorService';
import './GestionFacturas.css';

const GestionFacturas = () => {
  const [facturas, setFacturas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [paginacion, setPaginacion] = useState({ pagina: 1, limite: 10, total: 0, totalPaginas: 0 });
  const [facturaSeleccionada, setFacturaSeleccionada] = useState(null);
  const [showModal, setShowModal] = useState(false);

  // Filtros
  const [filtros, setFiltros] = useState({
    fechaDesde: '',
    fechaHasta: '',
    tipoFactura: '',
    estado: '',
    busqueda: ''
  });

  const cargarFacturas = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      const filtrosConPaginacion = {
        ...filtros,
        pagina: paginacion.pagina,
        limite: paginacion.limite
      };
      const response = await facturadorService.obtenerFacturas(filtrosConPaginacion, token);
      if (response.success) {
        setFacturas(response.facturas);
        setPaginacion(response.paginacion);
      } else {
        setError(response.mensaje || 'Error al cargar facturas');
      }
    } catch (err) {
      setError('Error al cargar facturas: ' + (err.message || 'Error desconocido'));
    } finally {
      setLoading(false);
    }
  }, [filtros, paginacion.pagina, paginacion.limite]);

  useEffect(() => {
    cargarFacturas();
  }, [cargarFacturas]);

  const handleFiltroChange = (campo, valor) => {
    setFiltros(prev => ({ ...prev, [campo]: valor }));
    setPaginacion(prev => ({ ...prev, pagina: 1 })); // Reset a página 1 al filtrar
  };

  const handleBuscar = () => {
    cargarFacturas();
  };

  const handleLimpiarFiltros = () => {
    setFiltros({
      fechaDesde: '',
      fechaHasta: '',
      tipoFactura: '',
      estado: '',
      busqueda: ''
    });
    setPaginacion(prev => ({ ...prev, pagina: 1 }));
  };

  const handleVerDetalle = (factura) => {
    setFacturaSeleccionada(factura);
    setShowModal(true);
  };

  const handleCerrarModal = () => {
    setShowModal(false);
    setFacturaSeleccionada(null);
  };

  const handleDescargarPDF = async (nroFactura) => {
    try {
      setError(null);
      
      // Llamar al servicio para descargar el PDF
      const response = await facturadorService.descargarFacturaPDF(nroFactura);
      
      // Crear un blob URL y descargar el archivo
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Factura_${nroFactura}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
      
    } catch (err) {
      console.error('Error al descargar PDF:', err);
      setError(err.response?.data?.error || 'Error al generar el PDF');
    }
  };

  const handlePaginaAnterior = () => {
    if (paginacion.pagina > 1) {
      setPaginacion(prev => ({ ...prev, pagina: prev.pagina - 1 }));
    }
  };

  const handlePaginaSiguiente = () => {
    if (paginacion.pagina < paginacion.totalPaginas) {
      setPaginacion(prev => ({ ...prev, pagina: prev.pagina + 1 }));
    }
  };

  const formatearFecha = (fecha) => {
    if (!fecha) return '-';
    return new Date(fecha).toLocaleDateString('es-AR');
  };

  const formatearMonto = (monto) => {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(monto || 0);
  };

  return (
    <div className="gestion-facturas-container">
      <h2>Gestión de Facturas</h2>

      {/* Filtros */}
      <div className="filtros-container">
        <div className="filtros-grid">
          <div className="filtro-item">
            <label>Fecha Desde:</label>
            <input
              type="date"
              value={filtros.fechaDesde}
              onChange={(e) => handleFiltroChange('fechaDesde', e.target.value)}
            />
          </div>
          <div className="filtro-item">
            <label>Fecha Hasta:</label>
            <input
              type="date"
              value={filtros.fechaHasta}
              onChange={(e) => handleFiltroChange('fechaHasta', e.target.value)}
            />
          </div>
          <div className="filtro-item">
            <label>Tipo de Factura:</label>
            <select
              value={filtros.tipoFactura}
              onChange={(e) => handleFiltroChange('tipoFactura', e.target.value)}
            >
              <option value="">Todas</option>
              <option value="A">Factura A</option>
              <option value="B">Factura B</option>
              <option value="C">Factura C</option>
            </select>
          </div>
          <div className="filtro-item">
            <label>Estado:</label>
            <select
              value={filtros.estado}
              onChange={(e) => handleFiltroChange('estado', e.target.value)}
            >
              <option value="">Todos</option>
              <option value="emitida">Emitida</option>
              <option value="anulada">Anulada</option>
            </select>
          </div>
          <div className="filtro-item filtro-busqueda">
            <label>Búsqueda (Nombre, CUIT, CAE):</label>
            <input
              type="text"
              placeholder="Buscar..."
              value={filtros.busqueda}
              onChange={(e) => handleFiltroChange('busqueda', e.target.value)}
            />
          </div>
        </div>
        <div className="filtros-botones">
          <button className="btn btn-primary" onClick={handleBuscar}>
            Buscar
          </button>
          <button className="btn btn-secondary" onClick={handleLimpiarFiltros}>
            Limpiar Filtros
          </button>
        </div>
      </div>

      {/* Mensajes de estado */}
      {error && <div className="error-message">{error}</div>}
      {loading && <div className="loading-message">Cargando facturas...</div>}

      {/* Tabla de facturas */}
      {!loading && (
        <>
          <div className="facturas-table-container">
            <table className="facturas-table">
              <thead>
                <tr>
                  <th>Nro Factura</th>
                  <th>Fecha</th>
                  <th>Tipo</th>
                  <th>Cliente</th>
                  <th>CAE</th>
                  <th>Monto Total</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {facturas.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="text-center">No se encontraron facturas</td>
                  </tr>
                ) : (
                  facturas.map((factura) => (
                    <tr key={factura._id}>
                      <td>{factura.nroFactura}</td>
                      <td>{formatearFecha(factura.fechaEmision)}</td>
                      <td>Factura {factura.tipoComprobante === 1 ? 'A' : factura.tipoComprobante === 6 ? 'B' : 'C'}</td>
                      <td>
                        {factura.cliente?.nombre} {factura.cliente?.apellido}
                        <br />
                        <small>{factura.cliente?.numeroDocumento}</small>
                      </td>
                      <td><small>{factura.cae}</small></td>
                      <td>{formatearMonto(factura.importeTotal)}</td>
                      <td>
                        <span className={`badge badge-${factura.estado === 'emitida' ? 'success' : 'danger'}`}>
                          {factura.estado}
                        </span>
                      </td>
                      <td>
                        <button
                          className="btn btn-sm btn-info"
                          onClick={() => handleVerDetalle(factura)}
                          style={{ marginRight: '8px' }}
                        >
                          Ver Detalle
                        </button>
                        <button
                          className="btn btn-sm btn-success"
                          onClick={() => handleDescargarPDF(factura.nroFactura)}
                          title="Descargar PDF"
                        >
                          📄 Generar PDF
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Paginación */}
          {paginacion.totalPaginas > 1 && (
            <div className="paginacion-container">
              <button
                className="btn btn-secondary"
                onClick={handlePaginaAnterior}
                disabled={paginacion.pagina === 1}
              >
                ← Anterior
              </button>
              <span className="paginacion-info">
                Página {paginacion.pagina} de {paginacion.totalPaginas} - Total: {paginacion.total} facturas
              </span>
              <button
                className="btn btn-secondary"
                onClick={handlePaginaSiguiente}
                disabled={paginacion.pagina === paginacion.totalPaginas}
              >
                Siguiente →
              </button>
            </div>
          )}
        </>
      )}

      {/* Modal de detalle */}
      {showModal && facturaSeleccionada && (
        <div className="modal-overlay" onClick={handleCerrarModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Detalle de Factura {facturaSeleccionada.nroFactura}</h3>
              <button className="btn-close" onClick={handleCerrarModal}>×</button>
            </div>
            <div className="modal-body">
              <div className="detalle-seccion">
                <h4>Información General</h4>
                <p><strong>CAE:</strong> {facturaSeleccionada.cae}</p>
                <p><strong>Vencimiento CAE:</strong> {formatearFecha(facturaSeleccionada.caeFechaVencimiento)}</p>
                <p><strong>Fecha de Emisión:</strong> {formatearFecha(facturaSeleccionada.fechaEmision)}</p>
                <p><strong>Tipo Comprobante:</strong> {facturaSeleccionada.tipoComprobante} - {facturaSeleccionada.tipoComprobante === 1 ? 'Factura A' : facturaSeleccionada.tipoComprobante === 6 ? 'Factura B' : 'Factura C'}</p>
                <p><strong>Punto de Venta:</strong> {facturaSeleccionada.puntoVenta}</p>
                <p><strong>Número:</strong> {facturaSeleccionada.numeroComprobante}</p>
                <p><strong>Estado:</strong> <span className={`badge badge-${facturaSeleccionada.estado === 'emitida' ? 'success' : 'danger'}`}>{facturaSeleccionada.estado}</span></p>
              </div>

              <div className="detalle-seccion">
                <h4>Emisor</h4>
                <p><strong>Razón Social:</strong> {facturaSeleccionada.emisor?.razonSocial}</p>
                <p><strong>CUIT:</strong> {facturaSeleccionada.emisor?.cuit}</p>
                <p><strong>Condición IVA:</strong> {facturaSeleccionada.emisor?.condicionIva}</p>
              </div>

              <div className="detalle-seccion">
                <h4>Cliente</h4>
                <p><strong>Nombre:</strong> {facturaSeleccionada.cliente?.nombre} {facturaSeleccionada.cliente?.apellido}</p>
                <p><strong>Documento:</strong> {facturaSeleccionada.cliente?.tipoDocumento} {facturaSeleccionada.cliente?.numeroDocumento}</p>
                <p><strong>Condición IVA:</strong> {facturaSeleccionada.cliente?.condicionIva}</p>
              </div>

              <div className="detalle-seccion">
                <h4>Items</h4>
                <table className="items-table">
                  <thead>
                    <tr>
                      <th>Descripción</th>
                      <th>Cantidad</th>
                      <th>Precio Unit.</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {facturaSeleccionada.items?.map((item, index) => (
                      <tr key={index}>
                        <td>{item.descripcion}</td>
                        <td>{item.cantidad}</td>
                        <td>{formatearMonto(item.precioUnitario)}</td>
                        <td>{formatearMonto(item.cantidad * item.precioUnitario)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="detalle-seccion">
                <h4>Totales</h4>
                <p><strong>Importe Neto:</strong> {formatearMonto(facturaSeleccionada.importeNeto)}</p>
                <p><strong>IVA:</strong> {formatearMonto(facturaSeleccionada.importeIVA)}</p>
                <p><strong>Total:</strong> <span className="total-destacado">{formatearMonto(facturaSeleccionada.importeTotal)}</span></p>
              </div>

              {facturaSeleccionada.observaciones && (
                <div className="detalle-seccion">
                  <h4>Observaciones</h4>
                  <p>{facturaSeleccionada.observaciones}</p>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={handleCerrarModal}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GestionFacturas;
