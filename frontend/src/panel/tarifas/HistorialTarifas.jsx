import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listarHistorialTarifas } from '../../services/tarifaService';
import { fechaHora, nombreDe, pesos } from '../formato';
import '../../styles/caja.css';

// HISTORIAL DE TARIFAS — el rastro de precio que exige el principio "todo cambio sensible deja
// rastro". Los datos salen de AuditLog (antes LogPrecio, consolidado en la poda).
//
// La columna que importa es el salto: de cuánto a cuánto. Un historial que solo muestra el
// precio nuevo obliga a leer la fila de abajo para entender qué pasó.
export default function HistorialTarifas() {
  const [datos, setDatos] = useState({ historial: [], pagination: { total: 0, totalPaginas: 1 } });
  const [pagina, setPagina] = useState(1);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      setDatos(await listarHistorialTarifas({ pagina }));
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }, [pagina]);

  useEffect(() => { cargar(); }, [cargar]);

  const { historial } = datos;
  const totalPaginas = Math.max(1, datos.pagination?.totalPaginas ?? 1);

  const variacion = (registro) => {
    if (registro.precioAnterior == null) return <span className="chip">Alta</span>;
    if (registro.precioNuevo == null) return <span className="chip chip-alerta">Baja</span>;
    const delta = registro.precioNuevo - registro.precioAnterior;
    if (delta === 0) return <span className="texto-sutil">Sin cambio de precio</span>;
    const porcentaje = Math.round((delta / registro.precioAnterior) * 100);
    return <span className="numerico">{delta > 0 ? '+' : '−'}{Math.abs(porcentaje)}%</span>;
  };

  return (
    <div className="pantalla pantalla-turno">
      <header className="turno-encabezado">
        <div>
          <h1 className="pantalla-titulo">Historial de tarifas</h1>
          <p className="pantalla-bajada">Cada alta, cambio y baja de precio, con quién lo hizo y cuándo.</p>
        </div>
        <div className="turno-acciones">
          <Link className="boton-secundario" to="/admin/tarifas">Volver a tarifas</Link>
        </div>
      </header>

      {error && <p className="mensaje-error" role="alert">{error}</p>}

      <section className="turno-movimientos" aria-label="Cambios de tarifas">
        <div className="tabla-contenedor">
          <table className="tabla">
            <thead>
              <tr>
                <th scope="col">Fecha</th>
                <th scope="col">Tarifa</th>
                <th scope="col" className="col-monto">Antes</th>
                <th scope="col" className="col-monto">Después</th>
                <th scope="col" className="col-monto">Variación</th>
                <th scope="col">Quién</th>
                <th scope="col">Motivo</th>
              </tr>
            </thead>
            <tbody>
              {cargando && Array.from({ length: 6 }).map((_, i) => (
                <tr key={`esqueleto-${i}`} className="fila-esqueleto">
                  <td colSpan={7}><span className="esqueleto" /></td>
                </tr>
              ))}

              {!cargando && historial.length === 0 && (
                <tr>
                  <td colSpan={7} className="tabla-estado">
                    <p>Todavía no se registró ningún cambio de tarifa.</p>
                  </td>
                </tr>
              )}

              {!cargando && historial.map((registro) => (
                <tr key={registro._id}>
                  <td className="numerico">{fechaHora(registro.fechaModificacion)}</td>
                  <td>{registro.tipoUsuario?.replace(/_/g, ' ')}</td>
                  <td className="col-monto numerico">
                    {registro.precioAnterior == null ? <span className="texto-sutil">—</span> : pesos(registro.precioAnterior)}
                  </td>
                  <td className="col-monto numerico">
                    {registro.precioNuevo == null ? <span className="texto-sutil">—</span> : pesos(registro.precioNuevo)}
                  </td>
                  <td className="col-monto">{variacion(registro)}</td>
                  <td>{nombreDe(registro.modificadoPor, registro.modificadoPor?.dni ?? '—')}</td>
                  <td className="col-concepto">{registro.motivo || <span className="texto-sutil">—</span>}</td>
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
