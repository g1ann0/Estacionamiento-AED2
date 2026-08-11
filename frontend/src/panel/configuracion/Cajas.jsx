import { useCallback, useEffect, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { listarCajas } from '../../services/turnoService';
import { crearCaja, actualizarCaja, listarSucursales } from '../../services/administracionService';
import '../../styles/caja.css';

// CONFIGURACIÓN → CAJAS. Una caja es el puesto de cobro; el turno es la sesión de un operador
// sobre ella. Por eso el número de turno vive en la caja: cada una lleva su propia numeración.
//
// Desactivar una caja no borra su historia: los turnos cerrados y sus arqueos siguen ahí. Lo
// que se impide es abrir un turno nuevo.
export default function Cajas() {
  const { recargar } = useOutletContext();
  const [cajas, setCajas] = useState([]);
  const [sucursales, setSucursales] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [aviso, setAviso] = useState(null);

  const [editando, setEditando] = useState(null);
  const [nombre, setNombre] = useState('');
  const [sucursalId, setSucursalId] = useState('');
  const [activa, setActiva] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [errorDialogo, setErrorDialogo] = useState(null);
  const dialogo = useRef(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [listaCajas, listaSucursales] = await Promise.all([listarCajas(), listarSucursales()]);
      setCajas(listaCajas);
      setSucursales(listaSucursales);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const abrir = (caja) => {
    setEditando(caja);
    setErrorDialogo(null);
    setNombre(caja?.nombre ?? '');
    setSucursalId(caja?.sucursalId ?? sucursales.find((s) => s.esPrincipal)?._id ?? '');
    setActiva(caja ? caja.activa !== false : true);
    dialogo.current?.showModal();
  };

  const guardar = async (evento) => {
    evento.preventDefault();
    setGuardando(true);
    setErrorDialogo(null);
    try {
      if (editando) {
        await actualizarCaja(editando._id, { nombre, sucursalId: sucursalId || null, activa });
        setAviso(`Caja "${nombre}" actualizada`);
      } else {
        await crearCaja({ nombre, sucursalId: sucursalId || null });
        setAviso(`Caja "${nombre}" creada`);
      }
      dialogo.current?.close();
      await cargar();
      // El header del panel muestra la caja en uso: si cambió su nombre o dejó de estar
      // activa, el contexto tiene que reflejarlo sin recargar la página.
      await recargar?.();
    } catch (e) {
      setErrorDialogo(e.message);
    } finally {
      setGuardando(false);
    }
  };

  const nombreSucursal = (id) => sucursales.find((s) => s._id === id)?.nombre ?? '—';

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
          <h1 className="pantalla-titulo">Cajas</h1>
          <p className="pantalla-bajada">
            Cada caja lleva su propia numeración de turnos y admite un turno abierto a la vez.
          </p>
        </div>
        <div className="turno-acciones">
          <button type="button" className="boton-primario" onClick={() => abrir(null)}>Nueva caja</button>
        </div>
      </header>

      {error && <p className="mensaje-error" role="alert">{error}</p>}

      <section className="turno-movimientos" aria-label="Cajas configuradas">
        <div className="tabla-contenedor">
          <table className="tabla">
            <thead>
              <tr>
                <th scope="col">Caja</th>
                <th scope="col">Sucursal</th>
                <th scope="col">Estado</th>
                <th scope="col" className="col-monto">Próximo turno</th>
                <th scope="col" className="col-accion"><span className="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              {cargando && Array.from({ length: 2 }).map((_, i) => (
                <tr key={`esqueleto-${i}`} className="fila-esqueleto">
                  <td colSpan={5}><span className="esqueleto" /></td>
                </tr>
              ))}

              {!cargando && cajas.length === 0 && (
                <tr>
                  <td colSpan={5} className="tabla-estado">
                    <p>No hay cajas configuradas. Sin caja no se puede abrir turno ni cobrar.</p>
                  </td>
                </tr>
              )}

              {!cargando && cajas.map((caja) => (
                <tr key={caja._id} className={caja.activa === false ? 'fila-anulada' : undefined}>
                  <td><strong>{caja.nombre}</strong></td>
                  <td>{nombreSucursal(caja.sucursalId)}</td>
                  <td>
                    {caja.activa === false
                      ? <span className="chip chip-alerta">Inactiva</span>
                      : <span className="texto-sutil">Activa</span>}
                  </td>
                  <td className="col-monto numerico">#{caja.proximoNumeroTurno}</td>
                  <td className="col-accion">
                    <div className="acciones-fila">
                      <button type="button" className="boton-secundario" onClick={() => abrir(caja)}>Editar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <dialog ref={dialogo} className="dialogo" onClose={() => setEditando(null)} aria-labelledby="dialogo-caja-titulo">
        <form className="dialogo-cuerpo" onSubmit={guardar}>
          <h2 id="dialogo-caja-titulo" className="dialogo-titulo">
            {editando ? `Editar ${editando.nombre}` : 'Nueva caja'}
          </h2>

          {errorDialogo && <p className="mensaje-error" role="alert">{errorDialogo}</p>}

          <label className="campo">
            <span>Nombre</span>
            <input className="control" value={nombre} onChange={(e) => setNombre(e.target.value)} disabled={guardando} required autoFocus />
          </label>

          <label className="campo">
            <span>Sucursal</span>
            <select className="control" value={sucursalId} onChange={(e) => setSucursalId(e.target.value)} disabled={guardando}>
              <option value="">Sin asignar</option>
              {sucursales.map((sucursal) => (
                <option key={sucursal._id} value={sucursal._id}>{sucursal.nombre}</option>
              ))}
            </select>
          </label>

          {editando && (
            <label className="campo campo-en-linea">
              <input type="checkbox" checked={activa} onChange={(e) => setActiva(e.target.checked)} disabled={guardando} />
              <span>Activa <em>una caja inactiva no admite abrir turnos nuevos</em></span>
            </label>
          )}

          <div className="dialogo-acciones">
            <button type="button" className="boton-secundario" onClick={() => dialogo.current?.close()} disabled={guardando}>
              Cancelar <kbd>Esc</kbd>
            </button>
            <button type="submit" className="boton-primario" disabled={guardando}>
              {guardando ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
