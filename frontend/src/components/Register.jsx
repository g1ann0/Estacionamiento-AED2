import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import CONFIG from '../config/config.js';
import SEO from './SEO';
import '../styles/theme.css';
import '../styles/animations.css';

function Register() {
  const [form, setForm] = useState({
    dni: '',
    nombre: '',
    apellido: '',
    email: ''
  });
  const [mensaje, setMensaje] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);

  const handleChange = e => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${CONFIG.API_BASE_URL}/auth/registrar-con-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      setMensaje({ 
        type: res.ok ? 'success' : 'error',
        text: data.mensaje || (res.ok ? 'Registro exitoso' : 'Error al registrar')
      });
    } catch (error) {
      setMensaje({ type: 'error', text: 'Error al conectar con el servidor' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <SEO 
        title="Registro - Sistema de Gestión de Estacionamiento"
        description="Crea tu cuenta en nuestro sistema de gestión de estacionamiento. Registro rápido y seguro para comenzar a gestionar tu vehículo inmediatamente."
        keywords="registro, crear cuenta, estacionamiento, nuevo usuario, registrarse"
        canonical="/registro"
      />
      
      <h1 className="parking-title">Estacionamiento Seguro</h1>
      
      <div className="parking-header">
        <div className="parking-carousel">
          <p className="carousel-phrase">Únete a nuestra comunidad</p>
          <p className="carousel-phrase">Registro rápido y seguro</p>
          <p className="carousel-phrase">Acceso inmediato al sistema</p>
          <p className="carousel-phrase">Comienza a gestionar tu estacionamiento</p>
          <p className="carousel-phrase">Bienvenido a la nueva experiencia</p>
        </div>
        
        <div className="animated-car-container">
          <div className="animated-car">
            <div className="car-body">🚗</div>
            <div className="car-smoke">💨</div>
            <div className="car-smoke">💨</div>
            <div className="car-smoke">💨</div>
            <div className="car-smoke">💨</div>
          </div>
          
          <div className="road-lines">
            <div className="road-line"></div>
            <div className="road-line"></div>
            <div className="road-line"></div>
          </div>
        </div>
      </div>

      <div className="parking-features">
        <div className="feature-card card">
          <div className="parking-scene">
            <div className="simple-parking">
              <div className="single-parking-slot">
                <div className="slot-lines"></div>
                <div className="slot-marker">P</div>
                <div className="parking-success">✅</div>
              </div>
              
              <div className="simple-car-container">
                <div className="simple-car">🚗</div>
              </div>
            </div>
          </div>
          <h3 className="feature-title">Acceso Rápido</h3>
          <p className="feature-description">Registro en minutos</p>
        </div>
        
        <div className="feature-card card">
          <div className="payment-scene">
            <div className="pos-terminal">
              <div className="pos-screen">💳</div>
              <div className="pos-base"></div>
            </div>
            <div className="payment-card">
              <div className="card-chip">📟</div>
              <div className="card-waves">
                <div className="wave"></div>
                <div className="wave"></div>
                <div className="wave"></div>
              </div>
            </div>
            <div className="payment-success">✅</div>
          </div>
          <h3 className="feature-title">Gestión Digital</h3>
          <p className="feature-description">Pagos y control total</p>
        </div>
        
        <div className="feature-card card">
          <div className="mobile-scene">
            <div className="smartphone">
              <div className="phone-screen">
                <div className="app-interface">
                  <div className="status-bar">📶 🔋</div>
                  <div className="app-content">🚗</div>
                </div>
              </div>
              <div className="phone-notifications">
                <div className="notification">🔔</div>
                <div className="notification">💰</div>
                <div className="notification">⏰</div>
              </div>
            </div>
            <div className="wifi-signals">
              <div className="signal"></div>
              <div className="signal"></div>
              <div className="signal"></div>
            </div>
          </div>
          <h3 className="feature-title">App Móvil</h3>
          <p className="feature-description">Desde cualquier lugar</p>
        </div>
      </div>

      <div style={{ textAlign: "center", marginTop: "2rem" }}>
        <button
          onClick={() => setShowRegisterModal(true)}
          className="button button-primary"
          style={{
            fontSize: "1.2rem",
            padding: "1rem 2rem",
            borderRadius: "8px",
            boxShadow: "0 4px 8px rgba(0, 0, 0, 0.2)"
          }}
        >
          Registrarse
        </button>
        <p style={{ marginTop: "1rem", color: "var(--text-secondary)" }}>
          ¿Ya tienes una cuenta? <Link to="/login" style={{ color: "var(--primary-color)", textDecoration: "none" }}>Inicia sesión aquí</Link>
        </p>
      </div>

      {showRegisterModal && (
        <div className="modal-overlay" onClick={() => setShowRegisterModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
              <h2 style={{ margin: 0 }}>Crear Cuenta</h2>
              <button
                onClick={() => setShowRegisterModal(false)}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: "1.5rem",
                  cursor: "pointer",
                  color: "var(--text-secondary)"
                }}
              >
                ×
              </button>
            </div>
            
            {mensaje && (
              <div className={`message message-${mensaje.type}`} style={{
                marginBottom: "1rem",
                padding: "0.75rem",
                borderRadius: "4px",
                wordWrap: "break-word"
              }}>
                {mensaje.text}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="form-control">
                <input
                  className="input"
                  name="dni"
                  placeholder="DNI"
                  onChange={handleChange}
                  required
                  style={{ width: "100%", boxSizing: "border-box" }}
                />
              </div>

              <div className="form-control">
                <input
                  className="input"
                  name="nombre"
                  placeholder="Nombre"
                  onChange={handleChange}
                  required
                  style={{ width: "100%", boxSizing: "border-box" }}
                />
              </div>

              <div className="form-control">
                <input
                  className="input"
                  name="apellido"
                  placeholder="Apellido"
                  onChange={handleChange}
                  required
                  style={{ width: "100%", boxSizing: "border-box" }}
                />
              </div>

              <div className="form-control">
                <input
                  className="input"
                  name="email"
                  type="email"
                  placeholder="Email"
                  onChange={handleChange}
                  required
                  style={{ width: "100%", boxSizing: "border-box" }}
                />
              </div>

              <div className="form-control">
                <button
                  type="submit"
                  className={`button button-primary ${loading ? "button-loading" : ""}`}
                  style={{ 
                    width: "100%", 
                    boxSizing: "border-box",
                    minHeight: "44px"
                  }}
                  disabled={loading}
                >
                  {loading ? "Registrando..." : "Crear Cuenta"}
                </button>
              </div>
            </form>

            <div style={{ textAlign: "center", marginTop: "1rem", paddingTop: "1rem", borderTop: "1px solid #e0e0e0" }}>
              <p style={{ margin: "0 0 0.5rem 0", color: "var(--text-secondary)" }}>¿Ya tienes una cuenta?</p>
              <Link 
                to="/login" 
                className="button button-secondary" 
                style={{ 
                  textDecoration: "none",
                  display: "inline-block",
                  minHeight: "40px",
                  lineHeight: "40px",
                  boxSizing: "border-box"
                }}
              >
                Iniciar Sesión
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Register;