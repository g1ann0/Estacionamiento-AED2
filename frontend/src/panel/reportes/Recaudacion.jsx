import { useCallback, useEffect, useMemo, useState } from 'react';
import { reporteRecaudacion } from '../../services/administracionService';
import { ETIQUETA_MEDIO_LARGA, pesos, pesosConSigno } from '../formato';
import '../../styles/caja.css';

const MEDIOS = Object.keys(ETIQUETA_MEDIO_LARGA);

const diaLegible = (dia) => {
  const [anio, mes, numero] = dia.split('-');
  const fecha = new Date(Number(anio), Number(mes) - 1, Number(numero));
  return fecha.toLocaleDateString('es-AR', { weekday: 'short', day: '2-digit', month: '2-digit' });
};

// REPORTES → RECAUDACIÓN. Acá sí hay plata agregada: la caja ciega le oculta el acumulado al
// operador que va a contar el cajón, no al dueño que revisa después.
//
// Es una tabla, no un tablero de gráficos: la pregunta real es "cuánto entró cada día y por
// qué medio", y eso se responde con números alineados. La barra de la primera columna es una
// sola magnitud en un solo tono — sirve para ver la forma de la semana de un vistazo, y el
// número siempre está escrito al lado, así que nada depende del color.
export default function Recaudacion() {
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      setDatos(await reporteRecaudacion({ desde, hasta }));
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }, [desde, hasta]);

  useEffect(() => {
    const id = setTimeout(cargar, 250);
    return () => clearTimeout(id);
  }, [cargar]);

  const maximo = useMemo(
    () => Math.max(1, ...(datos?.dias ?? []).map((dia) => Math.abs(dia.total))),
    [datos]
  );

  return (
    <div className="pantalla pantalla-turno">
      <header className="turno-encabezado">
        <div>
          <h1 className="pantalla-titulo">Recaudación</h1>
          <p className="pantalla-bajada">
            Neto por día: los cobros suman y los egresos de caja restan. Sin filtros muestra los
            últimos 30 días.
          </p>
        </div>
      </header>

      <div className="filtros">
        <label className="campo">
          <span>Desde</span>
          <input className="control" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
        </label>
        <label className="campo">
          <span>Hasta</span>
          <input className="control" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </label>
      </div>

      {error && <p className="mensaje-error" role="alert">{error}</p>}

      {datos && (
        <dl className="turno-tablero">
          <div>
            {/* Neto: cobros menos egresos de caja. El signo va adelante del peso, porque un
                día que cerró en rojo tiene que leerse en rojo desde el primer carácter. */}
            <dt>Neto del período</dt>
            <dd className="numerico">{pesosConSigno(datos.total)}</dd>
          </div>
          <div>
            <dt>Cobrado por estadías</dt>
            <dd className="numerico">{pesos(datos.cobrado ?? 0)}</dd>
          </div>
          <div>
            <dt>Promedio por estadía</dt>
            <dd className="numerico">
              {datos.promedioPorCobro != null ? pesos(datos.promedioPorCobro) : '—'}
            </dd>
          </div>
          <div>
            <dt>Días con movimiento</dt>
            <dd className="numerico">{datos.dias.length}</dd>
          </div>
        </dl>
      )}

      <section className="turno-movimientos" aria-label="Recaudación por día">
        <div className="tabla-contenedor">
          <table className="tabla">
            <thead>
              <tr>
                <th scope="col">Día</th>
                <th scope="col" className="col-magnitud">Neto</th>
                {MEDIOS.map((medio) => (
                  <th key={medio} scope="col" className="col-monto">{ETIQUETA_MEDIO_LARGA[medio]}</th>
                ))}
                <th scope="col" className="col-monto">Cobros</th>
              </tr>
            </thead>
            <tbody>
              {cargando && Array.from({ length: 6 }).map((_, i) => (
                <tr key={`esqueleto-${i}`} className="fila-esqueleto">
                  <td colSpan={MEDIOS.length + 3}><span className="esqueleto" /></td>
                </tr>
              ))}

              {!cargando && datos?.dias.length === 0 && (
                <tr>
                  <td colSpan={MEDIOS.length + 3} className="tabla-estado">
                    <p>No hubo movimientos de caja en este período.</p>
                  </td>
                </tr>
              )}

              {!cargando && datos?.dias.map((dia) => (
                <tr key={dia.dia}>
                  <td className="numerico">{diaLegible(dia.dia)}</td>
                  <td className="col-magnitud">
                    {/* La barra es una ayuda de lectura, no el dato: el importe va escrito al
                        lado y la barra queda fuera del árbol de accesibilidad. */}
                    <span className="magnitud">
                      <span
                        className="magnitud-barra"
                        style={{ '--proporcion': `${(Math.abs(dia.total) / maximo) * 100}%` }}
                        aria-hidden
                      />
                      <span className="numerico magnitud-valor">{pesosConSigno(dia.total)}</span>
                    </span>
                  </td>
                  {MEDIOS.map((medio) => (
                    <td key={medio} className="col-monto numerico">
                      {dia.porMedio[medio] ? pesosConSigno(dia.porMedio[medio]) : <span className="texto-sutil">—</span>}
                    </td>
                  ))}
                  <td className="col-monto numerico">{dia.cobros}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
