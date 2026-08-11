import { useCallback, useEffect, useState } from 'react';
import { listarHistorialEstadias } from '../../services/administracionService';
import { duracionEntre, fechaHora, pesos } from '../formato';
import '../../styles/caja.css';

const ORIGENES = {
  app: 'App del cliente',
  caja: 'Caja',
  manual: 'Manual',
  api: 'API',
  excepcion: 'Excepción'
};

// PLAYA → HISTORIAL DE ESTADÍAS. Lo que ya pasó: cada auto que entró, cuánto estuvo y cuánto
// se cobró. Es la pantalla a la que se llega cuando alguien discute un cobro, así que la
// duración real y el importe van juntos en la misma fila.
export default function HistorialEstadias() {
  const [datos, setDatos] = useState({ estadias: [], total: 0, totalPaginas: 1 });
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const [dominio, setDominio] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [estado, setEstado] = useState('');
  const [pagina, setPagina] = useState(1);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      setDatos(await listarHistorialEstadias({ dominio, desde, hasta, estado, pagina }));
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }, [dominio, desde, hasta, estado, pagina]);

  useEffect(() => {
    const id = setTimeout(cargar, 250);
    return () => clearTimeout(id);
  }, [cargar]);

  const { estadias, total, totalPaginas } = datos;

  return (
    <div className="pantalla pantalla-turno">
      <header className="turno-encabezado">
        <div>
          <h1 className="pantalla-titulo">Historial de estadías</h1>
          <p className="pantalla-bajada">Cada estadía cerrada, con su duración real y lo que se cobró.</p>
        </div>
      </header>

      <div className="filtros">
        <label className="campo">
          <span>Patente</span>
          <input
            className="control chapa"
            value={dominio}
            onChange={(e) => { setDominio(e.target.value.toUpperCase()); setPagina(1); }}
            placeholder="AB123CD"
            autoComplete="off"
          />
        </label>

        <label className="campo">
          <span>Desde</span>
          <input className="control" type="date" value={desde} onChange={(e) => { setDesde(e.target.value); setPagina(1); }} />
        </label>

        <label className="campo">
          <span>Hasta</span>
          <input className="control" type="date" value={hasta} onChange={(e) => { setHasta(e.target.value); setPagina(1); }} />
        </label>

        <label className="campo">
          <span>Estado</span>
          <select className="control" value={estado} onChange={(e) => { setEstado(e.target.value); setPagina(1); }}>
            <option value="">Todas</option>
            <option value="activo">Adentro</option>
            <option value="finalizado">Finalizadas</option>
          </select>
        </label>

        <span className="filtros-conteo numerico">
          {total} {total === 1 ? 'estadía' : 'estadías'}
        </span>
      </div>

      {error && <p className="mensaje-error" role="alert">{error}</p>}

      <section className="turno-movimientos" aria-label="Historial de estadías">
        <div className="tabla-contenedor">
          <table className="tabla">
            <thead>
              <tr>
                <th scope="col">Patente</th>
                <th scope="col">Ingreso</th>
                <th scope="col">Egreso</th>
                <th scope="col">Tiempo</th>
                <th scope="col">Cliente</th>
                <th scope="col">Origen</th>
                <th scope="col" className="col-monto">Cobrado</th>
              </tr>
            </thead>
            <tbody>
              {cargando && Array.from({ length: 6 }).map((_, i) => (
                <tr key={`esqueleto-${i}`} className="fila-esqueleto">
                  <td colSpan={7}><span className="esqueleto" /></td>
                </tr>
              ))}

              {!cargando && estadias.length === 0 && (
                <tr>
                  <td colSpan={7} className="tabla-estado">
                    <p>{dominio || desde || hasta || estado
                      ? 'Ninguna estadía coincide con esos filtros.'
                      : 'Todavía no hay estadías registradas.'}</p>
                  </td>
                </tr>
              )}

              {!cargando && estadias.map((estadia) => (
                <tr key={estadia._id}>
                  <td className="chapa">{estadia.vehiculoDominio}</td>
                  <td className="numerico">{fechaHora(estadia.horaInicio)}</td>
                  <td className="numerico">
                    {estadia.horaFin ? fechaHora(estadia.horaFin) : <span className="chip">Adentro</span>}
                  </td>
                  <td className="numerico">
                    {estadia.horaFin ? duracionEntre(estadia.horaInicio, estadia.horaFin) : <span className="texto-sutil">—</span>}
                  </td>
                  <td>
                    {estadia.cliente
                      ? `${estadia.cliente.apellido}, ${estadia.cliente.nombre}`
                      : (estadia.clienteOcasional?.nombre ?? <span className="chip">Ocasional</span>)}
                  </td>
                  <td>
                    {estadia.origen === 'excepcion'
                      ? <span className="chip chip-alerta">Excepción</span>
                      : <span className="texto-sutil">{ORIGENES[estadia.origen] ?? estadia.origen}</span>}
                  </td>
                  <td className="col-monto numerico">
                    {estadia.montoTotal != null ? pesos(estadia.montoTotal) : <span className="texto-sutil">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {totalPaginas > 1 && (
        <nav className="paginacion" aria-label="Paginación del historial">
          <button type="button" className="boton-secundario" onClick={() => setPagina((p) => Math.max(1, p - 1))} disabled={pagina === 1}>
            Anterior
          </button>
          <span className="numerico">Página {pagina} de {totalPaginas}</span>
          <button type="button" className="boton-secundario" onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))} disabled={pagina === totalPaginas}>
            Siguiente
          </button>
        </nav>
      )}
    </div>
  );
}
