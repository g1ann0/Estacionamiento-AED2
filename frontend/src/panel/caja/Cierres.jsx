import { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { listarTurnos, obtenerResumenCierre } from '../../services/turnoService';
import { reporteCierres } from '../../services/administracionService';
import { ETIQUETA_MEDIO_LARGA, fechaHora, nombreDe, pesos, pesosConSigno } from '../formato';
import '../../styles/caja.css';

const POR_PAGINA = 20;
const TODOS = 'todos';

// CIERRES — la contracara administrativa de la caja ciega: acá sí está todo, porque quien
// mira ya no es quien contó. Cada fila es un arqueo cerrado y la diferencia es la columna
// que se busca; el detalle abre el desglose por medio de pago sin cambiar de pantalla.
//
// Los filtros y el acumulado son la Etapa 7.1: la pregunta del dueño no es "qué pasó en este
// turno" sino "quién viene teniendo diferencias". Faltante y sobrante van separados y los dos
// en positivo, porque un neto en cero puede esconder un faltante y un sobrante del mismo
// tamaño, que es justo el caso que hay que mirar.
export default function Cierres() {
  const { cajas } = useOutletContext();

  const [turnos, setTurnos] = useState([]);
  const [pagina, setPagina] = useState(1);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [total, setTotal] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const [cajaId, setCajaId] = useState(TODOS);
  const [operadorId, setOperadorId] = useState(TODOS);
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');

  const [resumen, setResumen] = useState(null);

  const [seleccionado, setSeleccionado] = useState(null);
  const [detalle, setDetalle] = useState(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);

  const nombreCaja = useMemo(() => {
    const mapa = new Map((cajas ?? []).map((caja) => [caja._id, caja.nombre]));
    return (id) => mapa.get(id) ?? 'Caja';
  }, [cajas]);

  // Los filtros de servidor viajan iguales a las dos consultas: las filas y el acumulado
  // tienen que hablar del mismo universo o el total de la pantalla no es el de la tabla.
  const filtros = useMemo(() => ({
    cajaId: cajaId === TODOS ? '' : cajaId,
    operadorId: operadorId === TODOS ? '' : operadorId,
    desde,
    hasta
  }), [cajaId, operadorId, desde, hasta]);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      // Cerrados y anulados: un arqueo anulado sigue siendo un arqueo, y es el que más
      // se busca. Los turnos abiertos no entran — esos se miran en Turno actual.
      const [datos, acumulado] = await Promise.all([
        listarTurnos({ estado: 'cerrado,anulado', pagina, limite: POR_PAGINA, ...filtros }),
        reporteCierres(filtros)
      ]);
      setTurnos(datos.turnos);
      setTotal(datos.total);
      setTotalPaginas(Math.max(1, datos.totalPaginas));
      setResumen(acumulado);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }, [pagina, filtros]);

  useEffect(() => { cargar(); }, [cargar]);

  // El selector de operadores se arma con quienes efectivamente cerraron turnos, no con el
  // padrón entero: un desplegable con clientes que nunca tocaron una caja no ayuda a nadie.
  // Se conserva el último listado no vacío para que filtrar por un operador no vacíe la
  // lista que permitiría volver a "Todos" con otro filtro puesto.
  const [operadores, setOperadores] = useState([]);
  useEffect(() => {
    if (operadorId !== TODOS) return;
    const desdeReporte = (resumen?.porOperador ?? [])
      .map((fila) => fila.operador)
      .filter((operador) => operador?._id);
    if (desdeReporte.length > 0) setOperadores(desdeReporte);
  }, [resumen, operadorId]);

  const cambiarFiltro = (setter) => (valor) => { setter(valor); setPagina(1); setSeleccionado(null); };

  const hayFiltros = cajaId !== TODOS || operadorId !== TODOS || Boolean(desde) || Boolean(hasta);
  const limpiarFiltros = () => {
    setCajaId(TODOS);
    setOperadorId(TODOS);
    setDesde('');
    setHasta('');
    setPagina(1);
    setSeleccionado(null);
  };

  const abrirDetalle = async (turno) => {
    if (seleccionado === turno._id) { setSeleccionado(null); setDetalle(null); return; }
    setSeleccionado(turno._id);
    setDetalle(null);
    setCargandoDetalle(true);
    try {
      setDetalle(await obtenerResumenCierre(turno._id));
    } catch (e) {
      setDetalle({ error: e.message });
    } finally {
      setCargandoDetalle(false);
    }
  };

  return (
    <div className="pantalla pantalla-turno">
      <header className="turno-encabezado">
        <div>
          <h1 className="pantalla-titulo">Cierres de caja</h1>
          <p className="pantalla-bajada">
            Turnos cerrados, con su arqueo completo. Sin fechas se muestra toda la historia.
          </p>
        </div>
      </header>

      <div className="filtros">
        <label className="campo">
          <span>Caja</span>
          <select className="control" value={cajaId} onChange={(e) => cambiarFiltro(setCajaId)(e.target.value)}>
            <option value={TODOS}>Todas</option>
            {(cajas ?? []).map((caja) => (
              <option key={caja._id} value={caja._id}>{caja.nombre}</option>
            ))}
          </select>
        </label>

        <label className="campo">
          <span>Operador</span>
          <select className="control" value={operadorId} onChange={(e) => cambiarFiltro(setOperadorId)(e.target.value)}>
            <option value={TODOS}>Todos</option>
            {operadores.map((operador) => (
              <option key={operador._id} value={operador._id}>{nombreDe(operador)}</option>
            ))}
          </select>
        </label>

        <label className="campo">
          <span>Desde</span>
          <input className="control" type="date" value={desde} onChange={(e) => cambiarFiltro(setDesde)(e.target.value)} />
        </label>

        <label className="campo">
          <span>Hasta</span>
          <input className="control" type="date" value={hasta} onChange={(e) => cambiarFiltro(setHasta)(e.target.value)} />
        </label>

        <span className="filtros-conteo numerico">
          {total} {total === 1 ? 'cierre' : 'cierres'}
        </span>
      </div>

      {/* El acumulado excluye los turnos anulados: siguen listados abajo —hay que poder
          encontrarlos— pero su diferencia ya no es plata que falte. */}
      {resumen && (
        <dl className="turno-tablero">
          <div>
            <dt>Turnos cerrados</dt>
            <dd className="numerico">{resumen.totales.turnos}</dd>
          </div>
          <div>
            <dt>Con diferencia</dt>
            <dd className="numerico">{resumen.totales.conDiferencia}</dd>
          </div>
          <div>
            <dt>Faltante acumulado</dt>
            <dd className={`numerico${resumen.totales.faltante ? ' hay-diferencia' : ''}`}>
              {pesos(resumen.totales.faltante)}
            </dd>
          </div>
          <div>
            <dt>Sobrante acumulado</dt>
            <dd className={`numerico${resumen.totales.sobrante ? ' hay-diferencia' : ''}`}>
              {pesos(resumen.totales.sobrante)}
            </dd>
          </div>
        </dl>
      )}

      {resumen && resumen.porOperador.length > 1 && operadorId === TODOS && (
        <section className="turno-movimientos bloque-resumen" aria-label="Diferencias por operador">
          <h2 className="pantalla-subtitulo">Por operador</h2>
          <div className="tabla-contenedor">
            <table className="tabla">
              <thead>
                <tr>
                  <th scope="col">Operador</th>
                  <th scope="col" className="col-monto">Turnos</th>
                  <th scope="col" className="col-monto">Con diferencia</th>
                  <th scope="col" className="col-monto">Faltante</th>
                  <th scope="col" className="col-monto">Sobrante</th>
                  <th scope="col" className="col-monto">Neto</th>
                </tr>
              </thead>
              <tbody>
                {resumen.porOperador.map((fila) => (
                  <tr
                    key={fila._id}
                    className="fila-clicable"
                    onClick={() => cambiarFiltro(setOperadorId)(fila._id)}
                    tabIndex={0}
                    role="button"
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); cambiarFiltro(setOperadorId)(fila._id); } }}
                  >
                    <td>{nombreDe(fila.operador)}</td>
                    <td className="col-monto numerico">{fila.turnos}</td>
                    <td className="col-monto numerico">{fila.conDiferencia}</td>
                    <td className={`col-monto numerico${fila.faltante ? ' hay-diferencia' : ''}`}>{pesos(fila.faltante)}</td>
                    <td className={`col-monto numerico${fila.sobrante ? ' hay-diferencia' : ''}`}>{pesos(fila.sobrante)}</td>
                    <td className={`col-monto numerico${fila.diferenciaNeta ? ' hay-diferencia' : ''}`}>{pesosConSigno(fila.diferenciaNeta)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="turno-movimientos" aria-label="Turnos cerrados">
        <div className="tabla-contenedor">
          <table className="tabla">
            <thead>
              <tr>
                <th scope="col">Turno</th>
                <th scope="col">Caja</th>
                <th scope="col">Operador</th>
                <th scope="col">Apertura</th>
                <th scope="col">Cierre</th>
                <th scope="col" className="col-monto">Esperado</th>
                <th scope="col" className="col-monto">Contado</th>
                <th scope="col" className="col-monto">Diferencia</th>
              </tr>
            </thead>
            <tbody>
              {cargando && Array.from({ length: 6 }).map((_, i) => (
                <tr key={`esqueleto-${i}`} className="fila-esqueleto">
                  <td colSpan={8}><span className="esqueleto" /></td>
                </tr>
              ))}

              {!cargando && error && (
                <tr>
                  <td colSpan={8} className="tabla-estado">
                    <p>{error}</p>
                    <button type="button" className="boton-secundario" onClick={cargar}>Reintentar</button>
                  </td>
                </tr>
              )}

              {!cargando && !error && turnos.length === 0 && (
                <tr>
                  <td colSpan={8} className="tabla-estado">
                    {/* Vacío por filtro y vacío de verdad son dos cosas distintas: decirle
                        "todavía no se cerró ningún turno" a quien filtró por una semana sin
                        movimiento lo manda a buscar un bug que no existe. */}
                    <p>
                      {hayFiltros
                        ? 'No hay cierres que coincidan con estos filtros.'
                        : 'Todavía no se cerró ningún turno. El primer arqueo aparece acá apenas se cierre.'}
                    </p>
                    {hayFiltros && (
                      <button type="button" className="boton-secundario" onClick={limpiarFiltros}>
                        Limpiar filtros
                      </button>
                    )}
                  </td>
                </tr>
              )}

              {!cargando && !error && turnos.map((turno) => {
                const abierto = seleccionado === turno._id;
                return [
                  <tr
                    key={turno._id}
                    className={`fila-clicable${abierto ? ' es-abierta' : ''}`}
                    onClick={() => abrirDetalle(turno)}
                    tabIndex={0}
                    role="button"
                    aria-expanded={abierto}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrirDetalle(turno); } }}
                  >
                    <td className="numerico">
                      #{turno.numero}
                      {turno.estado === 'anulado' && <span className="chip chip-alerta">Anulado</span>}
                    </td>
                    <td>{nombreCaja(turno.cajaId)}</td>
                    <td>{nombreDe(turno.operadorId)}</td>
                    <td className="numerico">{fechaHora(turno.fechaApertura)}</td>
                    <td className="numerico">{turno.fechaCierre ? fechaHora(turno.fechaCierre) : '—'}</td>
                    <td className="col-monto numerico">{pesos(turno.montoEsperadoCierre)}</td>
                    <td className="col-monto numerico">{pesos(turno.montoDeclaradoCierre)}</td>
                    {/* Cero no es un logro: es neutro. Solo la diferencia distinta de cero se
                        marca, y en ámbar, porque pide revisión, no alarma. */}
                    <td className={`col-monto numerico${turno.diferencia ? ' hay-diferencia' : ''}`}>
                      {pesosConSigno(turno.diferencia ?? 0)}
                    </td>
                  </tr>,

                  abierto && (
                    <tr key={`${turno._id}-detalle`} className="fila-detalle">
                      <td colSpan={8}>
                        {cargandoDetalle && <p className="texto-sutil">Cargando el arqueo…</p>}
                        {detalle?.error && <p className="mensaje-error" role="alert">{detalle.error}</p>}
                        {detalle && !detalle.error && (
                          <div className="detalle-cierre">
                            <dl className="cierre-resumen">
                              <div><dt>Fondo inicial</dt><dd className="numerico">{pesos(detalle.montoInicial)}</dd></div>
                              {Object.entries(detalle.totalPorMedioPago).map(([medio, monto]) => (
                                <div key={medio}><dt>{ETIQUETA_MEDIO_LARGA[medio] ?? medio}</dt><dd className="numerico">{pesosConSigno(monto)}</dd></div>
                              ))}
                              <div><dt>Estadías cobradas</dt><dd className="numerico">{detalle.totalEstadias}</dd></div>
                              <div><dt>Total cobrado</dt><dd className="numerico">{pesos(detalle.totalCobrado)}</dd></div>
                            </dl>
                            <p className="detalle-observacion">
                              <span>Observación del cierre</span>
                              {turno.observacionCierre?.trim() || 'Sin observación.'}
                            </p>
                          </div>
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
        <nav className="paginacion" aria-label="Paginación de cierres">
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
