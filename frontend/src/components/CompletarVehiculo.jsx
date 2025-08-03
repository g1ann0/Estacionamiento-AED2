// src/components/CompletarVehiculo.jsx
import React, { useState } from 'react';

function CompletarVehiculo() {
  const [dominio, setDominio] = useState('');
  const [marca, setMarca] = useState('');
  const [modelo, setModelo] = useState('');
  const [tipo, setTipo] = useState('auto');
  const [año, setAño] = useState('');
  const [mensaje, setMensaje] = useState('');

  const handleSubmit = async e => {
    e.preventDefault();
    
    try {
      const token = localStorage.getItem('token');
      const dni = localStorage.getItem('dni');

      const nuevoVehiculo = {
        dominio: dominio.trim(),
        marca: marca.trim(),
        modelo: modelo.trim(),
        año: año.trim(),
        tipo: tipo.trim()
      };

      const datosAEnviar = {
        dni,
        nuevoVehiculo
      };

      console.log('Estado del año antes de enviar:', año);
      console.log('Objeto nuevoVehiculo:', nuevoVehiculo);
      console.log('Datos completos a enviar:', datosAEnviar);
      console.log('JSON a enviar:', JSON.stringify(datosAEnviar));

      if (!dni) {
        setMensaje('Error: No se encontró el DNI del usuario');
        return;
      }

      console.log('Token:', token); // Para verificar que el token existe
      
      const res = await fetch('http://localhost:3000/api/vehiculos/agregar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        },
        body: JSON.stringify(datosAEnviar)
      });

      console.log('Respuesta del servidor:', res.status, res.statusText);
      
      const data = await res.json();
      console.log('Datos de respuesta:', data);
      
      if (res.ok) {
        setMensaje('Vehículo agregado correctamente');
        // Limpiar el formulario después de agregar exitosamente
        setDominio('');
        setMarca('');
        setModelo('');
        setAño('');
        setTipo('auto');
      } else {
        throw new Error(data.mensaje || 'Error al guardar vehículo');
      }
    } catch (error) {
      console.error('Error completo:', error);
      if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
        setMensaje('Error: No se puede conectar con el servidor. Asegúrate de que el servidor esté corriendo en http://localhost:3000');
      } else {
        setMensaje(`Error: ${error.message}`);
      }
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <h2>Datos del vehículo</h2>
      <input 
        value={dominio} 
        onChange={e => setDominio(e.target.value)} 
        placeholder="Dominio" 
        required 
      />
      <input 
        value={marca} 
        onChange={e => setMarca(e.target.value)} 
        placeholder="Marca" 
        required 
      />
      <input 
        value={modelo} 
        onChange={e => setModelo(e.target.value)} 
        placeholder="Modelo" 
        required 
      />
      <select 
        value={tipo} 
        onChange={e => setTipo(e.target.value)} 
        required
      >
        <option value="auto">Auto</option>
        <option value="moto">Moto</option>
      </select>
      <input 
        value={año} 
        onChange={e => setAño(e.target.value)} 
        placeholder="Año" 
        required 
      />
      <button type="submit">Guardar vehículo</button>
      <p>{mensaje}</p>
    </form>
  );
}

export default CompletarVehiculo;
