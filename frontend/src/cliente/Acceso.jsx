import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SquareParking } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { entrar } from '../services/accesoService';
import SEO from '../components/SEO';
import '../styles/tokens.css';
import '../styles/cliente.css';

// LOGIN. El formulario es la página.
//
// Antes esta pantalla era una vidriera: título grande, cinco frases rotando, tres tarjetas de
// ilustraciones y, al final, un botón que abría un modal con los dos únicos campos que hacían
// falta. La tarea que la pantalla existe para resolver estaba escondida detrás de un clic y
// de una pared de decoración.
//
// Ahora: marca, dos campos, un botón. Lo demás es el enlace a registro y el de contraseña
// olvidada, que son las dos salidas reales de quien no puede entrar.
export default function Acceso() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [entrando, setEntrando] = useState(false);

  const navegar = useNavigate();
  const { login } = useAuth();

  const enviar = async (evento) => {
    evento.preventDefault();
    setEntrando(true);
    setError(null);
    try {
      // El token no vuelve a este código: el servidor abre la sesión con una cookie HttpOnly.
      // Acá solo queda quién entró, para saber a qué pantalla mandarlo y qué menú dibujar.
      const data = await entrar({ email, password });
      const usuario = { ...data.usuario, rol: data.usuario.rol || 'usuario' };
      login(usuario);
      navegar(usuario.rol === 'admin' || usuario.rol === 'operador' ? '/admin' : '/dashboard');
    } catch (fallo) {
      // El mensaje nombra el problema y la salida, no el stack.
      setError(fallo?.message || 'No pudimos conectarnos con el servidor. Revisá tu conexión y probá de nuevo.');
    } finally {
      setEntrando(false);
    }
  };

  return (
    <div className="cliente">
      <SEO
        title="Iniciar sesión"
        description="Entrá a tu cuenta para ver tus vehículos, tu saldo y el historial de tus estadías."
        canonical="/login"
      />

      <div className="acceso">
        <div className="acceso-caja">
          <Link to="/" className="acceso-marca">
            <SquareParking size={26} aria-hidden />
            <span>Estacionamiento</span>
          </Link>

          <div>
            <h1 className="cliente-titulo">Entrá a tu cuenta</h1>
            <p className="cliente-bajada">Para ver tus vehículos, tu saldo y tus estadías.</p>
          </div>

          {error && <p className="cliente-error" role="alert">{error}</p>}

          <form className="acceso-formulario" onSubmit={enviar}>
            <label className="cliente-campo">
              <span>Correo</span>
              <input
                className="cliente-control"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vos@correo.com"
                autoComplete="email"
                disabled={entrando}
                required
                autoFocus
              />
            </label>

            <label className="cliente-campo">
              <span>Contraseña</span>
              <input
                className="cliente-control"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                disabled={entrando}
                required
              />
            </label>

            <Link className="cliente-enlace acceso-olvide" to="/olvide-password">
              ¿Olvidaste tu contraseña?
            </Link>

            <button type="submit" className="cliente-boton" disabled={entrando}>
              {entrando ? 'Entrando…' : 'Entrar'}
            </button>
          </form>

          <p className="acceso-pie">
            ¿Todavía no tenés cuenta? <Link className="cliente-enlace" to="/registro">Creá una</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
