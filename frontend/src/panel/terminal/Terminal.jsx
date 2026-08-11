import { useCallback, useEffect, useRef, useState } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import { resolverPatente, listarActivas, ingresoManual, egresoManual, egresoExcepcion } from '../../services/estadiaManualService';
import { obtenerContadores } from '../../services/turnoService';
import { descargarComprobante, enviarComprobante } from '../../services/comprobanteEstadiaService';
import { Download, Mail } from 'lucide-react';
import DialogoEnviar from '../comprobantes/DialogoEnviar';
import TarjetaIngreso from './TarjetaIngreso';
import TarjetaCobro from './TarjetaCobro';
import TarjetaExcepcion from './TarjetaExcepcion';
import VehiculosDentro from './VehiculosDentro';
import '../../styles/terminal.css';

// TERMINAL DE OPERACIÓN — un campo, dos verbos.
//
// El operador no elige "voy a ingresar" o "voy a cobrar": escribe la patente, el sistema
// resuelve en qué situación está ese vehículo, y la tarjeta que aparece ES la acción.
// Cliente registrado y ocasional convergen en el mismo flujo sin que el cajero tenga que
// saber cuál es cuál.
//
// Objetivo de velocidad: PATENTE → Enter (resuelve) → Enter (confirma). Dos pulsaciones.

const REFRESCO_TABLA_MS = 30000; // el "tiempo estacionado" cada segundo sería ruido sin valor

