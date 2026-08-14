import { useCallback, useEffect, useState } from 'react';
import { listarFeriados, crearFeriado, eliminarFeriado } from '../../services/feriadoService';
import '../../styles/caja.css';

// CONFIGURACIÓN → FERIADOS. Qué días llevan recargo.
//
// La lista se carga a mano y no se importa de ningún calendario: el que importa acá no es solo
// el nacional. Un feriado provincial, una fiesta local o el día del recital que llena la playa
// cambian la tarifa igual, y una lista automática que dice lo contrario que la realidad es
// peor que no tener lista.
//
// Cuánto se recarga NO se decide acá: eso vive en cada tarifa (Tarifas → Recargos → Feriado).
// Separarlo permite cargar el año entero sin decidir todavía el porcentaje, y cambiar el
// porcentaje una vez sin tocar los 15 días.
export default function Feriados() {
  const [feriados, setFeriados] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [aviso, setAviso] = useState(null);

  const [fecha, setFecha] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      setFeriados(await listarFeriados());
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const agregar = async (evento) => {
    evento.preventDefault();
    if (!fecha) return;
    setGuardando(true);
    setError(null);
    try {
      await crearFeriado({ fecha, descripcion: descripcion.trim() });
      setAviso(`${fechaLegible(fecha)} agregado`);
      setFecha('');
      setDescripcion('');
      await cargar();
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  };

  const quitar = async (feriado) => {
    setError(null);
    try {
      await eliminarFeriado(feriado.fecha);
      setAviso(`${fechaLegible(feriado.fecha)} eliminado`);
      await cargar();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="pantalla pantalla-turno">
      <header className="turno-encabezado">
        <div>
          <h1 className="pantalla-titulo">Feriados</h1>
          <p className="pantalla-bajada">
            Los días con recargo. Cuánto se recarga se define en cada tarifa; acá se dice qué días son.
          </p>
        </div>
      </header>

      {error && <p className="mensaje-error" role="alert">{error}</p>}
      {aviso && <p className="mensaje-exito" role="status">{aviso}</p>}

      <form className="filtros" onSubmit={agregar}>
        <label className="campo">
          <span>Fecha</span>
          <input className="control" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} disabled={guardando} required />
        </label>
        <label className="campo">
          <span>Motivo <em>opcional</em></span>
          <input
            className="control"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Ej: Día de la Independencia"
            disabled={guardando}
          />
        </label>
        <button type="submit" className="boton-primario" disabled={guardando || !fecha}>
          {guardando ? 'Agregando…' : 'Agregar'}
        </button>
      </form>

      <section className="turno-movimientos" aria-label="Feriados cargados">
        <div className="tabla-contenedor">
          <table className="tabla">
            <thead>
              <tr>
                <th scope="col">Fecha</th>
                <th scope="col">Día</th>
                <th scope="col">Motivo</th>
                <th scope="col" className="col-monto">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {cargando && Array.from({ length: 4 }).map((_, i) => (
                <tr key={`esqueleto-${i}`} className="fila-esqueleto"><td colSpan={4}><span className="esqueleto" /></td></tr>
              ))}

              {!cargando && feriados.length === 0 && (
                <tr>
                  <td colSpan={4} className="tabla-estado">
                    <p>
                      No hay feriados cargados de este año en adelante. Sin ellos, el recargo por
                      feriado de las tarifas no se aplica nunca.
                    </p>
                  </td>
                </tr>
              )}

              {!cargando && feriados.map((feriado) => (
                <tr key={feriado.fecha}>
                  <td className="numerico">{fechaLegible(feriado.fecha)}</td>
                  <td>{diaDeLaSemana(feriado.fecha)}</td>
                  <td>{feriado.descripcion || <span className="texto-sutil">—</span>}</td>
                  <td>
                    <div className="acciones-fila">
                      <button type="button" className="boton-secundario" onClick={() => quitar(feriado)}>
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

// La fecha viene como AAAA-MM-DD y se arma en hora local: `new Date('2026-05-25')` es medianoche
// UTC, o sea el 24 a las 21:00 acá, y la pantalla mostraría el día anterior al cargado.
const comoFechaLocal = (fecha) => {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  return new Date(anio, mes - 1, dia);
};

const fechaLegible = (fecha) => comoFechaLocal(fecha).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });

const diaDeLaSemana = (fecha) => {
  const nombre = comoFechaLocal(fecha).toLocaleDateString('es-AR', { weekday: 'long' });
  return nombre.charAt(0).toUpperCase() + nombre.slice(1);
};
