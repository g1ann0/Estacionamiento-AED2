import { useCallback, useEffect, useRef, useState } from 'react';
import { Download } from 'lucide-react';
import { listarFacturas, anularFactura, descargarFactura } from '../../services/recargaService';
import { fechaHora, pesos } from '../formato';
import '../../styles/caja.css';

// FACTURAS — las que se generaban al aprobar una recarga de saldo. Como la recarga cerró su
// alta, esta pantalla es principalmente histórico: se consulta, se descarga y, cuando hace
// falta, se anula con motivo.
//
// No confundir con Comprobantes de estadía: son dos circuitos distintos y esta pantalla no
// tiene nada que ver con el cobro del mostrador.
export default function Facturas() {
  const [datos, setDatos] = useState({ facturas: [], paginacion: { totalPaginas: 1, total: 0 }, estadisticas: null });
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [aviso, setAviso] = useState(null);

  const [estado, setEstado] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [pagina, setPagina] = useState(1);

  const [anulando, setAnulando] = useState(null);
  const [motivo, setMotivo] = useState('');
  const [procesando, setProcesando] = useState(false);
  const confirmacion = useRef(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      setDatos(await listarFacturas({ estado, busqueda, pagina }));
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

  const bajar = async (factura) => {
    try {
      await descargarFactura(factura.nroFactura);
    } catch (e) {
      setError(e.message);
    }
  };

  const confirmarAnulacion = async () => {
    if (!motivo.trim()) return;
    setProcesando(true);
    try {
      await anularFactura(anulando.nroFactura, motivo.trim());
      confirmacion.current?.close();
      setAviso(`Factura ${anulando.nroFactura} anulada`);
      setAnulando(null);
      setMotivo('');
      await cargar();
    } catch (e) {
      confirmacion.current?.close();
      setError(e.message);
    } finally {
      setProcesando(false);
    }
  };

  const { facturas } = datos;
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
          <h1 className="pantalla-titulo">Facturas</h1>
          <p className="pantalla-bajada">
            Las facturas emitidas por recarga de saldo. Como las recargas ya no se dan de alta,
            esta lista deja de crecer.
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
            <option value="">Todas</option>
            <option value="emitida">Emitidas</option>
            <option value="anulada">Anuladas</option>
          </select>
        </label>

        <span className="filtros-conteo numerico">
          {datos.paginacion?.total ?? 0} {datos.paginacion?.total === 1 ? 'factura' : 'facturas'}
        </span>
      </div>

      {error && <p className="mensaje-error" role="alert">{error}</p>}

      <section className="turno-movimientos" aria-label="Facturas emitidas">
        <div className="tabla-contenedor">
          <table className="tabla">
            <thead>
              <tr>
                <th scope="col">Número</th>
                <th scope="col">Emitida</th>
                <th scope="col">Cliente</th>
                <th scope="col">Concepto</th>
                <th scope="col" className="col-monto">Total</th>
                <th scope="col" className="col-accion"><span className="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              {cargando && Array.from({ length: 5 }).map((_, i) => (
                <tr key={`esqueleto-${i}`} className="fila-esqueleto">
                  <td colSpan={6}><span className="esqueleto" /></td>
                </tr>
              ))}

              {!cargando && facturas.length === 0 && (
                <tr>
                  <td colSpan={6} className="tabla-estado">
                    <p>
                      {busqueda || estado
                        ? 'Ninguna factura coincide con esos filtros.'
                        : 'No hay facturas emitidas.'}
                    </p>
                  </td>
                </tr>
              )}

              {!cargando && facturas.map((factura) => (
                <tr key={factura._id} className={factura.estado === 'anulada' ? 'fila-anulada' : undefined}>
                  <td className="numerico">{factura.nroFactura}</td>
                  <td className="numerico">{fechaHora(factura.fechaEmision)}</td>
                  <td>{factura.cliente?.apellido}, {factura.cliente?.nombre}</td>
                  <td className="col-concepto">{factura.concepto?.descripcion}</td>
                  <td className="col-monto numerico">{pesos(factura.total)}</td>
                  <td className="col-accion">
                    <div className="acciones-fila">
                      {factura.estado === 'anulada' && <span className="chip chip-alerta">Anulada</span>}
                      <button type="button" className="boton-secundario" onClick={() => bajar(factura)}>
                        <Download size={13} aria-hidden /> Descargar
                      </button>
                      {factura.estado !== 'anulada' && (
                        <button
                          type="button"
                          className="boton-secundario"
                          onClick={() => { setAnulando(factura); setMotivo(''); confirmacion.current?.showModal(); }}
                        >
                          Anular
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {totalPaginas > 1 && (
        <nav className="paginacion" aria-label="Paginación de facturas">
          <button type="button" className="boton-secundario" onClick={() => setPagina((p) => Math.max(1, p - 1))} disabled={pagina === 1}>
            Anterior
          </button>
          <span className="numerico">Página {pagina} de {totalPaginas}</span>
          <button type="button" className="boton-secundario" onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))} disabled={pagina === totalPaginas}>
            Siguiente
          </button>
        </nav>
      )}

      <dialog ref={confirmacion} className="dialogo" aria-labelledby="confirmar-anulacion-titulo">
        <form className="dialogo-cuerpo" onSubmit={(e) => { e.preventDefault(); confirmarAnulacion(); }}>
          <h2 id="confirmar-anulacion-titulo" className="dialogo-titulo">
            ¿Anular la factura {anulando?.nroFactura}?
          </h2>
          <p className="dialogo-texto">
            La factura queda marcada como anulada y no se puede volver atrás. El motivo se guarda
            con el registro.
          </p>
          <label className="campo">
            <span>Motivo de la anulación</span>
            <input
              className="control"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              disabled={procesando}
              required
              autoFocus
            />
          </label>
          <div className="dialogo-acciones">
            <button type="button" className="boton-secundario" onClick={() => { confirmacion.current?.close(); setAnulando(null); }} disabled={procesando}>
              Cancelar
            </button>
            <button type="submit" className="boton-primario" disabled={procesando || !motivo.trim()}>
              {procesando ? 'Anulando…' : 'Sí, anular'}
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
