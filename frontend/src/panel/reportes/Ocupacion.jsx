import { useCallback, useEffect, useMemo, useState } from 'react';
import { reporteOcupacion } from '../../services/administracionService';
import '../../styles/caja.css';

const diaLegible = (dia) => {
  const [anio, mes, numero] = dia.split('-');
  const fecha = new Date(Number(anio), Number(mes) - 1, Number(numero));
  return fecha.toLocaleDateString('es-AR', { weekday: 'short', day: '2-digit', month: '2-digit' });
};

const duracion = (minutos) => {
  if (minutos == null) return '—';
  return `${Math.floor(minutos / 60)}h ${String(Math.round(minutos % 60)).padStart(2, '0')}m`;
};

// REPORTES → OCUPACIÓN. Movimiento de la playa por día: cuántos entraron, cuántos salieron y
// cuánto se quedaron. Sin plata: para eso está Recaudación.
export default function Ocupacion() {
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      setDatos(await reporteOcupacion({ desde, hasta }));
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
    () => Math.max(1, ...(datos?.dias ?? []).map((dia) => Math.max(dia.ingresos, dia.egresos))),
    [datos]
  );

  return (
    <div className="pantalla pantalla-turno">
      <header className="turno-encabezado">
        <div>
          <h1 className="pantalla-titulo">Ocupación</h1>
          <p className="pantalla-bajada">
            Movimiento de la playa por día. Sin filtros muestra los últimos 30 días.
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
            <dt>Adentro ahora</dt>
            <dd className="numerico">{datos.dentroAhora}</dd>
          </div>
          <div>
            <dt>Ingresos del período</dt>
            <dd className="numerico">{datos.totalIngresos}</dd>
          </div>
          <div>
            <dt>Egresos del período</dt>
            <dd className="numerico">{datos.totalEgresos}</dd>
          </div>
          <div>
            <dt>Turnos abiertos</dt>
            <dd className="numerico">{datos.turnos}</dd>
          </div>
        </dl>
      )}

      <section className="turno-movimientos" aria-label="Ocupación por día">
        <div className="tabla-contenedor">
          <table className="tabla">
            <thead>
              <tr>
                <th scope="col">Día</th>
                <th scope="col" className="col-magnitud">Ingresos</th>
                <th scope="col" className="col-monto">Egresos</th>
                <th scope="col" className="col-monto">Estadía promedio</th>
              </tr>
            </thead>
            <tbody>
              {cargando && Array.from({ length: 6 }).map((_, i) => (
                <tr key={`esqueleto-${i}`} className="fila-esqueleto">
                  <td colSpan={4}><span className="esqueleto" /></td>
                </tr>
              ))}

              {!cargando && datos?.dias.length === 0 && (
                <tr>
                  <td colSpan={4} className="tabla-estado">
                    <p>No hubo movimiento de vehículos en este período.</p>
                  </td>
                </tr>
              )}

              {!cargando && datos?.dias.map((dia) => (
                <tr key={dia.dia}>
                  <td className="numerico">{diaLegible(dia.dia)}</td>
                  <td className="col-magnitud">
                    <span className="magnitud">
                      <span
                        className="magnitud-barra"
                        style={{ '--proporcion': `${(dia.ingresos / maximo) * 100}%` }}
                        aria-hidden
                      />
                      <span className="numerico magnitud-valor">{dia.ingresos}</span>
                    </span>
                  </td>
                  <td className="col-monto numerico">{dia.egresos}</td>
                  <td className="col-monto numerico">{duracion(dia.minutosPromedio)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
