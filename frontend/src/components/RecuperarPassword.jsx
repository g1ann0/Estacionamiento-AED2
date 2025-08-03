import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import '../styles/theme.css';

function RecuperarPassword() {
  const [searchParams] = useSearchParams();
  const [password, setPassword] = useState('');
  const [confirmarPassword, setConfirmarPassword] = useState('');
  const [mensaje, setMensaje] = useState(null);
  const [loading, setLoading] = useState(false);
  const [tokenValido, setTokenValido] = useState(false);
  const [verificandoToken, setVerificandoToken] = useState(true);
  const [email, setEmail] = useState('');
  const navigate = useNavigate();

  const token = searchParams.get('token');

  useEffect(() => {
    const verificarToken = async () => {
      try {
        const res = await fetch(`http://localhost:3000/api/auth/validar-recuperacion/${token}`);
        const data = await res.json();

        if (res.ok) {
          setTokenValido(true);
          setEmail(data.email);
        } else {
          setMensaje({ type: 'error', text: data.mensaje });
        }
      } catch (error) {
        setMensaje({ type: 'error', text: 'Error al verificar token' });
      } finally {
        setVerificandoToken(false);
      }
    };

    if (token) {
      verificarToken();
    } else {
      setMensaje({ type: 'error', text: 'Token no proporcionado' });
      setVerificandoToken(false);
    }
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (password !== confirmarPassword) {
      setMensaje({ type: 'error', text: 'Las contraseñas no coinciden' });
      return;
    }

    if (password.length < 6) {
      setMensaje({ type: 'error', text: 'La contraseña debe tener al menos 6 caracteres' });
      return;
    }

    setLoading(true);
    setMensaje(null);

    try {
      const res = await fetch('http://localhost:3000/api/auth/restablecer-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          token, 
          nuevaPassword: password 
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setMensaje({ type: 'success', text: data.mensaje });
        // Redirigir al login después de 2 segundos
        setTimeout(() => {
          navigate('/login');
        }, 2000);
      } else {
        setMensaje({ type: 'error', text: data.mensaje });
      }
    } catch (error) {
      console.error('Error al restablecer:', error);
      setMensaje({ type: 'error', text: 'Error al conectar con el servidor' });
    } finally {
      setLoading(false);
    }
  };

  if (verificandoToken) {
    return (
      <div className="container-center">
        <div className="card card-form">
          <div style={{ textAlign: 'center' }}>
            <div className="loading-spinner" style={{ margin: '20px auto' }}></div>
            <p>Verificando enlace...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!tokenValido) {
    return (
      <div className="container-center">
        <div className="card card-form">
          <h2 style={{ textAlign: 'center', marginBottom: '24px' }}>
            Enlace Inválido
          </h2>

          {mensaje && (
            <div className="alert alert-error" style={{ marginBottom: '16px' }}>
              {mensaje.text}
            </div>
          )}

          <div style={{ textAlign: 'center' }}>
            <p style={{ marginBottom: '24px', color: '#666' }}>
              El enlace de recuperación es inválido o ha expirado.
            </p>
            <Link 
              to="/olvide-password" 
              className="button button-primary"
              style={{ textDecoration: 'none' }}
            >
              Solicitar nuevo enlace
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container-center">
      <div className="card card-form">
        <h2 style={{ textAlign: 'center', marginBottom: '24px' }}>
          Nueva Contraseña
        </h2>

        <p style={{ textAlign: 'center', marginBottom: '24px', color: '#666' }}>
          Establecé una nueva contraseña para <strong>{email}</strong>
        </p>

        {mensaje && (
          <div
            className={`alert ${mensaje.type === 'success' ? 'alert-success' : 'alert-error'}`}
            style={{ marginBottom: '16px' }}
          >
            {mensaje.text}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-control">
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Nueva contraseña"
              required
              minLength="6"
              style={{ width: '100%', boxSizing: 'border-box' }}
            />
          </div>

          <div className="form-control">
            <input
              className="input"
              type="password"
              value={confirmarPassword}
              onChange={(e) => setConfirmarPassword(e.target.value)}
              placeholder="Confirmar nueva contraseña"
              required
              minLength="6"
              style={{ width: '100%', boxSizing: 'border-box' }}
            />
          </div>

          <div className="form-control">
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
              {loading ? 'Guardando...' : 'Establecer nueva contraseña'}
            </button>
          </div>
        </form>

        <div style={{ textAlign: 'center', marginTop: '24px' }}>
          <Link 
            to="/login" 
            style={{ 
              color: '#007bff', 
              textDecoration: 'none' 
            }}
          >
            ← Volver al inicio de sesión
          </Link>
        </div>
      </div>
    </div>
  );
}

export default RecuperarPassword;
