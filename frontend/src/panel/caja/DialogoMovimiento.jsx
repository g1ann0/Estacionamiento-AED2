import { useEffect, useRef, useState } from 'react';
import { ETIQUETA_MEDIO_LARGA } from '../formato';

const MEDIOS = ['efectivo', 'tarjeta', 'qr_transferencia', 'saldo_prepago'];

// Movimiento manual de caja: es la única tarea del panel que sí merece interrumpir —el
// operador para de cobrar para sacar plata del cajón— y necesita foco protegido, así que va
// en un <dialog> nativo: Esc, foco atrapado y fondo inerte sin librería ni JavaScript propio.
//
// El motivo es obligatorio y el backend lo exige también: un egreso sin motivo aparece en el
// arqueo como una diferencia sin explicación, que es exactamente lo que este sistema existe
// para evitar.
export default function DialogoMovimiento({ abierto, guardando, error, onGuardar, onCerrar }) {
  const dialogo = useRef(null);
  const [tipo, setTipo] = useState('egreso');
  const [medioPago, setMedioPago] = useState('efectivo');
  const [monto, setMonto] = useState('');
  const [motivo, setMotivo] = useState('');

  useEffect(() => {
    const elemento = dialogo.current;
    if (!elemento) return;
    if (abierto && !elemento.open) {
      setTipo('egreso');
      setMedioPago('efectivo');
      setMonto('');
      setMotivo('');
      elemento.showModal();
    }
    if (!abierto && elemento.open) elemento.close();
  }, [abierto]);

  const enviar = (evento) => {
    evento.preventDefault();
    const valor = parseFloat(monto);
    if (!Number.isFinite(valor) || valor <= 0) return;
    if (!motivo.trim()) return;
    onGuardar({ tipo, medioPago, monto: valor, motivo: motivo.trim() });
  };

  return (
    <dialog ref={dialogo} className="dialogo" onCancel={onCerrar} onClose={onCerrar} aria-labelledby="dialogo-mov-titulo">
      <form className="dialogo-cuerpo" onSubmit={enviar}>
        <h2 id="dialogo-mov-titulo" className="dialogo-titulo">Movimiento manual de caja</h2>

        {error && <p className="mensaje-error" role="alert">{error}</p>}

        <fieldset className="campo-grupo" disabled={guardando}>
          <legend>Tipo</legend>
          <div className="segmentado" role="group">
            <button
              type="button"
              className={`segmento${tipo === 'ingreso' ? ' es-activo' : ''}`}
              onClick={() => setTipo('ingreso')}
              aria-pressed={tipo === 'ingreso'}
            >
              Ingreso
            </button>
            <button
              type="button"
              className={`segmento${tipo === 'egreso' ? ' es-activo' : ''}`}
              onClick={() => setTipo('egreso')}
              aria-pressed={tipo === 'egreso'}
            >
              Egreso
            </button>
          </div>
        </fieldset>

        <label className="campo">
          <span>Medio</span>
          <select className="control" value={medioPago} onChange={(e) => setMedioPago(e.target.value)} disabled={guardando}>
            {MEDIOS.map((medio) => (
              <option key={medio} value={medio}>{ETIQUETA_MEDIO_LARGA[medio]}</option>
            ))}
          </select>
        </label>

        <label className="campo">
          <span>Monto</span>
          <input
            className="control numerico"
            type="number"
            min="1"
            step="1"
            inputMode="numeric"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            disabled={guardando}
            required
          />
        </label>

        <label className="campo">
          <span>Motivo</span>
          <input
            className="control"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ej: cambio para el turno siguiente"
            disabled={guardando}
            required
          />
          <em>Queda en el arqueo y en la auditoría.</em>
        </label>

        <div className="dialogo-acciones">
          <button type="button" className="boton-secundario" onClick={onCerrar} disabled={guardando}>
            Cancelar <kbd>Esc</kbd>
          </button>
          <button type="submit" className="boton-primario" disabled={guardando}>
            {guardando ? 'Registrando…' : 'Registrar movimiento'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