export default function Terminal() {
  // El turno viene resuelto por el shell: la Terminal no vuelve a preguntarlo.
  const { turno } = useOutletContext();
  const [patente, setPatente] = useState('');
  const [resolucion, setResolucion] = useState(null);
  // La excepción es un desvío explícito desde la tarjeta de ingreso, nunca un estado al que
  // el sistema llegue solo: cobrar de más tiene que ser siempre una decisión tomada a mano.
  const [modoExcepcion, setModoExcepcion] = useState(false);
  const [resolviendo, setResolviendo] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [error, setError] = useState(null);
  const [aviso, setAviso] = useState(null);

  const [activas, setActivas] = useState([]);
  const [ocupacion, setOcupacion] = useState(null);
  // Ritmo del turno: cuántos entraron y cuántos salieron. Cantidades, nunca recaudación —
  // la caja ciega no se rompe desde la Terminal.
  const [contadores, setContadores] = useState(null);
  const [cargandoTabla, setCargandoTabla] = useState(true);
  const [errorTabla, setErrorTabla] = useState(null);

  // Entrega del comprobante desde el aviso del cobro (ver sección D de la propuesta: la
  // entrega es digital, sin hardware de impresión).
  const [enviando, setEnviando] = useState(null);
  const [mandando, setMandando] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState(null);

  const campoPatente = useRef(null);

  const enfocarPatente = useCallback(() => {
    campoPatente.current?.focus();
    campoPatente.current?.select();
  }, []);

  // "Buscar en vehículos dentro" mueve el foco a la búsqueda de la tabla en vez de navegar:
  // la playa ya está a la derecha, hacer navegar al operador sería trabajo de más.
  const enfocarBusqueda = useCallback(() => {
    document.getElementById('buscar-en-playa')?.focus();
  }, []);

  const cargarPlaya = useCallback(async () => {
    try {
      const { activas: lista, ocupacion: datos } = await listarActivas();
      setActivas(lista);
      setOcupacion(datos);
      setErrorTabla(null);
    } catch (e) {
      setErrorTabla(e.message);
    } finally {
      setCargandoTabla(false);
    }

    // El ritmo es información secundaria: si falla, la playa se muestra igual.
    if (!turno) { setContadores(null); return; }
    try {
      setContadores(await obtenerContadores(turno._id));
    } catch {
      setContadores(null);
    }
  }, [turno]);

  useEffect(() => {
    cargarPlaya();
    const id = setInterval(cargarPlaya, REFRESCO_TABLA_MS);
    return () => clearInterval(id);
  }, [cargarPlaya]);

  // El foco vive en el campo de patente: es la posición que el operador aprende y a la que
  // vuelve después de cada operación.
  useEffect(() => { enfocarPatente(); }, [enfocarPatente]);

  const reiniciar = useCallback(() => {
    setPatente('');
    setResolucion(null);
    setModoExcepcion(false);
    setError(null);
    enfocarPatente();
  }, [enfocarPatente]);

  const resolver = useCallback(async (dominio) => {
    const limpia = (dominio ?? patente).trim().toUpperCase();
    if (!limpia) return;

    setResolviendo(true);
    setError(null);
    setAviso(null);
    setModoExcepcion(false);
    try {
      const datos = await resolverPatente(limpia);
      setResolucion(datos);
      setPatente(limpia);
    } catch (e) {
      setError(e.message);
      setResolucion(null);
    } finally {
      setResolviendo(false);
    }
  }, [patente]);

  const confirmarIngreso = useCallback(async ({ tipoVehiculo, clienteOcasional }) => {
    setConfirmando(true);
    setError(null);
    try {
      await ingresoManual({ dominio: resolucion.dominio, tipoVehiculo, clienteOcasional });
      const hora = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
      setAviso({ tipo: 'exito', texto: `${resolucion.dominio} ingresó · ${hora}` });
      reiniciar();
      cargarPlaya();
    } catch (e) {
      // La estadía no se creó: el operador puede corregir y reintentar sin perder el auto.
      setError(e.message);
    } finally {
      setConfirmando(false);
    }
  }, [resolucion, reiniciar, cargarPlaya]);

  const confirmarCobro = useCallback(async (medioPago) => {
    setConfirmando(true);
    setError(null);
    try {
      const datos = await egresoManual({ dominio: resolucion.dominio, medioPago });
      const numero = datos.comprobante
        ? ` · Comprobante ${datos.comprobante.puntoVenta}-${String(datos.comprobante.numero).padStart(8, '0')}`
        : '';
      // El comprobante viaja en el aviso: la entrega al cliente se resuelve desde ahí mismo,
      // sin ir a buscarlo a otra pantalla con el auto todavía en la salida.
      setAviso({
        tipo: 'exito',
        texto: `${resolucion.dominio} egresó · $${datos.montoTotal.toLocaleString('es-AR')}${numero}`,
        comprobante: datos.comprobante ?? null
      });
      reiniciar();
      cargarPlaya();
    } catch (e) {
      // Si el cobro falla, la estadía queda abierta: nunca se pierde el auto por un error de red.
      setError(e.message);
    } finally {
      setConfirmando(false);
    }
  }, [resolucion, reiniciar, cargarPlaya]);

  const confirmarExcepcion = useCallback(async ({ medioPago, motivo }) => {
    setConfirmando(true);
    setError(null);
    try {
      const datos = await egresoExcepcion({ dominio: resolucion.dominio, medioPago, motivo });
      setAviso({
        tipo: 'exito',
        texto: `${resolucion.dominio} · estadía no registrada cobrada · $${datos.montoTotal.toLocaleString('es-AR')}`
      });
      reiniciar();
      cargarPlaya();
    } catch (e) {
      setError(e.message);
    } finally {
      setConfirmando(false);
    }
  }, [resolucion, reiniciar, cargarPlaya]);

  const numeroComprobante = (c) => `${c.puntoVenta}-${String(c.numero).padStart(8, '0')}`;

  const bajarComprobante = useCallback(async (comprobante) => {
    try {
      await descargarComprobante(comprobante._id, `comprobante_${numeroComprobante(comprobante)}.pdf`);
    } catch (e) {
      setError(e.message);
    }
  }, []);

  const mandarComprobante = useCallback(async (email) => {
    setMandando(true);
    setErrorEnvio(null);
    try {
      const respuesta = await enviarComprobante(enviando._id, email);
      setEnviando(null);
      setAviso({ tipo: 'exito', texto: respuesta.mensaje, comprobante: null });
      enfocarPatente();
    } catch (e) {
      setErrorEnvio(e.message);
    } finally {
      setMandando(false);
    }
  }, [enviando, enfocarPatente]);

  // Otra pantalla puede mandar acá una patente ya elegida (Playa → Vehículos dentro). La
  // Terminal la resuelve y limpia el parámetro: si quedara en la URL, un refresh volvería a
  // abrir una tarjeta de cobro que el operador ya cerró.
  const [parametros, setParametros] = useSearchParams();
  useEffect(() => {
    const dominio = parametros.get('patente');
    if (!dominio) return;
    setParametros({}, { replace: true });
    resolver(dominio);
  }, [parametros, setParametros, resolver]);

  // Atajos de tecla de función, convención de POS: no compiten con el navegador como lo
  // harían Ctrl+I o Ctrl+E. Se evitan F1, F3, F5, F6, F7, F10, F11 y F12, que sí están
  // tomadas.
  useEffect(() => {
    const alPresionar = (evento) => {
      if (evento.key === 'F2') { evento.preventDefault(); reiniciar(); }
      if (evento.key === 'Escape' && resolucion) { evento.preventDefault(); reiniciar(); }
    };
    window.addEventListener('keydown', alPresionar);
    return () => window.removeEventListener('keydown', alPresionar);
  }, [reiniciar, resolucion]);

  return (
    <div className="terminal">
      {aviso && (
        <div className={`terminal-aviso es-${aviso.tipo}`} role="status">
          {aviso.texto}
          {aviso.comprobante && (
            <div className="terminal-aviso-acciones">
              <button type="button" className="boton-secundario" onClick={() => bajarComprobante(aviso.comprobante)}>
                <Download size={13} aria-hidden /> Descargar
              </button>
              <button type="button" className="boton-secundario" onClick={() => setEnviando(aviso.comprobante)}>
                <Mail size={13} aria-hidden /> Enviar
              </button>
            </div>
          )}
          <button type="button" className="terminal-aviso-cerrar" onClick={() => setAviso(null)} aria-label="Cerrar">×</button>
        </div>
      )}

      <div className="terminal-columnas">
        <section className="terminal-comando" aria-label="Operación">
          <label className="terminal-etiqueta" htmlFor="campo-patente">Patente</label>
          <div className="terminal-campo">
            <input
              id="campo-patente"
              ref={campoPatente}
              className="chapa terminal-input-patente"
              value={patente}
              onChange={(e) => setPatente(e.target.value.toUpperCase())}
              onKeyDown={(e) => { if (e.key === 'Enter' && !resolucion) { e.preventDefault(); resolver(); } }}
              placeholder="AB123CD"
              autoComplete="off"
              spellCheck="false"
              disabled={resolviendo || confirmando}
              aria-describedby={error ? 'terminal-error' : undefined}
            />
            <kbd className="terminal-kbd">⏎</kbd>
          </div>

          {error && <p id="terminal-error" className="terminal-error" role="alert">{error}</p>}

          {resolviendo && <p className="terminal-resolviendo">Resolviendo…</p>}

          {resolucion?.accion === 'ingresar' && !modoExcepcion && (
            <TarjetaIngreso
              resolucion={resolucion}
              confirmando={confirmando}
              onConfirmar={confirmarIngreso}
              onCancelar={reiniciar}
              onBuscarEnPlaya={() => { setPatente(''); setResolucion(null); enfocarBusqueda(); }}
              onCobrarExcepcion={() => setModoExcepcion(true)}
            />
          )}

          {resolucion?.accion === 'ingresar' && modoExcepcion && (
            <TarjetaExcepcion
              dominio={resolucion.dominio}
              monto={resolucion.excepcion.monto}
              confirmando={confirmando}
              onConfirmar={confirmarExcepcion}
              onCancelar={() => setModoExcepcion(false)}
            />
          )}

          {resolucion?.accion === 'cobrar' && (
            <TarjetaCobro
              resolucion={resolucion}
              confirmando={confirmando}
              onConfirmar={confirmarCobro}
              onCancelar={reiniciar}
            />
          )}
        </section>

        <VehiculosDentro
          activas={activas}
          ocupacion={ocupacion}
          contadores={contadores}
          cargando={cargandoTabla}
          error={errorTabla}
          onReintentar={cargarPlaya}
          onCobrar={(dominio) => resolver(dominio)}
        />
      </div>

      <DialogoEnviar
        abierto={Boolean(enviando)}
        comprobante={enviando ? numeroComprobante(enviando) : ''}
        enviando={mandando}
        error={errorEnvio}
        onEnviar={mandarComprobante}
        onCerrar={() => { setEnviando(null); enfocarPatente(); }}
      />
    </div>
  );
}
