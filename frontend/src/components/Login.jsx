import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import CONFIG from "../config/config.js";
import SEO from "./SEO";
import "../styles/theme.css";
import "../styles/animations.css";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mensaje, setMensaje] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${CONFIG.API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (res.ok) {
        const usuarioConRol = {
          ...data.usuario,
          rol: data.usuario.rol || "usuario"
        };
        
        login(data.token, usuarioConRol);
        setMensaje({ type: "success", text: "Inicio de sesión exitoso" });
        
        if (usuarioConRol.rol === "admin") {
          navigate("/admin");
        } else {
          navigate("/dashboard");
        }
      } else {
        setMensaje({ type: "error", text: data.mensaje || "Error en login" });
      }
    } catch (error) {
      console.error("Error al conectar:", error);
      setMensaje({ type: "error", text: "Error al conectar con el servidor" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <SEO 
        title="Iniciar Sesión - Sistema de Gestión de Estacionamiento"
        description="Accede a tu cuenta del sistema de gestión de estacionamiento. Controla tu saldo, historial de transacciones y gestiona tu cuenta de forma segura."
        keywords="login, iniciar sesión, estacionamiento, cuenta, acceso"
        canonical="/login"
      />
      
      <h1 className="parking-title">Estacionamiento Seguro</h1>
      
      <div className="parking-header">
        <div className="parking-carousel">
          <p className="carousel-phrase">Tu vehículo en las mejores manos</p>
          <p className="carousel-phrase">Tecnología de punta para tu tranquilidad</p>
          <p className="carousel-phrase">Vigilancia 24/7 con seguridad garantizada</p>
          <p className="carousel-phrase">Pagos digitales rápidos y seguros</p>
          <p className="carousel-phrase">Control total desde tu smartphone</p>
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
          <h3 className="feature-title">Seguridad 24/7</h3>
          <p className="feature-description">Vigilancia continua</p>
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
          <h3 className="feature-title">Pagos Digitales</h3>
          <p className="feature-description">Sistema automatizado</p>
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
          <h3 className="feature-title">Control Total</h3>
          <p className="feature-description">Desde tu móvil</p>
        </div>
      </div>

      <div style={{ textAlign: "center", marginTop: "2rem" }}>
        <button
          onClick={() => setShowLoginModal(true)}
          className="button button-primary"
          style={{
            fontSize: "1.2rem",
            padding: "1rem 2rem",
            borderRadius: "8px",
            boxShadow: "0 4px 8px rgba(0, 0, 0, 0.2)"
          }}
        >
          Iniciar Sesión
        </button>
        <p style={{ marginTop: "1rem", color: "var(--text-secondary)" }}>
          ¿No tienes una cuenta? <Link to="/registro" style={{ color: "var(--primary-color)", textDecoration: "none" }}>Regístrate aquí</Link>
        </p>
      </div>

      {showLoginModal && (
        <div className="modal-overlay" onClick={() => setShowLoginModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
              <h2 style={{ margin: 0 }}>Iniciar Sesión</h2>
              <button
                onClick={() => setShowLoginModal(false)}
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
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email"
                  type="email"
                  required
                  style={{ width: "100%", boxSizing: "border-box" }}
                />
              </div>
              
              <div className="form-control">
                <input
                  className="input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Contraseña"
                  required
                  style={{ width: "100%", boxSizing: "border-box" }}
                />
              </div>

              <div style={{ textAlign: "right", marginBottom: "1rem" }}>
                <Link 
                  to="/olvide-password" 
                  style={{ 
                    color: "var(--primary-color)", 
                    textDecoration: "none", 
                    fontSize: "14px"
                  }}
                >
                  ¿Olvidaste tu contraseña?
                </Link>
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
                  {loading ? "Iniciando sesión..." : "Iniciar Sesión"}
                </button>
              </div>
            </form>

            <div style={{ textAlign: "center", marginTop: "1rem", paddingTop: "1rem", borderTop: "1px solid #e0e0e0" }}>
              <p style={{ margin: "0 0 0.5rem 0", color: "var(--text-secondary)" }}>¿No tienes una cuenta?</p>
              <Link 
                to="/registro" 
                className="button button-secondary" 
                style={{ 
                  textDecoration: "none",
                  display: "inline-block",
                  minHeight: "40px",
                  lineHeight: "40px",
                  boxSizing: "border-box"
                }}
              >
                Registrarse
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Login;
