import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import '../styles/theme.css';

function OlvidePassword() {
  const [email, setEmail] = useState('');
  const [mensaje, setMensaje] = useState(null);
  const [loading, setLoading] = useState(false);
  const [enviado, setEnviado] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMensaje(null);

    try {
      const res = await fetch('http://localhost:3000/api/auth/solicitar-recuperacion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (res.ok) {
        setMensaje({ type: 'success', text: data.mensaje });
        setEnviado(true);
      } else {
        setMensaje({ type: 'error', text: data.mensaje || 'Error al solicitar recuperación' });
      }
    } catch (error) {
      console.error('Error al conectar:', error);
      setMensaje({ type: 'error', text: 'Error al conectar con el servidor' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container-center">
      <div className="card card-form" style={{
        maxWidth: '400px',
        width: '100%',
        boxSizing: 'border-box',
        margin: '20px auto'
      }}>
        <h2 style={{ textAlign: 'center', marginBottom: '24px' }}>
          Recuperar Contraseña
        </h2>

        {mensaje && (
          <div
            className={`alert ${mensaje.type === 'success' ? 'alert-success' : 'alert-error'}`}
            style={{ 
              marginBottom: '16px',
              padding: '12px',
              borderRadius: '4px',
              wordWrap: 'break-word'
            }}
          >
            {mensaje.text}
          </div>
        )}

        {!enviado ? (
          <>
            <p style={{ textAlign: 'center', marginBottom: '24px', color: '#666' }}>
              Ingresá tu email y te enviaremos un enlace para recuperar tu contraseña.
            </p>

            <form onSubmit={handleSubmit}>
              <div className="form-control">
                <input
                  className="input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Tu email"
                  type="email"
                  required
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
                  {loading ? 'Enviando...' : 'Enviar enlace de recuperación'}
                </button>
              </div>
            </form>
          </>
        ) : (
          <div style={{ textAlign: 'center' }}>
            <div style={{ 
              fontSize: '48px', 
              marginBottom: '16px',
              color: '#28a745'
            }}>
              ✓
            </div>
            <p style={{ marginBottom: '24px', color: '#666' }}>
              Si el email existe en nuestro sistema, recibirás un enlace para recuperar tu contraseña.
            </p>
            <p style={{ fontSize: '14px', color: '#666' }}>
              Revisá tu bandeja de entrada y la carpeta de spam.
            </p>
          </div>
        )}

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

export default OlvidePassword;
