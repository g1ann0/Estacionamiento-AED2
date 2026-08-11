import { useEffect, useRef, useState } from 'react';

// Envío del comprobante por mail. El cliente registrado ya tiene dirección y el campo llega
// completo; el ocasional no tiene cuenta ni mail, así que hay que escribirlo. Es la misma
// pantalla para los dos casos, con el dato ya puesto cuando existe.
export default function DialogoEnviar({ abierto, comprobante, emailSugerido, enviando, error, onEnviar, onCerrar }) {
  const dialogo = useRef(null);
  const [email, setEmail] = useState('');

  useEffect(() => {
    const elemento = dialogo.current;
    if (!elemento) return;
    if (abierto && !elemento.open) {
      setEmail(emailSugerido ?? '');
      elemento.showModal();
    }
    if (!abierto && elemento.open) elemento.close();
  }, [abierto, emailSugerido]);

  const enviar = (evento) => {
    evento.preventDefault();
    if (!email.trim()) return;
    onEnviar(email.trim());
  };

  return (
    <dialog ref={dialogo} className="dialogo" onCancel={onCerrar} onClose={onCerrar} aria-labelledby="dialogo-enviar-titulo">
      <form className="dialogo-cuerpo" onSubmit={enviar}>
        <h2 id="dialogo-enviar-titulo" className="dialogo-titulo">Enviar comprobante {comprobante}</h2>

        {error && <p className="mensaje-error" role="alert">{error}</p>}

        <label className="campo">
          <span>Correo del cliente</span>
          <input
            className="control"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="cliente@correo.com"
            disabled={enviando}
            required
            autoFocus
          />
          <em>Va el PDF adjunto. El envío queda registrado en la auditoría.</em>
        </label>

        <div className="dialogo-acciones">
          <button type="button" className="boton-secundario" onClick={onCerrar} disabled={enviando}>
            Cancelar <kbd>Esc</kbd>
          </button>
          <button type="submit" className="boton-primario" disabled={enviando}>
            {enviando ? 'Enviando…' : 'Enviar'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
