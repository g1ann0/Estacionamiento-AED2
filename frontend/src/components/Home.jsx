import React from 'react';
import { Link } from 'react-router-dom';
import SEO from './SEO';
import '../styles/Home.css';

const Home = () => {
  return (
    <>
      <SEO 
        title="Inicio"
        description="Sistema digital de gestión de estacionamientos para universidades. Control eficiente de vehículos, pagos en línea y administración centralizada."
        keywords="estacionamiento universitario, gestión vehículos, control acceso, pagos digitales, software educativo"
        canonical="/"
      />
      
      <div className="home-container">
        {/* Animación de auto en el header */}
        <div className="hero-animation">
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
        
        <header className="home-header">
          <div className="container">
            <h1 className="home-title">
              Sistema de Gestión de Estacionamiento
            </h1>
            <p className="home-subtitle">
              Plataforma digital para el control eficiente de estacionamientos universitarios
            </p>
            <div className="home-actions">
              <Link to="/login" className="btn btn-primary">
                Iniciar Sesión
              </Link>
              <Link to="/registro" className="btn btn-secondary">
                Registrarse
              </Link>
            </div>
          </div>
        </header>

        <main className="home-main">
          <section className="features-section">
            <div className="container">
              <h2>Características Principales</h2>
              <div className="features-grid">
                <div className="feature-card vehicle-feature">
                  <div className="feature-icon vehicle-icon">
                    <div className="vehicle-animation">
                      <span className="vehicle-emoji">🚗</span>
                      <div className="vehicle-particles">
                        <span className="particle">💨</span>
                        <span className="particle">💨</span>
                        <span className="particle">💨</span>
                      </div>
                    </div>
                  </div>
                  <h3>Gestión de Vehículos</h3>
                  <p>Registro y administración completa de vehículos con validaciones automáticas de dominio.</p>
                </div>
                
                <div className="feature-card">
                  <div className="feature-icon">💳</div>
                  <h3>Pagos Digitales</h3>
                  <p>Sistema de comprobantes digitales con proceso de aprobación administrativo.</p>
                </div>
                
                <div className="feature-card">
                  <div className="feature-icon">📊</div>
                  <h3>Panel Administrativo</h3>
                  <p>Control completo con estadísticas, reportes y gestión de usuarios.</p>
                </div>
                
                <div className="feature-card">
                  <div className="feature-icon">🔒</div>
                  <h3>Seguridad Avanzada</h3>
                  <p>Autenticación JWT, roles de usuario y validaciones de seguridad.</p>
                </div>
              </div>
            </div>
          </section>

          <section className="how-it-works">
            <div className="container">
              <h2>¿Cómo Funciona?</h2>
              <div className="steps-grid">
                <div className="step">
                  <div className="step-number">1</div>
                  <h3>Registro</h3>
                  <p>Crea tu cuenta con datos personales y registra tus vehículos.</p>
                </div>
                
                <div className="step">
                  <div className="step-number">2</div>
                  <h3>Carga de Saldo</h3>
                  <p>Solicita comprobantes de pago para acreditar saldo en tu cuenta.</p>
                </div>
                
                <div className="step">
                  <div className="step-number">3</div>
                  <h3>Estacionamiento</h3>
                  <p>Inicia y finaliza estacionamientos desde cualquier portón de acceso.</p>
                </div>
              </div>
            </div>
          </section>

          <section className="benefits-section">
            <div className="container">
              <h2>Beneficios</h2>
              <div className="benefits-list">
                <div className="benefit">
                  <h3>Para Usuarios</h3>
                  <ul>
                    <li>Control total de gastos de estacionamiento</li>
                    <li>Historial completo de transacciones</li>
                    <li>Tarifas preferenciales para asociados</li>
                    <li>Proceso 100% digital</li>
                  </ul>
                </div>
                
                <div className="benefit">
                  <h3>Para Administradores</h3>
                  <ul>
                    <li>Gestión centralizada de usuarios</li>
                    <li>Reportes y estadísticas en tiempo real</li>
                    <li>Control de accesos por portones</li>
                    <li>Auditoría completa de operaciones</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>
        </main>

        <footer className="home-footer">
          <div className="container">
            <div className="footer-content">
              <div className="footer-section">
                <h4>Sistema de Estacionamiento</h4>
                <p>Desarrollado como proyecto académico para el Instituto Superior Juan XXIII</p>
              </div>
              
              <div className="footer-section">
                <h4>Enlaces</h4>
                <ul>
                  <li><Link to="/login">Iniciar Sesión</Link></li>
                  <li><Link to="/registro">Registrarse</Link></li>
                  <li><Link to="/how-it-works">Cómo Funciona</Link></li>
                </ul>
              </div>
              
              <div className="footer-section">
                <h4>Contacto</h4>
                <p>Desarrollador: Gian Castellino</p>
                <p>Institución: Instituto Superior Juan XXIII</p>
                <p>Año: 2025</p>
              </div>
            </div>
            
            <div className="footer-bottom">
              <p>&copy; 2025 Sistema de Estacionamiento. Proyecto Académico.</p>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
};

export default Home;
