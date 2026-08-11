import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { listarMovimientos } from '../../services/turnoService';
import { ETIQUETA_MEDIO_LARGA, ETIQUETA_ORIGEN, fechaHora } from '../formato';
import TablaMovimientos from './TablaMovimientos';
import '../../styles/caja.css';

const TODOS = 'todos';

// Movimientos del turno abierto, con filtros. Deliberadamente NO hay totales ni exportación
// de sumas acá: es la misma tabla del turno actual con más aire y filtros, no un reporte.
// Los totales viven en el cierre y en Caja → Cierres, que es donde el admin los mira.
export default function Movimientos() {
  const { turno, cargando: cargandoContexto, recargar } = useOutletContext();

  const [movimientos, setMovimientos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const [origen, setOrigen] = useState(TODOS);
  const [medio, setMedio] = useState(TODOS);

  const cargar = useCallback(async () => {
    if (!turno) { setCargando(false); return; }
    setCargando(true);
    try {
      setMovimientos(await listarMovimientos(turno._id));
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }, [turno]);

  useEffect(() => { cargar(); }, [cargar]);

  const filtrados = useMemo(() => movimientos.filter((mov) => (
    (origen === TODOS || mov.origen === origen) && (medio === TODOS || mov.medioPago === medio)
  )), [movimientos, origen, medio]);

  if (cargandoContexto) return <p className="pantalla-cargando">Cargando la caja…</p>;

  if (!turno) {
    return (
      <div className="pantalla">
        <h1 className="pantalla-titulo">Movimientos</h1>
        <p className="pantalla-bajada">
          No hay un turno abierto, así que no hay movimientos en curso.{' '}
          <Link to="/admin/caja/turno">Abrí un turno</Link> para empezar a operar, o mirá los{' '}
          <Link to="/admin/caja/cierres">turnos ya cerrados</Link>.
        </p>
        <button type="button" className="boton-secundario" onClick={recargar}>Actualizar</button>
      </div>
    );
  }

  return (
    <div className="pantalla pantalla-turno">
      <header className="turno-encabezado">
        <div>
          <h1 className="pantalla-titulo">Movimientos del turno #{turno.numero}</h1>
          <p className="pantalla-bajada">Desde {fechaHora(turno.fechaApertura)}</p>
        </div>
      </header>

      <div className="filtros">
        <label className="campo campo-en-linea">
          <span>Tipo</span>
          <select className="control" value={origen} onChange={(e) => setOrigen(e.target.value)}>
            <option value={TODOS}>Todos</option>
            {Object.entries(ETIQUETA_ORIGEN).map(([valor, etiqueta]) => (
              <option key={valor} value={valor}>{etiqueta}</option>
            ))}
          </select>
        </label>

        <label className="campo campo-en-linea">
          <span>Medio</span>
          <select className="control" value={medio} onChange={(e) => setMedio(e.target.value)}>
            <option value={TODOS}>Todos</option>
            {Object.entries(ETIQUETA_MEDIO_LARGA).map(([valor, etiqueta]) => (
              <option key={valor} value={valor}>{etiqueta}</option>
            ))}
          </select>
        </label>

        <span className="filtros-conteo numerico">
          {filtrados.length} {filtrados.length === 1 ? 'movimiento' : 'movimientos'}
        </span>
      </div>

      <section className="turno-movimientos" aria-label="Movimientos del turno">
        <TablaMovimientos
          movimientos={filtrados}
          cargando={cargando}
          error={error}
          onReintentar={cargar}
          vacio={movimientos.length === 0
            ? 'Todavía no hay movimientos en este turno. Cada cobro de la Terminal aparece acá.'
            : 'Ningún movimiento coincide con esos filtros.'}
        />
      </section>
    </div>
  );
}
