import { useCallback, useEffect, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  abrirTurno,
  listarMovimientos,
  obtenerContadores,
  registrarMovimientoManual
} from '../../services/turnoService';
import { fechaHora, hora, nombreDe, pesos } from '../formato';
import DialogoMovimiento from './DialogoMovimiento';
import TablaMovimientos from './TablaMovimientos';
import CierreTurno from './CierreTurno';
import '../../styles/caja.css';

// TURNO ACTUAL — el ciclo del día del operador: abrir, operar, cerrar.
//
// Caja ciega: mientras el turno está abierto esta pantalla muestra CANTIDADES (estadías
// cobradas, ingresos y egresos de la playa) y las filas de movimientos con su monto, pero
// ningún acumulado de plata. El fondo inicial sí se muestra porque lo declaró el propio
// operador al abrir: no es información que el conteo tenga que descubrir.
export default function TurnoActual() {
  const { caja, turno, cargando: cargandoContexto, error: errorContexto, recargar } = useOutletContext();
  const { usuario } = useAuth();

  const [contadores, setContadores] = useState(null);
  const [movimientos, setMovimientos] = useState([]);
  const [cargandoTurno, setCargandoTurno] = useState(true);
  const [errorTurno, setErrorTurno] = useState(null);

  const [montoInicial, setMontoInicial] = useState('');
  const [abriendo, setAbriendo] = useState(false);
  const [errorApertura, setErrorApertura] = useState(null);

  const [dialogoAbierto, setDialogoAbierto] = useState(false);
  const [guardandoMovimiento, setGuardandoMovimiento] = useState(false);
  const [errorMovimiento, setErrorMovimiento] = useState(null);

  const [cerrando, setCerrando] = useState(false);
  const [aviso, setAviso] = useState(null);
  const campoFondo = useRef(null);

  const cargarTurno = useCallback(async () => {
    if (!turno) { setCargandoTurno(false); return; }
    try {
      const [datos, lista] = await Promise.all([
        obtenerContadores(turno._id),
        listarMovimientos(turno._id)
      ]);
      setContadores(datos);
      setMovimientos(lista);
      setErrorTurno(null);
    } catch (e) {
      setErrorTurno(e.message);
    } finally {
      setCargandoTurno(false);
    }
  }, [turno]);

  useEffect(() => { cargarTurno(); }, [cargarTurno]);

  useEffect(() => {
    if (!turno && !cargandoContexto) campoFondo.current?.focus();
  }, [turno, cargandoContexto]);

  const manejarApertura = async (evento) => {
    evento.preventDefault();
    const monto = parseFloat(montoInicial);
    if (!Number.isFinite(monto) || monto < 0) {
      setErrorApertura('Escribí el fondo inicial: cuánto efectivo hay en el cajón al empezar.');
      return;
    }
    setAbriendo(true);
    setErrorApertura(null);
    try {
      const nuevo = await abrirTurno(caja._id, monto);
      setMontoInicial('');
      setAviso(`Turno #${nuevo.numero} abierto · fondo ${pesos(monto)}`);
      await recargar();
    } catch (e) {
      setErrorApertura(e.message);
    } finally {
      setAbriendo(false);
    }
  };

  const manejarMovimiento = async (datos) => {
    setGuardandoMovimiento(true);
    setErrorMovimiento(null);
    try {
      await registrarMovimientoManual(turno._id, datos);
      setDialogoAbierto(false);
      setAviso(`${datos.tipo === 'ingreso' ? 'Ingreso' : 'Egreso'} de ${pesos(datos.monto)} registrado`);
      await cargarTurno();
    } catch (e) {
      setErrorMovimiento(e.message);
    } finally {
      setGuardandoMovimiento(false);
    }
  };

  const manejarCierre = async (resultado) => {
    setCerrando(false);
    const dif = resultado.turno.diferencia;
    setAviso(
      dif === 0
        ? `Turno #${resultado.turno.numero} cerrado sin diferencia`
        : `Turno #${resultado.turno.numero} cerrado con ${pesos(Math.abs(dif))} de ${dif > 0 ? 'sobrante' : 'faltante'}`
    );
    await recargar();
  };

  if (cargandoContexto) {
    return <p className="pantalla-cargando">Cargando la caja…</p>;
  }

  if (errorContexto) {
    return (
      <div className="pantalla">
        <p className="mensaje-error" role="alert">{errorContexto}</p>
        <button type="button" className="boton-secundario" onClick={recargar}>Reintentar</button>
      </div>
    );
  }

  if (!caja) {
    return (
      <div className="pantalla">
        <h1 className="pantalla-titulo">Caja</h1>
        <p className="pantalla-bajada">
          No hay ninguna caja configurada todavía. Un administrador tiene que crear la caja
          antes de que se pueda abrir un turno y cobrar.
        </p>
      </div>
    );
  }

  if (cerrando && turno) {
    return <CierreTurno turno={turno} onCerrado={manejarCierre} onCancelar={() => setCerrando(false)} />;
  }

  // Sin turno abierto no hay nada que mostrar salvo la puerta de entrada al día: una sola
  // decisión, un solo campo, foco puesto.
  if (!turno) {
    return (
      <div className="pantalla">
        {aviso && <p className="mensaje-exito" role="status">{aviso}</p>}

        <h1 className="pantalla-titulo">Abrir turno en {caja.nombre}</h1>
        <p className="pantalla-bajada">
          Contá el efectivo con el que arranca el cajón. Ese fondo es el punto de partida del
          arqueo al cierre.
        </p>

        <form className="apertura" onSubmit={manejarApertura}>
          {errorApertura && <p className="mensaje-error" role="alert">{errorApertura}</p>}

          <label className="campo campo-declarado">
            <span>Fondo inicial</span>
            <input
              ref={campoFondo}
              className="control numerico entrada-monto"
              type="number"
              min="0"
              step="1"
              inputMode="numeric"
              value={montoInicial}
              onChange={(e) => setMontoInicial(e.target.value)}
              placeholder="0"
              disabled={abriendo}
              required
            />
          </label>

          <button type="submit" className="boton-primario boton-cobrar" disabled={abriendo}>
            {abriendo ? 'Abriendo…' : 'Abrir turno'}
          </button>
        </form>
      </div>
    );
  }

  const duenio = turno.operadorId;
  // La sesión guarda dni, no _id (ver el payload de login en authController): el dni es el
  // identificador que las dos puntas comparten.
  const esDuenio = !duenio?.dni || duenio.dni === usuario?.dni;
  const esAdmin = usuario?.rol === 'admin';

  return (
    <div className="pantalla pantalla-turno">
      {aviso && (
        <p className="mensaje-exito" role="status">
          {aviso}
          <button type="button" className="mensaje-cerrar" onClick={() => setAviso(null)} aria-label="Cerrar">×</button>
        </p>
      )}

      <header className="turno-encabezado">
        <div>
          <h1 className="pantalla-titulo">Turno #{turno.numero} · {caja.nombre}</h1>
          <p className="pantalla-bajada">
            Abierto {fechaHora(turno.fechaApertura)} por {nombreDe(duenio, 'este equipo')}
          </p>
        </div>
        <div className="turno-acciones">
          <button type="button" className="boton-secundario" onClick={() => { setErrorMovimiento(null); setDialogoAbierto(true); }}>
            Movimiento manual
          </button>
          <button type="button" className="boton-primario" onClick={() => setCerrando(true)}>
            Cerrar turno
          </button>
        </div>
      </header>

      {/* El turno tiene dueño: si lo abrió otro, cerrarlo es una decisión administrativa y la
          pantalla lo dice antes de que alguien apriete por costumbre. */}
      {!esDuenio && (
        <p className="mensaje-atencion" role="status">
          Este turno lo abrió {nombreDe(duenio)}. {esAdmin
            ? 'Como administrador podés cerrarlo, pero la diferencia queda a nombre de quien lo abrió.'
            : 'Pedile que lo cierre: la diferencia de caja queda a su nombre.'}
        </p>
      )}

      {/* Franja demarcada, no cuatro tarjetas flotando: el fondo inicial es plata declarada
          por el propio operador; el resto son cantidades, nunca importes. */}
      <dl className="turno-tablero">
        <div>
          <dt>Fondo inicial</dt>
          <dd className="numerico">{pesos(turno.montoInicial)}</dd>
        </div>
        <div>
          <dt>Estadías cobradas</dt>
          <dd className="numerico">{contadores?.estadiasCobradas ?? '—'}</dd>
        </div>
        <div>
          <dt>Ingresos a la playa</dt>
          <dd className="numerico">{contadores?.ingresosPlaya ?? '—'}</dd>
        </div>
        <div>
          <dt>Egresos de la playa</dt>
          <dd className="numerico">{contadores?.egresosPlaya ?? '—'}</dd>
        </div>
      </dl>

      <section className="turno-movimientos" aria-label="Movimientos del turno">
        <header className="bloque-header">
          <span className="bloque-titulo">Movimientos del turno</span>
          <span className="turno-desde">desde las {hora(turno.fechaApertura)}</span>
        </header>

        <TablaMovimientos
          movimientos={movimientos}
          cargando={cargandoTurno}
          error={errorTurno}
          onReintentar={cargarTurno}
          vacio="Todavía no hay movimientos en este turno. Cada cobro de la Terminal aparece acá."
        />
      </section>

      <DialogoMovimiento
        abierto={dialogoAbierto}
        guardando={guardandoMovimiento}
        error={errorMovimiento}
        onGuardar={manejarMovimiento}
        onCerrar={() => setDialogoAbierto(false)}
      />
    </div>
  );
}
