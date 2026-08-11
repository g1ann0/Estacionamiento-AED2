import { useEffect, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';

const ETIQUETA_MEDIO = { efectivo: 'Efectivo', tarjeta: 'Tarjeta', qr_transferencia: 'QR' };
const MEDIOS = ['efectivo', 'tarjeta', 'qr_transferencia'];

const pesos = (n) => `$${Number(n).toLocaleString('es-AR')}`;

const MOTIVOS_FRECUENTES = [
  'Ticket perdido — cliente sin comprobante',
  'Patente mal registrada al ingresar',
  'Ingresó sin registrar'
];

// Estadía no registrada: el auto está en la salida y no hay registro de ingreso.
//
// El monto NO es editable — sale de la configuración de la sucursal. Si el cajero pudiera
// escribirlo, la excepción se volvería un acuerdo de mostrador y el control interno
// desaparecería. Tampoco pide autorización de admin: con el auto en la barrera el control
// tiene que ser posterior (auditoría), no previo.
export default function TarjetaExcepcion({ dominio, monto, confirmando, onConfirmar, onCancelar }) {
  const [medioPago, setMedioPago] = useState('efectivo');
  const [motivo, setMotivo] = useState('');
  const campoMotivo = useRef(null);

  useEffect(() => { campoMotivo.current?.focus(); }, []);

  const motivoValido = motivo.trim().length > 0;

  return (
    <div className="tarjeta tarjeta-excepcion">
      <p className="tarjeta-tipo">Estadía no registrada</p>

      <p className="chapa tarjeta-patente">{dominio}</p>

      <p className="tarjeta-advertencia">
        <AlertTriangle size={14} aria-hidden />
        No hay registro de ingreso para esta patente. Se aplica la tarifa de excepción
        configurada.
      </p>

      <div className="tarjeta-total">
        <span>Total</span>
        <strong className="numerico">{pesos(monto)}</strong>
      </div>

      <label className="tarjeta-campo">
        <span>Motivo <em>obligatorio</em></span>
        <input
          ref={campoMotivo}
          className="control"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          list="motivos-excepcion"
          placeholder="Por qué no hay registro de ingreso"
          autoComplete="off"
        />
        <datalist id="motivos-excepcion">
          {MOTIVOS_FRECUENTES.map((m) => <option key={m} value={m} />)}
        </datalist>
      </label>

      <fieldset className="tarjeta-medios" disabled={confirmando}>
        <legend>Medio de pago</legend>
        <div className="segmentado" role="group">
          {MEDIOS.map((medio, indice) => (
            <button
              key={medio}
              type="button"
              className={`segmento${medioPago === medio ? ' es-activo' : ''}`}
              onClick={() => setMedioPago(medio)}
              aria-pressed={medioPago === medio}
            >
              {ETIQUETA_MEDIO[medio]}
              <kbd>{indice + 1}</kbd>
            </button>
          ))}
        </div>
        {/* El saldo prepago no aparece: pertenece a una cuenta, y acá no hay estadía ni
            titular que la respalde. */}
      </fieldset>

      <button
        type="button"
        className="boton-primario boton-cobrar"
        onClick={() => onConfirmar({ medioPago, motivo: motivo.trim() })}
        disabled={confirmando || !motivoValido}
      >
        {confirmando ? 'Cobrando…' : `Cobrar ${pesos(monto)}`}
      </button>

      <p className="tarjeta-nota">Queda registrado como excepción, con tu nombre y el motivo.</p>

      <button type="button" className="boton-texto" onClick={onCancelar} disabled={confirmando}>
        Cancelar <kbd>Esc</kbd>
      </button>
    </div>
  );
}
