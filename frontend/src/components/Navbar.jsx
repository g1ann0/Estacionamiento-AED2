import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../styles/theme.css';

function Navbar() {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();
  const [menuAbierto, setMenuAbierto] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
    setMenuAbierto(false);
  };

  const navegarA = (ruta) => {
    navigate(ruta);
    setMenuAbierto(false);
  };

  const toggleMenu = () => {
    setMenuAbierto(!menuAbierto);
  };

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <h1>Estacionamiento Seguro</h1>
      </div>
      
      {usuario && (
        <div className="navbar-menu">
          {/* Botón de logout directo para móvil */}
          <button 
            className="mobile-logout-btn"
            onClick={handleLogout}
            title="Cerrar Sesión"
          >
            🚪
          </button>

          {/* Botón hamburguesa */}
          <button 
            className={`hamburger-btn ${menuAbierto ? 'active' : ''}`}
            onClick={toggleMenu}
            aria-label="Abrir menú"
          >
            <span></span>
            <span></span>
            <span></span>
          </button>

          {/* Overlay para cerrar el menú al hacer clic fuera */}
          {menuAbierto && (
            <div 
              className="menu-overlay" 
              onClick={() => setMenuAbierto(false)}
            ></div>
          )}

          {/* Menú desplegable */}
          <div className={`dropdown-menu ${menuAbierto ? 'active' : ''}`}>
            <div className="menu-header">
              <div className="user-avatar">
                <span>{usuario.nombre.charAt(0)}{usuario.apellido.charAt(0)}</span>
              </div>
              <div className="user-details">
                <h3>{usuario.nombre} {usuario.apellido}</h3>
                <p>{usuario.rol === 'admin' ? 'Administrador' : 'Usuario'}</p>
              </div>
            </div>

            <div className="menu-items">
              {usuario.rol === 'admin' ? (
                <>
                  <button
                    onClick={() => navegarA('/admin')}
                    className="menu-item"
                  >
                    <span className="menu-icon">🏠</span>
                    <span>Panel Principal</span>
                  </button>
                  
                  <button
                    onClick={() => navegarA('/admin/gestion')}
                    className="menu-item"
                  >
                    <span className="menu-icon">📋</span>
                    <span>Gestión Completa</span>
                  </button>
                  
                  <button
                    onClick={() => navegarA('/admin/listados')}
                    className="menu-item"
                  >
                    <span className="menu-icon">📊</span>
                    <span>Listados</span>
                  </button>
                  
                  <button
                    onClick={() => navegarA('/admin/transacciones')}
                    className="menu-item"
                  >
                    <span className="menu-icon">💳</span>
                    <span>Control Transacciones</span>
                  </button>

                  <div className="menu-divider"></div>
                  
                  <button
                    onClick={() => navegarA('/admin/configuracion')}
                    className="menu-item"
                  >
                    <span className="menu-icon">⚙️</span>
                    <span>Configuración Empresa</span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => navegarA('/dashboard')}
                    className="menu-item"
                  >
                    <span className="menu-icon">🏠</span>
                    <span>Inicio</span>
                  </button>
                  
                  <button
                    onClick={() => navegarA('/historial')}
                    className="menu-item"
                  >
                    <span className="menu-icon">📚</span>
                    <span>Historial</span>
                  </button>
                  
                  <div className="menu-divider"></div>
                  
                  <button
                    onClick={() => navegarA('/perfil')}
                    className="menu-item"
                  >
                    <span className="menu-icon">👤</span>
                    <span>Mi Perfil</span>
                  </button>
                </>
              )}
            </div>

            <div className="menu-footer">
              <button
                onClick={handleLogout}
                className="menu-item logout-btn"
              >
                <span className="menu-icon">🚪</span>
                <span>Cerrar Sesión</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}

export default Navbar;