import { useCallback, useEffect, useMemo, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Menu, Sun, Moon, MonitorCog, ChevronDown, LogOut, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTema } from './TemaProvider';
import { navegacionParaRol } from './navegacion';
// Las primitivas van con el shell: toda pantalla del panel las tiene disponibles sin
// depender de que otra pantalla haya sido importada antes.
import '../styles/componentes.css';
import '../styles/panel.css';

const CLAVE_COLAPSADA = 'panel-sidebar-colapsada';

const ICONO_TEMA = { claro: Sun, oscuro: Moon, sistema: MonitorCog };
const ETIQUETA_TEMA = { claro: 'Tema claro', oscuro: 'Tema oscuro', sistema: 'Tema del sistema' };

function Sidebar({ colapsada, navegacion, abiertos, alternarGrupo }) {
  const { pathname } = useLocation();

  return (
    <nav className="panel-sidebar" aria-label="Navegación principal">
      {navegacion.map((grupo) => {
        const Icono = grupo.icono;

        // Un grupo sin submenú (Terminal) es un link directo.
        if (!grupo.items) {
          return (
            <NavLink
              key={grupo.id}
              to={grupo.ruta}
              end
              className={({ isActive }) => `panel-nav-item${isActive ? ' es-activo' : ''}`}
              title={colapsada ? grupo.etiqueta : undefined}
            >
              <Icono size={colapsada ? 20 : 16} aria-hidden />
              {!colapsada && <span>{grupo.etiqueta}</span>}
            </NavLink>
          );
        }

        const contieneRutaActiva = grupo.items.some((item) => pathname.startsWith(item.ruta));
        const abierto = abiertos[grupo.id] ?? contieneRutaActiva;

        return (
          <div key={grupo.id} className="panel-nav-grupo">
            <button
              type="button"
              className={`panel-nav-item${contieneRutaActiva ? ' contiene-activo' : ''}`}
              onClick={() => alternarGrupo(grupo.id, !abierto)}
              aria-expanded={abierto}
              title={colapsada ? grupo.etiqueta : undefined}
            >
              <Icono size={colapsada ? 20 : 16} aria-hidden />
              {!colapsada && (
                <>
                  <span>{grupo.etiqueta}</span>
                  <ChevronDown size={14} className={`panel-chevron${abierto ? ' abierto' : ''}`} aria-hidden />
                </>
              )}
              {/* En colapsado, un punto sobre el ícono avisa que la ruta activa está adentro:
                  sin él, el grupo activo sería indistinguible del resto. */}
              {colapsada && contieneRutaActiva && <span className="panel-punto-activo" aria-hidden />}
            </button>

            {!colapsada && abierto && (
              <div className="panel-nav-subitems">
                {grupo.items.map((item) => (
                  <NavLink
                    key={item.ruta}
                    to={item.ruta}
                    // `end`: sin esto, el ítem cuya ruta es prefijo de las demás queda marcado
                    // como activo junto con la pantalla real. Se veía en Configuración, donde
                    // "Empresa y facturación" (/admin/configuracion) se encendía al entrar a
                    // Cajas, Usuarios o Feriados, y el menú indicaba dos lugares a la vez.
                    end
                    className={({ isActive }) => `panel-nav-subitem${isActive ? ' es-activo' : ''}`}
                  >
                    {item.etiqueta}
                  </NavLink>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}

function Header({ colapsada, alternarSidebar, contexto }) {
  const { usuario, logout } = useAuth();
  const { tema, ciclarTema } = useTema();
  const IconoTema = ICONO_TEMA[tema];

  const { sucursal, caja, turno } = contexto;
  const duenio = turno?.operadorId;
  const operador = duenio?.nombre ? `${duenio.nombre} ${duenio.apellido ?? ''}`.trim() : null;

  return (
    <header className="panel-header">
      <button
        type="button"
        className="panel-icon-btn"
        onClick={alternarSidebar}
        aria-label={colapsada ? 'Expandir menú' : 'Colapsar menú'}
        aria-expanded={!colapsada}
      >
        <Menu size={18} aria-hidden />
      </button>

      {/* Estacionamiento · Caja · Turno como un bloque fijo y discreto, sin selector: la caja
          no se elige en cada operación. El estado del turno es información de primera línea
          —sin turno abierto no se puede cobrar— y el turno tiene dueño, así que se nombra. */}
      <div className="panel-contexto">
        <span>{sucursal}</span>
        {caja && <><span className="panel-sep">·</span><span>{caja.nombre}</span></>}
        <span className="panel-sep">·</span>
        <span className={`panel-turno${turno ? ' abierto' : ' cerrado'}`}>
          <span className="panel-turno-punto" aria-hidden />
          {turno ? `Turno #${turno.numero} abierto` : 'Sin turno abierto'}
        </span>
        {operador && <span className="panel-contexto-operador">{operador}</span>}
      </div>

      <div className="panel-header-acciones">
        <button
          type="button"
          className="panel-icon-btn"
          onClick={ciclarTema}
          aria-label={ETIQUETA_TEMA[tema]}
          title={ETIQUETA_TEMA[tema]}
        >
          <IconoTema size={18} aria-hidden />
        </button>

        <div className="panel-usuario">
          <User size={16} aria-hidden />
          <span>{usuario ? `${usuario.nombre} ${usuario.apellido}` : ''}</span>
        </div>

        <button type="button" className="panel-icon-btn" onClick={logout} aria-label="Cerrar sesión" title="Cerrar sesión">
          <LogOut size={18} aria-hidden />
        </button>
      </div>
    </header>
  );
}

// Shell del panel: header fijo arriba, sidebar como COLUMNA DEL GRID —no como overlay
// flotante—, contenido a la derecha. Al ser parte del layout, colapsar no superpone nada ni
// desalinea el contenido; solo cambia el ancho de la columna.
export default function AppShell({ contexto = {}, children }) {
  const { usuario } = useAuth();
  const [colapsada, setColapsada] = useState(() => {
    try { return localStorage.getItem(CLAVE_COLAPSADA) === '1'; } catch { return false; }
  });
  const [abiertos, setAbiertos] = useState({});

  const alternarSidebar = useCallback(() => {
    setColapsada((actual) => {
      const siguiente = !actual;
      try { localStorage.setItem(CLAVE_COLAPSADA, siguiente ? '1' : '0'); } catch { /* sin persistencia */ }
      return siguiente;
    });
  }, []);

  const alternarGrupo = useCallback((id, abierto) => {
    setAbiertos((actual) => ({ ...actual, [id]: abierto }));
  }, []);

  // `[` colapsa y expande. Se ignora mientras se escribe: el campo de patente tiene el foco
  // casi todo el tiempo y un atajo de una sola tecla se comería el tipeo.
  useEffect(() => {
    const alPresionar = (evento) => {
      if (evento.key !== '[' || evento.ctrlKey || evento.metaKey || evento.altKey) return;
      const activo = document.activeElement;
      const editando = activo && (activo.tagName === 'INPUT' || activo.tagName === 'TEXTAREA' || activo.isContentEditable);
      if (editando) return;
      evento.preventDefault();
      alternarSidebar();
    };
    window.addEventListener('keydown', alPresionar);
    return () => window.removeEventListener('keydown', alPresionar);
  }, [alternarSidebar]);

  const navegacion = useMemo(() => navegacionParaRol(usuario?.rol ?? 'operador'), [usuario?.rol]);

  const datosContexto = {
    sucursal: contexto.sucursal ?? 'Estacionamiento',
    caja: contexto.caja ?? null,
    turno: contexto.turno ?? null
  };

  return (
    <div className={`panel panel-shell${colapsada ? ' esta-colapsada' : ''}`}>
      <Header colapsada={colapsada} alternarSidebar={alternarSidebar} contexto={datosContexto} />
      <Sidebar colapsada={colapsada} navegacion={navegacion} abiertos={abiertos} alternarGrupo={alternarGrupo} />
      <main className="panel-contenido">{children}</main>
    </div>
  );
}
