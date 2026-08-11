import { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { listarTurnos, obtenerResumenCierre } from '../../services/turnoService';
import { ETIQUETA_MEDIO_LARGA, fechaHora, nombreDe, pesos, pesosConSigno } from '../formato';
import '../../styles/caja.css';

const POR_PAGINA = 20;

// CIERRES — la contracara administrativa de la caja ciega: acá sí está todo, porque quien
// mira ya no es quien contó. Cada fila es un arqueo cerrado y la diferencia es la columna
// que se busca; el detalle abre el desglose por medio de pago sin cambiar de pantalla.
export default function Cierres() {
  const { cajas } = useOutletContext();

  const [turnos, setTurnos] = useState([]);
  const [pagina, setPagina] = useState(1);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const [seleccionado, setSeleccionado] = useState(null);
  const [detalle, setDetalle] = useState(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);

  const nombreCaja = useMemo(() => {
    const mapa = new Map((cajas ?? []).map((caja) => [caja._id, caja.nombre]));
    return (id) => mapa.get(id) ?? 'Caja';
  }, [cajas]);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      // Cerrados y anulados: un arqueo anulado sigue siendo un arqueo, y es el que más
      // se busca. Los turnos abiertos no entran — esos se miran en Turno actual.
      const datos = await listarTurnos({ estado: 'cerrado,anulado', pagina, limite: POR_PAGINA });
      setTurnos(datos.turnos);
      setTotalPaginas(Math.max(1, datos.totalPaginas));
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }, [pagina]);

  useEffect(() => { cargar(); }, [cargar]);

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
          <p className="pantalla-bajada">Turnos cerrados, con su arqueo completo.</p>
        </div>
      </header>

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
                    <p>Todavía no se cerró ningún turno. El primer arqueo aparece acá apenas se cierre.</p>
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
