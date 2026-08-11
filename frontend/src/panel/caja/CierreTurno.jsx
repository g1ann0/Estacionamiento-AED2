import { useEffect, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { obtenerResumenCierre, cerrarTurno } from '../../services/turnoService';
import { ETIQUETA_MEDIO_LARGA, fechaHora, pesos, pesosConSigno } from '../formato';

// CIERRE DE TURNO — caja ciega, dos pasos, y el orden no es negociable.
//
//   1. Declarar. El operador cuenta el efectivo del cajón y lo escribe. En este paso no hay
//      ningún total a la vista: ni esperado, ni por medio de pago, ni acumulado. Si el
//      sistema le muestra cuánto "debería" haber, el conteo deja de ser un control.
//   2. Resultado. Recién al continuar se pide el resumen al backend y aparecen fondo
//      inicial, cobrado por medio, esperado, declarado y diferencia.
//
// Por eso `obtenerResumenCierre` no se llama al montar: se llama cuando el paso 1 termina.
export default function CierreTurno({ turno, onCerrado, onCancelar }) {
  const [paso, setPaso] = useState('declarar');
  const [montoDeclarado, setMontoDeclarado] = useState('');
  const [observacion, setObservacion] = useState('');
  const [resumen, setResumen] = useState(null);
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState(null);

  const campoMonto = useRef(null);
  const confirmacion = useRef(null);

  useEffect(() => { campoMonto.current?.focus(); }, []);

  const declarado = parseFloat(montoDeclarado);
  const diferencia = resumen ? declarado - resumen.efectivoEsperado : null;
  const faltaObservacion = diferencia !== null && diferencia !== 0 && !observacion.trim();

  const continuar = async (evento) => {
    evento.preventDefault();
    if (!Number.isFinite(declarado)) return;
    setTrabajando(true);
    setError(null);
    try {
      setResumen(await obtenerResumenCierre(turno._id));
      setPaso('resultado');
    } catch (e) {
      setError(e.message);
    } finally {
      setTrabajando(false);
    }
  };

  const confirmar = async () => {
    setTrabajando(true);
    setError(null);
    try {
      const resultado = await cerrarTurno(turno._id, {
        montoDeclaradoCierre: declarado,
        observacionCierre: observacion.trim()
      });
      onCerrado(resultado);
    } catch (e) {
      // El turno sigue abierto: el operador puede corregir el conteo y volver a intentar.
      confirmacion.current?.close();
      setError(e.message);
    } finally {
      setTrabajando(false);
    }
  };

  return (
    <div className="cierre">
      <header className="cierre-encabezado">
        <div>
          <h1 className="pantalla-titulo">Cerrar turno #{turno.numero}</h1>
          <p className="pantalla-bajada">
            Abierto {fechaHora(turno.fechaApertura)} · paso {paso === 'declarar' ? '1' : '2'} de 2
          </p>
        </div>
        <button type="button" className="boton-secundario" onClick={onCancelar} disabled={trabajando}>
          Volver al turno
        </button>
      </header>

      {error && <p className="mensaje-error" role="alert">{error}</p>}

      {paso === 'declarar' && (
        <form className="cierre-panel" onSubmit={continuar}>
          <p className="cierre-instruccion">
            Contá el efectivo del cajón y escribí el total. El sistema no muestra el esperado
            hasta que declares: así el conteo vale como control.
          </p>

          <label className="campo campo-declarado">
            <span>Efectivo contado</span>
            <input
              ref={campoMonto}
              className="control numerico entrada-monto"
              type="number"
              step="1"
              inputMode="numeric"
              value={montoDeclarado}
              onChange={(e) => setMontoDeclarado(e.target.value)}
              placeholder="0"
              required
            />
          </label>

          <label className="campo">
            <span>Observación <em>opcional en este paso</em></span>
            <input
              className="control"
              value={observacion}
              onChange={(e) => setObservacion(e.target.value)}
              placeholder="Ej: se pagó un flete con efectivo del cajón"
            />
          </label>

          <button type="submit" className="boton-primario boton-cobrar" disabled={trabajando || !montoDeclarado}>
            {trabajando ? 'Calculando…' : 'Continuar'}
          </button>
        </form>
      )}

      {paso === 'resultado' && resumen && (
        <div className="cierre-panel">
          <dl className="cierre-resumen">
            <div><dt>Fondo inicial</dt><dd className="numerico">{pesos(resumen.montoInicial)}</dd></div>
            {Object.entries(resumen.totalPorMedioPago).map(([medio, monto]) => (
              <div key={medio} className="cierre-medio">
                <dt>{ETIQUETA_MEDIO_LARGA[medio] ?? medio}</dt>
                <dd className="numerico">{pesosConSigno(monto)}</dd>
              </div>
            ))}
            <div><dt>Estadías cobradas</dt><dd className="numerico">{resumen.totalEstadias}</dd></div>
          </dl>

          <dl className="cierre-arqueo">
            <div><dt>Efectivo esperado</dt><dd className="numerico">{pesos(resumen.efectivoEsperado)}</dd></div>
            <div><dt>Efectivo contado</dt><dd className="numerico">{pesos(declarado)}</dd></div>
            <div className={`cierre-diferencia${diferencia === 0 ? '' : ' hay-diferencia'}`}>
              <dt>Diferencia</dt>
              <dd className="numerico">{pesosConSigno(diferencia)}</dd>
            </div>
          </dl>

          {diferencia !== 0 && (
            <p className="mensaje-atencion">
              <AlertTriangle size={14} aria-hidden />{' '}
              {diferencia > 0 ? 'Sobra' : 'Falta'} {pesos(Math.abs(diferencia))} en el cajón.
              Explicá el motivo: queda asentado en el cierre y en la auditoría.
            </p>
          )}

          <label className="campo">
            <span>
              Observación {diferencia === 0 ? <em>opcional</em> : <em>obligatoria: hay diferencia</em>}
            </span>
            <textarea
              className="control control-texto"
              rows={3}
              value={observacion}
              onChange={(e) => setObservacion(e.target.value)}
              required={diferencia !== 0}
            />
          </label>

          <div className="cierre-acciones">
            <button type="button" className="boton-secundario" onClick={() => setPaso('declarar')} disabled={trabajando}>
              Corregir el conteo
            </button>
            <button
              type="button"
              className="boton-primario boton-cobrar"
              onClick={() => confirmacion.current?.showModal()}
              disabled={trabajando || faltaObservacion}
            >
              Cerrar turno
            </button>
          </div>
          {faltaObservacion && (
            <p className="cierre-nota">Escribí la observación para poder cerrar.</p>
          )}
        </div>
      )}

      {/* Cerrar el turno es irreversible: un turno cerrado no se reabre, solo se anula. Esa
          asimetría justifica la única confirmación modal del flujo. */}
      <dialog ref={confirmacion} className="dialogo" aria-labelledby="confirmar-cierre-titulo">
        <div className="dialogo-cuerpo">
          <h2 id="confirmar-cierre-titulo" className="dialogo-titulo">¿Cerrar el turno #{turno.numero}?</h2>
          <p className="dialogo-texto">
            Se registra un cierre con {pesos(declarado)} contados
            {diferencia !== 0 && ` y ${pesosConSigno(diferencia)} de diferencia`}. No se puede reabrir:
            un turno cerrado solo se anula, y eso queda auditado.
          </p>
          <div className="dialogo-acciones">
            <button type="button" className="boton-secundario" onClick={() => confirmacion.current?.close()} disabled={trabajando}>
              Volver
            </button>
            <button type="button" className="boton-primario" onClick={confirmar} disabled={trabajando}>
              {trabajando ? 'Cerrando…' : 'Sí, cerrar el turno'}
            </button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
