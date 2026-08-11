import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MailCheck } from 'lucide-react';
import { solicitarRecuperacion } from '../services/accesoService';
import Marco from './Marco';

// "Olvidé mi contraseña". Un campo.
//
// La respuesta es siempre la misma, exista o no la cuenta: si la pantalla dijera "ese correo
// no está registrado", cualquiera podría averiguar quién tiene cuenta acá probando
// direcciones. El backend ya responde así; la interfaz no lo contradice.
export default function OlvideContrasena() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  const enviar = async (evento) => {
    evento.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      await solicitarRecuperacion(email);
      setEnviado(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setEnviando(false);
    }
  };

  if (enviado) {
    return (
      <Marco
        titulo="Revisá tu correo"
        bajada={`Si ${email} tiene una cuenta, le mandamos un enlace para elegir una contraseña nueva. El enlace vence en una hora.`}
        seo={{ title: 'Recuperar contraseña', canonical: '/olvide-password' }}
        pie={<Link className="cliente-enlace" to="/login">Volver a entrar</Link>}
      >
        <p className="acceso-confirmacion">
          <MailCheck size={20} aria-hidden />
          Enlace enviado
        </p>
      </Marco>
    );
  }

  return (
    <Marco
      titulo="Recuperar tu contraseña"
      bajada="Escribí tu correo y te mandamos un enlace para elegir una nueva."
      seo={{ title: 'Recuperar contraseña', canonical: '/olvide-password' }}
      pie={<>¿Te acordaste? <Link className="cliente-enlace" to="/login">Entrá</Link></>}
    >
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
            disabled={enviando}
            required
            autoFocus
          />
        </label>

        <button type="submit" className="cliente-boton" disabled={enviando}>
          {enviando ? 'Enviando…' : 'Enviarme el enlace'}
        </button>
      </form>
    </Marco>
  );
}
