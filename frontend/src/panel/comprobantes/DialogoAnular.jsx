import { useEffect, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';

// ANULAR UN COMPROBANTE.
//
// Las dos mitades de esta pantalla son dos operaciones distintas y el operador tiene que saber
// cuál está por hacer:
//
//   con CAE  → ARCA ya autorizó, y una autorización no se deshace. Anular significa EMITIR una
//              nota de crédito: otro comprobante fiscal, con su propio CAE y su propio número,
//              que queda en el libro de IVA para siempre.
//   sin CAE  → el comprobante nunca llegó a ARCA. Se da de baja y no hay nada más.
//
// El motivo es obligatorio porque es lo único que, meses después, explica por qué hay una nota
// de crédito ahí.
export default function DialogoAnular({ abierto, comprobante, anulando, error, onAnular, onCerrar }) {
  const dialogo = useRef(null);
  const [motivo, setMotivo] = useState('');

  useEffect(() => {
    const elemento = dialogo.current;
    if (!elemento) return;
    if (abierto && !elemento.open) {
      setMotivo('');
      elemento.showModal();
    }
    if (!abierto && elemento.open) elemento.close();
  }, [abierto]);

  const esFiscal = Boolean(comprobante?.cae);

  const enviar = (evento) => {
    evento.preventDefault();
    if (motivo.trim().length < 5) return;
    onAnular(motivo.trim());
  };

  const numero = comprobante
    ? `${comprobante.puntoVenta}-${String(comprobante.numero).padStart(8, '0')}`
    : '';

  return (
    <dialog ref={dialogo} className="dialogo" onCancel={onCerrar} onClose={onCerrar} aria-labelledby="dialogo-anular-titulo">
      <form className="dialogo-cuerpo" onSubmit={enviar}>
        <h2 id="dialogo-anular-titulo" className="dialogo-titulo">Anular comprobante {numero}</h2>

        {error && <p className="mensaje-error" role="alert">{error}</p>}

        {esFiscal ? (
          <p className="dialogo-advertencia">
            <AlertTriangle size={15} aria-hidden />
            <span>
              Este comprobante ya está autorizado por ARCA, y una autorización no se deshace.
              Anularlo <strong>emite una nota de crédito</strong> por {' '}
              <span className="numerico">
                ${Number(comprobante?.total ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </span>: un comprobante fiscal nuevo, con su propio CAE, que queda en el libro de IVA.
            </span>
          </p>
        ) : (
          <p className="dialogo-nota">
            Este comprobante todavía no llegó a ARCA, así que no hace falta ninguna nota de crédito:
            se da de baja y sale de la cola de emisión.
          </p>
        )}

        <label className="campo">
          <span>Motivo</span>
          <input
            className="control"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Cobro duplicado en la salida"
            minLength={5}
            disabled={anulando}
            required
            autoFocus
          />
          <em>Queda escrito en el comprobante y en la auditoría. Es lo que explica la anulación después.</em>
        </label>

        <div className="dialogo-acciones">
          <button type="button" className="boton-secundario" onClick={onCerrar} disabled={anulando}>
            Cancelar <kbd>Esc</kbd>
          </button>
          <button type="submit" className="boton-peligro" disabled={anulando || motivo.trim().length < 5}>
            {anulando ? 'Anulando…' : esFiscal ? 'Anular y emitir nota de crédito' : 'Anular'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
