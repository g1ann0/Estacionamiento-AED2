import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { SquareParking, Car, Clock, User, LogOut, Sun, Moon, MonitorCog } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTema } from '../panel/TemaProvider';
import '../styles/tokens.css';
import '../styles/cliente.css';

const ICONO_TEMA = { claro: Sun, oscuro: Moon, sistema: MonitorCog };
const ETIQUETA_TEMA = { claro: 'Tema claro', oscuro: 'Tema oscuro', sistema: 'Tema del sistema' };

const SECCIONES = [
  { ruta: '/dashboard', etiqueta: 'Inicio', icono: Car },
  { ruta: '/historial', etiqueta: 'Historial', icono: Clock },
  { ruta: '/perfil', etiqueta: 'Perfil', icono: User }
];

// Shell de la app del conductor. Tres secciones, navegación abajo: en un celular el pulgar
// llega al borde inferior y no al superior, y son tres destinos fijos — no hay jerarquía que
// justifique un menú lateral como el del panel.
export default function ClienteLayout() {
  const { usuario, logout } = useAuth();
  const { tema, ciclarTema } = useTema();
  const navegar = useNavigate();
  const IconoTema = ICONO_TEMA[tema];

  const salir = () => {
    logout();
    navegar('/');
  };

  return (
    <div className="cliente">
      <div className="cliente-shell">
        <header className="cliente-header">
          <span className="cliente-marca">
            <SquareParking size={22} aria-hidden />
            Estacionamiento
          </span>

          <div className="cliente-header-acciones">
            <button type="button" className="cliente-icon-btn" onClick={ciclarTema} aria-label={ETIQUETA_TEMA[tema]} title={ETIQUETA_TEMA[tema]}>
              <IconoTema size={20} aria-hidden />
            </button>
            <button type="button" className="cliente-icon-btn" onClick={salir} aria-label="Cerrar sesión" title="Cerrar sesión">
              <LogOut size={20} aria-hidden />
            </button>
          </div>
        </header>

        <main className="cliente-contenido">
          <Outlet context={{ usuario }} />
        </main>

        <nav className="cliente-nav" aria-label="Secciones">
          {SECCIONES.map(({ ruta, etiqueta, icono: Icono }) => (
            <NavLink
              key={ruta}
              to={ruta}
              className={({ isActive }) => `cliente-nav-item${isActive ? ' es-activo' : ''}`}
            >
              <Icono size={20} aria-hidden />
              {etiqueta}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}
