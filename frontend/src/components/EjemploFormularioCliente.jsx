/**
 * EJEMPLO DE USO DEL MODAL DE CONSULTA DE CUIT
 * 
 * Este componente demuestra cómo integrar la búsqueda de CUIT en AFIP/ARCA
 * en cualquier formulario de cliente del sistema
 */

import React, { useState } from 'react';
import ConsultaCUITModal from './ConsultaCUITModal';

const EjemploFormularioCliente = () => {
  const [modalAbierto, setModalAbierto] = useState(false);
  
  // Estado del formulario
  const [cliente, setCliente] = useState({
    cuit: '',
    razonSocial: '',
    condicionIVA: 'Consumidor Final',
    domicilio: '',
    localidad: '',
    provincia: '',
    codigoPostal: '',
    email: '',
    telefono: ''
  });

  /**
   * Callback cuando se obtienen datos de AFIP
   * Autocompleta el formulario con los datos fiscales
   */
  const handleDatosAFIP = (datosAFIP) => {
    console.log('Datos recibidos de AFIP:', datosAFIP);

    // Autocompletar formulario
    setCliente({
      ...cliente,
      cuit: datosAFIP.cuit || cliente.cuit,
      razonSocial: datosAFIP.razonSocial || cliente.razonSocial,
      condicionIVA: datosAFIP.condicionIVA || cliente.condicionIVA,
      domicilio: datosAFIP.domicilioFiscal || cliente.domicilio,
      localidad: datosAFIP.localidad || cliente.localidad,
      provincia: datosAFIP.provincia || cliente.provincia,
      codigoPostal: datosAFIP.codigoPostal || cliente.codigoPostal
    });

    // Mostrar notificación de éxito (opcional)
    alert('✅ Datos obtenidos de AFIP exitosamente');
  };

  /**
   * Maneja el cambio en los inputs del formulario
   */
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setCliente({
      ...cliente,
      [name]: value
    });
  };

  /**
   * Guarda el cliente
   */
  const handleSubmit = (e) => {
    e.preventDefault();
    console.log('Guardando cliente:', cliente);
    // Aquí iría la lógica de guardado (API call)
  };

  return (
    <div className="formulario-cliente-container">
      <h2>📝 Formulario de Cliente</h2>
      
      <form onSubmit={handleSubmit} className="formulario-cliente">
        
        {/* Sección de datos fiscales con botón de búsqueda AFIP */}
        <div className="seccion-fiscal">
          <h3>Datos Fiscales</h3>
          
          <div className="campo-con-busqueda">
            <div className="input-group">
              <label htmlFor="cuit">CUIT</label>
              <input
                id="cuit"
                type="text"
                name="cuit"
                value={cliente.cuit}
                onChange={handleInputChange}
                placeholder="20-12345678-9"
              />
            </div>
            
            <button
              type="button"
              onClick={() => setModalAbierto(true)}
              className="btn-buscar-afip"
              title="Buscar en AFIP/ARCA"
            >
              🔍 Buscar en ARCA
            </button>
          </div>

          <div className="input-group">
            <label htmlFor="razonSocial">Razón Social / Nombre</label>
            <input
              id="razonSocial"
              type="text"
              name="razonSocial"
              value={cliente.razonSocial}
              onChange={handleInputChange}
              placeholder="Nombre o razón social del cliente"
            />
          </div>

          <div className="input-group">
            <label htmlFor="condicionIVA">Condición IVA</label>
            <select
              id="condicionIVA"
              name="condicionIVA"
              value={cliente.condicionIVA}
              onChange={handleInputChange}
            >
              <option value="Consumidor Final">Consumidor Final</option>
              <option value="Responsable Inscripto">Responsable Inscripto</option>
              <option value="Monotributista">Monotributista</option>
              <option value="Exento">Exento</option>
              <option value="No Responsable">No Responsable</option>
            </select>
          </div>
        </div>

        {/* Sección de domicilio */}
        <div className="seccion-domicilio">
          <h3>Domicilio</h3>
          
          <div className="input-group">
            <label htmlFor="domicilio">Dirección</label>
            <input
              id="domicilio"
              type="text"
              name="domicilio"
              value={cliente.domicilio}
              onChange={handleInputChange}
              placeholder="Calle y número"
            />
          </div>

          <div className="input-row">
            <div className="input-group">
              <label htmlFor="localidad">Localidad</label>
              <input
                id="localidad"
                type="text"
                name="localidad"
                value={cliente.localidad}
                onChange={handleInputChange}
                placeholder="Localidad"
              />
            </div>

            <div className="input-group">
              <label htmlFor="provincia">Provincia</label>
              <input
                id="provincia"
                type="text"
                name="provincia"
                value={cliente.provincia}
                onChange={handleInputChange}
                placeholder="Provincia"
              />
            </div>

            <div className="input-group">
              <label htmlFor="codigoPostal">C.P.</label>
              <input
                id="codigoPostal"
                type="text"
                name="codigoPostal"
                value={cliente.codigoPostal}
                onChange={handleInputChange}
                placeholder="1000"
              />
            </div>
          </div>
        </div>

        {/* Sección de contacto */}
        <div className="seccion-contacto">
          <h3>Contacto</h3>
          
          <div className="input-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              name="email"
              value={cliente.email}
              onChange={handleInputChange}
              placeholder="cliente@email.com"
            />
          </div>

          <div className="input-group">
            <label htmlFor="telefono">Teléfono</label>
            <input
              id="telefono"
              type="tel"
              name="telefono"
              value={cliente.telefono}
              onChange={handleInputChange}
              placeholder="11-1234-5678"
            />
          </div>
        </div>

        {/* Botones de acción */}
        <div className="formulario-acciones">
          <button type="button" className="btn-cancelar">
            Cancelar
          </button>
          <button type="submit" className="btn-guardar">
            💾 Guardar Cliente
          </button>
        </div>
      </form>

      {/* Modal de consulta AFIP */}
      <ConsultaCUITModal
        isOpen={modalAbierto}
        onClose={() => setModalAbierto(false)}
        onDatosObtenidos={handleDatosAFIP}
      />
    </div>
  );
};

export default EjemploFormularioCliente;
