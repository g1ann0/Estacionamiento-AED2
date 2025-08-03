import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import '../styles/theme.css';

function SetearPassword() {
  const [password, setPassword] = useState('');
  const [mensaje, setMensaje] = useState(null);
  const [dni, setDni] = useState('');
  const [loading, setLoading] = useState(true);
  const [verified, setVerified] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  useEffect(() => {
    const verificarToken = async () => {
      // Si no hay token, mostramos error pero no redirigimos
      if (!token) {
        setMensaje({ type: 'error', text: 'Token no proporcionado. Por favor, verifique el enlace en su correo.' });
        setLoading(false);
        return;
      }

      try {
        console.log('Verificando token:', token);
        const res = await fetch(`http://localhost:3000/api/auth/confirmar/${token}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        });
        
        const data = await res.json();
        console.log('Respuesta del servidor:', data);
        
        if (!res.ok) {
          throw new Error(data.mensaje || 'Token inválido o expirado');
        }
        
        if (data.dni) {
          setDni(data.dni);
          setVerified(true);
          setMensaje({ type: 'success', text: 'Por favor, establece tu contraseña para completar el registro.' });
        } else {
          throw new Error('No se pudo verificar su cuenta. Por favor, intente nuevamente.');
        }
      } catch (err) {
        console.error('Error al verificar token:', err);
        setMensaje({ type: 'error', text: err.message });
      } finally {
        setLoading(false);
      }
    };

    verificarToken();
  }, [token]);

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    console.log('Formulario enviado');
    
    if (!dni || !token) {
      console.log('Falta DNI o token:', { dni, token });
      setMensaje({ type: 'error', text: 'No se encontró el usuario o token inválido' });
      return;
    }

    if (!password.trim() || password.length < 6) {
      console.log('Contraseña inválida');
      setMensaje({ type: 'error', text: 'Por favor, ingrese una contraseña válida (mínimo 6 caracteres)' });
      return;
    }

    setLoading(true);
    try {
      const datos = { dni, password, token };
      console.log('Enviando datos:', datos);
      
      const response = await fetch('http://localhost:3000/api/auth/setear-password', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(datos),
      });
      
      const data = await response.json();
      console.log('Respuesta del servidor:', data);

      if (response.ok) {
        setVerified(true);
        setMensaje({ 
          type: 'success', 
          text: 'Contraseña establecida correctamente. ¡Tu cuenta ha sido activada!' 
        });
        
        // Redirigir al login después de 5 segundos
        setTimeout(() => {
          navigate('/login');
        }, 5000);
      } else {
        throw new Error(data.mensaje || 'Error al establecer la contraseña');
      }
    } catch (error) {
      console.error('Error al establecer contraseña:', error);
      setMensaje({ 
        type: 'error', 
        text: error.message || 'Error al establecer la contraseña. Por favor, intente nuevamente.'
      });
    } finally {
      setLoading(false);
    }
  };



  useEffect(() => {
    // Prevenimos la redirección al login cuando la página se carga inicialmente
    const preventRedirect = (e) => {
      if (loading || verified) {
        e.preventDefault();
      }
    };

    window.addEventListener('beforeunload', preventRedirect);
    return () => window.removeEventListener('beforeunload', preventRedirect);
  }, [loading, verified]);

  if (loading) {
    return (
      <div className="container">
        <div className="card" style={{ maxWidth: '400px', margin: '0 auto', textAlign: 'center', padding: '2rem' }}>
          <div className="spinner"></div>
          <p style={{ marginTop: '1rem' }}>
            {mensaje?.type === 'success' ? 'Estableciendo contraseña...' : 'Verificando token...'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="parking-header">
        <h1 className="parking-title">Estacionamiento Seguro</h1>
        <p className="parking-subtitle">
          {loading ? 'Verificando...' : dni ? 'Establece tu contraseña para activar tu cuenta' : 'Verificando token...'}
        </p>
      </div>

      <div className="card" style={{ maxWidth: '400px', margin: '0 auto' }}>
        {mensaje && (
          <div className={`message message-${mensaje.type}`} style={{ marginBottom: '1rem' }}>
            {mensaje.text}
          </div>
        )}

        {/* Solo mostramos el formulario si tenemos el DNI y no hay error */}
        {dni && mensaje?.type !== 'error' && (
          <form onSubmit={handlePasswordSubmit} className="password-form">
            <div className="form-control">
              <label htmlFor="password" style={{ display: 'block', marginBottom: '0.5rem' }}>
                Nueva contraseña:
              </label>
              <input
                id="password"
                className="input"
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChange={e => setPassword(e.target.value)}
                minLength={6}
                required
                autoFocus
                style={{ width: '100%', boxSizing: 'border-box' }}
              />
            </div>

            <div className="form-control" style={{ marginTop: '1rem' }}>
              <button
                type="submit"
                className="button button-primary"
                style={{ 
                  width: '100%', 
                  boxSizing: 'border-box',
                  minHeight: '44px'
                }}
                disabled={loading}
              >
                {loading ? 'Estableciendo...' : 'Establecer Contraseña'}
              </button>
            </div>
          </form>
        )}

        {/* Mostramos diferentes opciones según el estado */}
        {mensaje?.type === 'error' && (
          <div style={{ textAlign: 'center', marginTop: '1rem' }}>
            <p style={{ marginBottom: '1rem', color: '#666' }}>
              Si el enlace no funciona, solicita uno nuevo en la página de inicio.
            </p>
            <Link to="/login" className="button button-secondary" style={{ textDecoration: 'none' }}>
              Volver al inicio
            </Link>
          </div>
        )}
        
        {/* Mostramos el botón de ir al login solo cuando la contraseña se estableció correctamente */}
        {mensaje?.type === 'success' && !loading && (
          <div style={{ textAlign: 'center', marginTop: '1rem' }}>
            <p style={{ marginBottom: '1rem', color: '#2c5282' }}>
              ¡Tu cuenta ha sido activada exitosamente!
            </p>
            <Link to="/login" className="button button-primary" style={{ textDecoration: 'none' }}>
              Ir a iniciar sesión
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

export default SetearPassword;
