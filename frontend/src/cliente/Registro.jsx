import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MailCheck } from 'lucide-react';
import { registrar } from '../services/accesoService';
import Marco from './Marco';

// REGISTRO. Cuatro datos y un correo de verificación.
//
// La contraseña no se pide acá: el alta manda un mail y la contraseña se establece desde ese
// enlace. Pedirla antes de saber si el correo existe sería pedir un dato que puede no servir
// para nada.
//
// La pantalla anterior también escondía este formulario detrás de un botón que abría un
// modal, igual que el login.
export default function Registro() {
  const [form, setForm] = useState({ dni: '', nombre: '', apellido: '', email: '' });
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [listo, setListo] = useState(false);

  const campo = (clave) => ({
    value: form[clave],
    disabled: enviando,
    onChange: (e) => setForm((actual) => ({ ...actual, [clave]: e.target.value }))
  });

  const enviar = async (evento) => {
    evento.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      await registrar(form);
      setListo(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setEnviando(false);
    }
  };

  // Después de registrarse, la pantalla no vuelve al formulario: dice qué pasó y qué sigue.
  // El siguiente paso está en el correo, no acá.
  if (listo) {
    return (
      <Marco
        titulo="Revisá tu correo"
        bajada={`Le mandamos un enlace a ${form.email}. Desde ahí vas a elegir tu contraseña y tu cuenta queda lista.`}
        seo={{ title: 'Cuenta creada', canonical: '/registro' }}
        pie={<>¿No te llegó? Fijate en spam, o <Link className="cliente-enlace" to="/registro" onClick={() => setListo(false)}>probá con otro correo</Link>.</>}
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
      titulo="Creá tu cuenta"
      bajada="Con estos datos la playa reconoce tus vehículos por la patente."
      seo={{
        title: 'Crear cuenta',
        description: 'Creá tu cuenta para registrar tus vehículos y ver el historial de tus estadías.',
        canonical: '/registro'
      }}
      pie={<>¿Ya tenés cuenta? <Link className="cliente-enlace" to="/login">Entrá</Link></>}
    >
      {error && <p className="cliente-error" role="alert">{error}</p>}

      <form className="acceso-formulario" onSubmit={enviar}>
        <label className="cliente-campo">
          <span>DNI</span>
          <input className="cliente-control numerico" inputMode="numeric" {...campo('dni')} required autoFocus />
        </label>

        <label className="cliente-campo">
          <span>Nombre</span>
          <input className="cliente-control" autoComplete="given-name" {...campo('nombre')} required />
        </label>

        <label className="cliente-campo">
          <span>Apellido</span>
          <input className="cliente-control" autoComplete="family-name" {...campo('apellido')} required />
        </label>

        <label className="cliente-campo">
          <span>Correo</span>
          <input className="cliente-control" type="email" autoComplete="email" placeholder="vos@correo.com" {...campo('email')} required />
          <em>Te mandamos un enlace para elegir tu contraseña.</em>
        </label>

        <button type="submit" className="cliente-boton" disabled={enviando}>
          {enviando ? 'Creando…' : 'Crear cuenta'}
        </button>
      </form>
    </Marco>
  );
}
