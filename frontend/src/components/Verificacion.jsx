// src/components/Verificacion.jsx
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

function Verificacion() {
  const { token } = useParams();
  const [mensaje, setMensaje] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const confirmar = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/auth/confirmar/${token}`);
        const data = await res.json();
        setMensaje(data.mensaje);
        localStorage.setItem('dni', data.dni); // Guardamos DNI para setear contraseña
        setTimeout(() => navigate('/setear-password'), 2000);
      } catch (error) {
        setMensaje('Error al confirmar email');
      }
    };
    confirmar();
  }, [token, navigate]);

  return <h3>{mensaje}</h3>;
}

export default Verificacion;
