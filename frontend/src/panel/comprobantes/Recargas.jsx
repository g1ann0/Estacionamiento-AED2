import { useCallback, useEffect, useRef, useState } from 'react';
import { listarRecargas, aprobarRecarga, rechazarRecarga } from '../../services/recargaService';
import { fechaHora, pesos } from '../formato';
import '../../styles/caja.css';

const ESTADOS = { pendiente: 'Pendiente', aprobado: 'Aprobado', rechazado: 'Rechazado' };

// RECARGAS DE SALDO — pantalla de cierre, no de operación.
//
// El circuito era: el cliente transfería por fuera, subía un comprobante y un administrador
// lo aprobaba a mano. Se cerró el alta cuando apareció el cobro directo. Lo que queda es
// resolver las que ya estaban en el aire: hay plata real esperando de un lado.
//
// Por eso la pantalla no ofrece "nueva recarga" y sí ofrece aprobar y rechazar.
export default function Recargas() {
  const [datos, setDatos] = useState({ comprobantes: [], paginacion: { totalPaginas: 1, total: 0 } });
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [aviso, setAviso] = useState(null);

  const [estado, setEstado] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [pagina, setPagina] = useState(1);

  const [procesando, setProcesando] = useState(false);
  const [rechazando, setRechazando] = useState(null);
  const confirmacion = useRef(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      setDatos(await listarRecargas({ estado, busqueda, pagina }));
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }, [estado, busqueda, pagina]);

  useEffect(() => {
    const id = setTimeout(cargar, 250);
    return () => clearTimeout(id);
  }, [cargar]);

  const aprobar = async (recarga) => {
    setProcesando(true);
    try {
      await aprobarRecarga(recarga.nroComprobante);
      setAviso(`Recarga ${recarga.nroComprobante} aprobada · ${pesos(recarga.montoAcreditado)} acreditados`);
      await cargar();
    } catch (e) {
      setError(e.message);
    } finally {
      setProcesando(false);
    }
  };

  const confirmarRechazo = async () => {
    setProcesando(true);
    try {
      await rechazarRecarga(rechazando.nroComprobante);
      confirmacion.current?.close();
      setAviso(`Recarga ${rechazando.nroComprobante} rechazada`);
      setRechazando(null);
      await cargar();
    } catch (e) {
      confirmacion.current?.close();
      setError(e.message);
    } finally {
      setProcesando(false);
    }
  };

  const { comprobantes } = datos;
  const totalPaginas = Math.max(1, datos.paginacion?.totalPaginas ?? 1);

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
          <h1 className="pantalla-titulo">Recargas de saldo</h1>
          <p className="pantalla-bajada">
            El alta de recargas está <strong>cerrada</strong>: hoy se cobra al retirar el vehículo. Los
            saldos ya cargados se siguen usando como medio de pago, y las recargas que quedaron
            pendientes se resuelven desde acá.
          </p>
        </div>
      </header>

      <div className="filtros">
        <label className="campo">
          <span>Buscar</span>
          <input
            className="control"
            value={busqueda}
            onChange={(e) => { setBusqueda(e.target.value); setPagina(1); }}
            placeholder="Número, DNI o nombre"
            autoComplete="off"
          />
        </label>

        <label className="campo">
          <span>Estado</span>
          <select className="control" value={estado} onChange={(e) => { setEstado(e.target.value); setPagina(1); }}>
            <option value="">Todos</option>
            {Object.entries(ESTADOS).map(([valor, etiqueta]) => (
              <option key={valor} value={valor}>{etiqueta}</option>
            ))}
          </select>
        </label>

        <span className="filtros-conteo numerico">
          {datos.paginacion?.total ?? 0} {datos.paginacion?.total === 1 ? 'recarga' : 'recargas'}
        </span>
      </div>

      {error && <p className="mensaje-error" role="alert">{error}</p>}

      <section className="turno-movimientos" aria-label="Recargas de saldo">
        <div className="tabla-contenedor">
          <table className="tabla">
            <thead>
              <tr>
                <th scope="col">Comprobante</th>
                <th scope="col">Fecha</th>
                <th scope="col">Cliente</th>
                <th scope="col">Estado</th>
                <th scope="col" className="col-monto">Acreditado</th>
                <th scope="col" className="col-accion"><span className="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              {cargando && Array.from({ length: 5 }).map((_, i) => (
                <tr key={`esqueleto-${i}`} className="fila-esqueleto">
                  <td colSpan={6}><span className="esqueleto" /></td>
                </tr>
              ))}

              {!cargando && comprobantes.length === 0 && (
                <tr>
                  <td colSpan={6} className="tabla-estado">
                    <p>
                      {busqueda || estado
                        ? 'Ninguna recarga coincide con esos filtros.'
                        : 'No hay recargas registradas. El alta está cerrada, así que no va a aparecer ninguna nueva.'}
                    </p>
                  </td>
                </tr>
              )}

              {!cargando && comprobantes.map((recarga) => (
                <tr key={recarga._id}>
                  <td className="numerico">{recarga.nroComprobante}</td>
                  <td className="numerico">{fechaHora(recarga.fecha)}</td>
                  <td>{recarga.usuario?.apellido}, {recarga.usuario?.nombre} <span className="texto-sutil">· {recarga.usuario?.dni}</span></td>
                  <td>
                    {recarga.estado === 'pendiente'
                      ? <span className="chip chip-alerta">Pendiente</span>
                      : <span className="chip">{ESTADOS[recarga.estado]}</span>}
                  </td>
                  <td className="col-monto numerico">{pesos(recarga.montoAcreditado)}</td>
                  <td className="col-accion">
                    {recarga.estado === 'pendiente' && (
                      <div className="acciones-fila">
                        <button type="button" className="boton-secundario" onClick={() => aprobar(recarga)} disabled={procesando}>
                          Aprobar
                        </button>
                        <button
                          type="button"
                          className="boton-secundario"
                          onClick={() => { setRechazando(recarga); confirmacion.current?.showModal(); }}
                          disabled={procesando}
                        >
                          Rechazar
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {totalPaginas > 1 && (
        <nav className="paginacion" aria-label="Paginación de recargas">
          <button type="button" className="boton-secundario" onClick={() => setPagina((p) => Math.max(1, p - 1))} disabled={pagina === 1}>
            Anterior
          </button>
          <span className="numerico">Página {pagina} de {totalPaginas}</span>
          <button type="button" className="boton-secundario" onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))} disabled={pagina === totalPaginas}>
            Siguiente
          </button>
        </nav>
      )}

      <dialog ref={confirmacion} className="dialogo" aria-labelledby="confirmar-rechazo-titulo">
        <div className="dialogo-cuerpo">
          <h2 id="confirmar-rechazo-titulo" className="dialogo-titulo">
            ¿Rechazar la recarga {rechazando?.nroComprobante}?
          </h2>
          <p className="dialogo-texto">
            No se acredita saldo y el estado queda como rechazado. El cliente transfirió por fuera
            del sistema: si el dinero entró, hay que devolverlo por el mismo camino.
          </p>
          <div className="dialogo-acciones">
            <button type="button" className="boton-secundario" onClick={() => { confirmacion.current?.close(); setRechazando(null); }} disabled={procesando}>
              Cancelar
            </button>
            <button type="button" className="boton-primario" onClick={confirmarRechazo} disabled={procesando}>
              {procesando ? 'Rechazando…' : 'Sí, rechazar'}
            </button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
