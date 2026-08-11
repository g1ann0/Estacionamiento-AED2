import { useEffect, useMemo, useRef, useState } from 'react';

const ETIQUETA_MEDIO = {
  efectivo: 'Efectivo',
  tarjeta: 'Tarjeta',
  qr_transferencia: 'QR',
  saldo_prepago: 'Saldo'
};

const pesos = (n) => `$${Number(n).toLocaleString('es-AR')}`;

// 24 horas, siempre. Un turno que cruza la medianoche con horas en formato de 12 obliga al
// cajero a traducir "04:10 p. m." mientras el cliente espera, y en el arqueo un "12:47 a. m."
// es directamente ambiguo.
const hora = (fecha) =>
  new Date(fecha).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });

// Los registros anteriores a que marca/modelo pasaran a opcionales tienen 'Sin datos' y 'S/D'
// guardados como si fueran datos. La ausencia se muestra como ausencia, no como la cadena.
const PLACEHEROLDERS = ['sin datos', 's/d', ''];
const real = (valor) => (valor && !PLACEHEROLDERS.includes(String(valor).trim().toLowerCase()) ? valor : null);

const duracion = (horasReales) => {
  const total = Math.max(0, Math.round(horasReales * 60));
  return `${Math.floor(total / 60)}h ${String(total % 60).padStart(2, '0')}m`;
};

export default function TarjetaCobro({ resolucion, confirmando, onConfirmar, onCancelar }) {
  const { dominio, vehiculo, cliente, tarifa, estadia, cobro, turno, mediosPago } = resolucion;

  const disponibles = useMemo(() => mediosPago.filter((m) => m.disponible), [mediosPago]);
  const [medioPago, setMedioPago] = useState(() => disponibles[0]?.medio ?? null);
  const botonCobrar = useRef(null);

  useEffect(() => { botonCobrar.current?.focus(); }, []);

  // 1-4 eligen medio de pago, en el orden en que se ven.
  useEffect(() => {
    const alPresionar = (evento) => {
      if (evento.target.tagName === 'INPUT') return;
      const indice = Number(evento.key) - 1;
      const opcion = mediosPago[indice];
      if (opcion?.disponible) setMedioPago(opcion.medio);
    };
    window.addEventListener('keydown', alPresionar);
    return () => window.removeEventListener('keydown', alPresionar);
  }, [mediosPago]);

  const bloqueadoPorTurno = turno?.requiere && !turno?.abierto;

  return (
    <div className="tarjeta tarjeta-cobro">
      <p className="tarjeta-tipo">Cobro</p>

      <p className="chapa tarjeta-patente">{dominio}</p>
      <p className="tarjeta-vehiculo">
        {[
          [real(vehiculo?.marca), real(vehiculo?.modelo)].filter(Boolean).join(' '),
          cliente.tipo === 'registrado' ? `${cliente.nombre} ${cliente.apellido}` : 'Ocasional'
        ].filter(Boolean).join(' · ')}
      </p>

      <dl className="tarjeta-datos">
        <div><dt>Ingreso</dt><dd className="numerico">{hora(estadia.horaInicio)}</dd></div>
        <div><dt>Ahora</dt><dd className="numerico">{hora(cobro.ahora)}</dd></div>
        <div><dt>Tiempo</dt><dd className="numerico">{duracion(cobro.duracionHorasReal)}</dd></div>
        <div>
          <dt>Se cobran</dt>
          {/* El redondeo, explícito. Es la línea que le permite al cajero responder
              "¿por qué 3 horas si estuve 2 y pico?" sin llamar al dueño. */}
          <dd className="numerico">
            {cobro.duracionHoras} h
            <span className="tarjeta-origen"> · fracción hacia arriba</span>
          </dd>
        </div>
        <div>
          <dt>Tarifa</dt>
          <dd className="numerico">
            {pesos(tarifa.precioPorHora)}/h
            <span className="tarjeta-origen"> · {tarifa.etiqueta}</span>
          </dd>
        </div>
      </dl>

      {/* Máxima jerarquía visual de toda la pantalla. */}
      <div className="tarjeta-total">
        <span>Total</span>
        <strong className="numerico">{pesos(cobro.montoTotal)}</strong>
      </div>

      {bloqueadoPorTurno && (
        <p className="tarjeta-bloqueo" role="alert">
          No hay turno abierto{turno.caja ? ` en ${turno.caja.nombre}` : ''}. Abrí un turno para
          poder cobrar en efectivo, tarjeta o QR.
        </p>
      )}

      <fieldset className="tarjeta-medios" disabled={confirmando}>
        <legend>Medio de pago</legend>
        <div className="segmentado segmentado-medios" role="group">
          {mediosPago.map((opcion, indice) => (
            <button
              key={opcion.medio}
              type="button"
              className={`segmento${medioPago === opcion.medio ? ' es-activo' : ''}`}
              onClick={() => setMedioPago(opcion.medio)}
              disabled={!opcion.disponible}
              aria-pressed={medioPago === opcion.medio}
              /* Un botón apagado sin explicación obliga al cajero a adivinar con el cliente
                 esperando: el motivo viaja en el título y debajo. */
              title={opcion.motivo ?? undefined}
            >
              {ETIQUETA_MEDIO[opcion.medio] ?? opcion.medio}
              {opcion.disponible && <kbd>{indice + 1}</kbd>}
            </button>
          ))}
        </div>
        {mediosPago.filter((m) => !m.disponible && m.motivo).map((m) => (
          <p key={m.medio} className="tarjeta-motivo">
            {ETIQUETA_MEDIO[m.medio] ?? m.medio}: {m.motivo}
          </p>
        ))}
      </fieldset>

      {/* La confirmación vive DENTRO del botón: el monto está en la etiqueta, así que no hace
          falta un diálogo modal encima preguntando lo mismo. */}
      <button
        ref={botonCobrar}
        type="button"
        className="boton-primario boton-cobrar"
        onClick={() => onConfirmar(medioPago)}
        disabled={confirmando || !medioPago}
      >
        {confirmando ? 'Cobrando…' : `Cobrar ${pesos(cobro.montoTotal)}`}
        <kbd>⏎</kbd>
      </button>

      <button type="button" className="boton-texto" onClick={onCancelar} disabled={confirmando}>
        Cancelar <kbd>Esc</kbd>
      </button>
    </div>
  );
}
