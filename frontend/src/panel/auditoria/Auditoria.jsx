import { useCallback, useEffect, useState } from 'react';
import { listarAuditoria } from '../../services/administracionService';
import { fechaHora, nombreDe } from '../formato';
import '../../styles/caja.css';

const TIPOS = {
  todos: 'Todo',
  saldo: 'Saldo',
  vehiculo: 'Vehículos',
  precio: 'Tarifas',
  configuracion: 'Configuración'
};

// Las acciones se guardan como `entidad_verbo`; para leerlas se les saca el guión bajo y se
// las escribe como lo que son. Traducir solo las conocidas y dejar pasar el resto evita que
// una acción nueva aparezca en blanco.
const legible = (accion = '') => accion.replace(/_/g, ' ');

// AUDITORÍA. El principio del producto dice que todo cambio sensible deja rastro y que la
// interfaz tiene que hacerlo visible, no esconderlo.
//
// Antes esta consulta leía cinco colecciones distintas, las traía enteras a memoria y
// paginaba en Node. Con AuditLog consolidado, el filtro y la paginación los hace la base.
export default function Auditoria() {
  const [datos, setDatos] = useState({ logs: [], paginacion: { totalPaginas: 1, total: 0 } });
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const [tipoLog, setTipoLog] = useState('todos');
  const [busqueda, setBusqueda] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [pagina, setPagina] = useState(1);
  const [expandido, setExpandido] = useState(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      setDatos(await listarAuditoria({ tipoLog, busqueda, fechaDesde, fechaHasta, pagina, limite: 25 }));
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }, [tipoLog, busqueda, fechaDesde, fechaHasta, pagina]);

  useEffect(() => {
    const id = setTimeout(cargar, 250);
    return () => clearTimeout(id);
  }, [cargar]);

  const { logs } = datos;
  const totalPaginas = Math.max(1, datos.paginacion?.totalPaginas ?? 1);

  return (
    <div className="pantalla pantalla-turno">
      <header className="turno-encabezado">
        <div>
          <h1 className="pantalla-titulo">Auditoría</h1>
          <p className="pantalla-bajada">
            Cada cambio sensible con su autor, su momento y el antes y después. Abrí una fila
            para ver el detalle guardado.
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
            placeholder="Acción, DNI, entidad o motivo"
            autoComplete="off"
          />
        </label>

        <label className="campo">
          <span>Tipo</span>
          <select className="control" value={tipoLog} onChange={(e) => { setTipoLog(e.target.value); setPagina(1); }}>
            {Object.entries(TIPOS).map(([valor, etiqueta]) => (
              <option key={valor} value={valor}>{etiqueta}</option>
            ))}
          </select>
        </label>

        <label className="campo">
          <span>Desde</span>
          <input className="control" type="date" value={fechaDesde} onChange={(e) => { setFechaDesde(e.target.value); setPagina(1); }} />
        </label>

        <label className="campo">
          <span>Hasta</span>
          <input className="control" type="date" value={fechaHasta} onChange={(e) => { setFechaHasta(e.target.value); setPagina(1); }} />
        </label>

        <span className="filtros-conteo numerico">
          {datos.paginacion?.total ?? 0} registros
        </span>
      </div>

      {error && <p className="mensaje-error" role="alert">{error}</p>}

      <section className="turno-movimientos" aria-label="Registros de auditoría">
        <div className="tabla-contenedor">
          <table className="tabla">
            <thead>
              <tr>
                <th scope="col">Fecha</th>
                <th scope="col">Acción</th>
                <th scope="col">Entidad</th>
                <th scope="col">Quién</th>
                <th scope="col">Sobre quién</th>
                <th scope="col">Motivo</th>
              </tr>
            </thead>
            <tbody>
              {cargando && Array.from({ length: 8 }).map((_, i) => (
                <tr key={`esqueleto-${i}`} className="fila-esqueleto">
                  <td colSpan={6}><span className="esqueleto" /></td>
                </tr>
              ))}

              {!cargando && logs.length === 0 && (
                <tr>
                  <td colSpan={6} className="tabla-estado">
                    <p>Ningún registro coincide con esos filtros.</p>
                  </td>
                </tr>
              )}

              {!cargando && logs.map((log) => {
                const abierto = expandido === log._id;
                const tieneDetalle = log.datosAnteriores || log.datosNuevos;
                return [
                  <tr
                    key={log._id}
                    className={`fila-clicable${abierto ? ' es-abierta' : ''}`}
                    onClick={() => setExpandido(abierto ? null : log._id)}
                    tabIndex={0}
                    role="button"
                    aria-expanded={abierto}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpandido(abierto ? null : log._id); } }}
                  >
                    <td className="numerico">{fechaHora(log.fecha)}</td>
                    <td>{legible(log.accion)}</td>
                    <td className="texto-sutil">{log.entidad}</td>
                    {/* Muchos registros guardaron solo el DNI, sin el bloque de persona. Un
                        número suelto en una columna que se llama "quién" no se lee como un
                        identificador: se etiqueta. */}
                    <td>
                      {log.actor?.nombre
                        ? nombreDe(log.actor)
                        : (log.usuarioDni
                            ? <span className="texto-sutil">DNI <span className="numerico">{log.usuarioDni}</span></span>
                            : <span className="texto-sutil">—</span>)}
                    </td>
                    <td>{log.afectado ? nombreDe(log.afectado) : <span className="texto-sutil">—</span>}</td>
                    <td className="col-concepto">{log.motivo || <span className="texto-sutil">—</span>}</td>
                  </tr>,

                  abierto && (
                    <tr key={`${log._id}-detalle`} className="fila-detalle">
                      <td colSpan={6}>
                        {tieneDetalle ? (
                          <div className="detalle-cierre">
                            <div>
                              <p className="bloque-titulo">Antes</p>
                              <pre className="detalle-json">{JSON.stringify(log.datosAnteriores, null, 2) ?? '—'}</pre>
                            </div>
                            <div>
                              <p className="bloque-titulo">Después</p>
                              <pre className="detalle-json">{JSON.stringify(log.datosNuevos, null, 2) ?? '—'}</pre>
                            </div>
                          </div>
                        ) : (
                          <p className="texto-sutil">Este registro no guardó datos de detalle.</p>
                        )}
                      </td>
                    </tr>
                  )
                ];
              })}
            </tbody>
          </table>
        </div>
      </section>

      {totalPaginas > 1 && (
        <nav className="paginacion" aria-label="Paginación de auditoría">
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
