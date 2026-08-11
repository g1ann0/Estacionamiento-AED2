import { useCallback, useEffect, useState } from 'react';
import { miPerfil, actualizarDatosBasicos, cambiarContrasena } from '../services/conductorService';
import { fecha } from '../panel/formato';
import '../styles/panelConductor.css';

// PERFIL. Dos tareas distintas, separadas: cambiar cómo te llamás y cambiar tu contraseña.
// El correo y el DNI se muestran pero no se editan — son la identidad con la que el sistema
// te reconoce y cambiarlos no es un campo de formulario, es un trámite.
export default function Perfil() {
  const [perfil, setPerfil] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [aviso, setAviso] = useState(null);

  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [guardandoDatos, setGuardandoDatos] = useState(false);

  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [repetida, setRepetida] = useState('');
  const [cambiando, setCambiando] = useState(false);
  const [errorClave, setErrorClave] = useState(null);

  const cargar = useCallback(async () => {
    try {
      const datos = await miPerfil();
      const usuario = datos.usuario ?? datos;
      setPerfil(usuario);
      setNombre(usuario.nombre ?? '');
      setApellido(usuario.apellido ?? '');
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const guardarDatos = async (evento) => {
    evento.preventDefault();
    setGuardandoDatos(true);
    setError(null);
    try {
      await actualizarDatosBasicos({ nombre: nombre.trim(), apellido: apellido.trim() });
      setAviso('Tus datos quedaron guardados');
      await cargar();
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardandoDatos(false);
    }
  };

  const guardarClave = async (evento) => {
    evento.preventDefault();
    // La confirmación se valida acá y no en el servidor: es un error de tipeo, no una regla
    // de negocio, y el usuario tiene que enterarse sin esperar una respuesta.
    if (nueva !== repetida) {
      setErrorClave('Las contraseñas nuevas no coinciden.');
      return;
    }
    setCambiando(true);
    setErrorClave(null);
    try {
      await cambiarContrasena({ contrasenaActual: actual, nuevaContrasena: nueva });
      setAviso('Tu contraseña quedó cambiada');
      setActual('');
      setNueva('');
      setRepetida('');
    } catch (e) {
      setErrorClave(e.message);
    } finally {
      setCambiando(false);
    }
  };

  if (cargando) return <p className="conductor-cargando">Cargando tu perfil…</p>;

  return (
    <div className="conductor">
      {aviso && <p className="cliente-exito" role="status">{aviso}</p>}
      {error && <p className="cliente-error" role="alert">{error}</p>}

      <h1 className="cliente-titulo">Tu perfil</h1>

      {perfil && (
        <dl className="perfil-identidad">
          <div>
            <dt>Correo</dt>
            <dd>{perfil.email}</dd>
          </div>
          <div>
            <dt>DNI</dt>
            <dd className="numerico">{perfil.dni}</dd>
          </div>
          {perfil.fechaRegistro && (
            <div>
              <dt>Cliente desde</dt>
              <dd className="numerico">{fecha(perfil.fechaRegistro)}</dd>
            </div>
          )}
          {perfil.asociado && (
            <div>
              <dt>Condición</dt>
              <dd>Asociado — se te cobra la tarifa preferencial</dd>
            </div>
          )}
        </dl>
      )}

      <section aria-label="Tus datos">
        <h2 className="conductor-seccion-titulo">Tus datos</h2>
        <form className="perfil-formulario" onSubmit={guardarDatos}>
          <label className="cliente-campo">
            <span>Nombre</span>
            <input className="cliente-control" value={nombre} onChange={(e) => setNombre(e.target.value)} disabled={guardandoDatos} required />
          </label>
          <label className="cliente-campo">
            <span>Apellido</span>
            <input className="cliente-control" value={apellido} onChange={(e) => setApellido(e.target.value)} disabled={guardandoDatos} required />
          </label>
          <button type="submit" className="cliente-boton" disabled={guardandoDatos}>
            {guardandoDatos ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </form>
      </section>

      <section aria-label="Tu contraseña">
        <h2 className="conductor-seccion-titulo">Tu contraseña</h2>
        <form className="perfil-formulario" onSubmit={guardarClave}>
          {errorClave && <p className="cliente-error" role="alert">{errorClave}</p>}

          <label className="cliente-campo">
            <span>Contraseña actual</span>
            <input
              className="cliente-control"
              type="password"
              value={actual}
              onChange={(e) => setActual(e.target.value)}
              autoComplete="current-password"
              disabled={cambiando}
              required
            />
          </label>
          <label className="cliente-campo">
            <span>Contraseña nueva</span>
            <input
              className="cliente-control"
              type="password"
              value={nueva}
              onChange={(e) => setNueva(e.target.value)}
              autoComplete="new-password"
              disabled={cambiando}
              required
            />
          </label>
          <label className="cliente-campo">
            <span>Repetí la nueva</span>
            <input
              className="cliente-control"
              type="password"
              value={repetida}
              onChange={(e) => setRepetida(e.target.value)}
              autoComplete="new-password"
              disabled={cambiando}
              required
            />
          </label>
          <button type="submit" className="cliente-boton cliente-boton-secundario" disabled={cambiando}>
            {cambiando ? 'Cambiando…' : 'Cambiar contraseña'}
          </button>
        </form>
      </section>
    </div>
  );
}
