import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  validarTokenRecuperacion,
  restablecerPassword,
  confirmarCuenta,
  setearPassword
} from '../services/accesoService';
import Marco from './Marco';

const MINIMO = 6;

// La pantalla a la que llega el enlace del correo, en sus dos versiones:
//
//   modo="recuperar"  el usuario olvidó su contraseña y pidió una nueva
//   modo="verificar"  el usuario acaba de registrarse y elige la primera
//
// Son el mismo trabajo —validar un token y elegir una contraseña— con distinto texto y
// distinto endpoint, así que comparten componente en vez de duplicarse. Lo que NO comparten
// es el mensaje: quien verifica su cuenta no "recupera" nada.
export default function NuevaContrasena({ modo = 'recuperar' }) {
  const [parametros] = useSearchParams();
  const token = parametros.get('token');
  const navegar = useNavigate();

  const [validando, setValidando] = useState(true);
  const [tokenValido, setTokenValido] = useState(false);
  const [dni, setDni] = useState('');
  const [correo, setCorreo] = useState('');

  const [password, setPassword] = useState('');
  const [repetida, setRepetida] = useState('');
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [listo, setListo] = useState(false);

  const esVerificacion = modo === 'verificar';

  const validar = useCallback(async () => {
    if (!token) {
      setValidando(false);
      return;
    }
    try {
      const datos = esVerificacion ? await confirmarCuenta(token) : await validarTokenRecuperacion(token);
      if (datos.dni) setDni(datos.dni);
      if (datos.email) setCorreo(datos.email);
      setTokenValido(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setValidando(false);
    }
  }, [token, esVerificacion]);

  useEffect(() => { validar(); }, [validar]);

  const enviar = async (evento) => {
    evento.preventDefault();
    if (password.length < MINIMO) {
      setError(`La contraseña tiene que tener al menos ${MINIMO} caracteres.`);
      return;
    }
    if (password !== repetida) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setGuardando(true);
    setError(null);
    try {
      if (esVerificacion) {
        await setearPassword({ dni, password, token });
      } else {
        await restablecerPassword({ token, nuevaPassword: password });
      }
      setListo(true);
      setTimeout(() => navegar('/login'), 2500);
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  };

  if (validando) {
    return (
      <Marco titulo="Verificando el enlace…" seo={{ title: 'Contraseña' }}>
        <p className="cliente-bajada">Un segundo.</p>
      </Marco>
    );
  }

  // Un enlace vencido no es un error del usuario: la salida es pedir uno nuevo, y está acá.
  if (!token || !tokenValido) {
    return (
      <Marco
        titulo="Este enlace ya no sirve"
        bajada={error ?? 'Puede haber vencido o haberse usado antes. Pedí uno nuevo y probá otra vez.'}
        seo={{ title: 'Enlace vencido' }}
        pie={<Link className="cliente-enlace" to="/login">Volver a entrar</Link>}
      >
        <Link className="cliente-boton" to="/olvide-password">Pedir un enlace nuevo</Link>
      </Marco>
    );
  }

  if (listo) {
    return (
      <Marco
        titulo={esVerificacion ? 'Tu cuenta quedó lista' : 'Contraseña cambiada'}
        bajada="Te llevamos a la pantalla de ingreso."
        seo={{ title: 'Listo' }}
      >
        <Link className="cliente-boton" to="/login">Entrar ahora</Link>
      </Marco>
    );
  }

  return (
    <Marco
      titulo={esVerificacion ? 'Elegí tu contraseña' : 'Elegí una contraseña nueva'}
      bajada={correo ? `Para la cuenta de ${correo}.` : undefined}
      seo={{ title: esVerificacion ? 'Activar cuenta' : 'Nueva contraseña' }}
    >
      {error && <p className="cliente-error" role="alert">{error}</p>}

      <form className="acceso-formulario" onSubmit={enviar}>
        <label className="cliente-campo">
          <span>Contraseña</span>
          <input
            className="cliente-control"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            disabled={guardando}
            required
            autoFocus
          />
          <em>Mínimo {MINIMO} caracteres.</em>
        </label>

        <label className="cliente-campo">
          <span>Repetila</span>
          <input
            className="cliente-control"
            type="password"
            value={repetida}
            onChange={(e) => setRepetida(e.target.value)}
            autoComplete="new-password"
            disabled={guardando}
            required
          />
        </label>

        <button type="submit" className="cliente-boton" disabled={guardando}>
          {guardando ? 'Guardando…' : (esVerificacion ? 'Activar mi cuenta' : 'Cambiar contraseña')}
        </button>
      </form>
    </Marco>
  );
}
