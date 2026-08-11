import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listarHistorialSaldos } from '../../services/administracionService';
import { fechaHora, nombreDe, pesos, pesosConSigno } from '../formato';
import '../../styles/caja.css';

// CLIENTES → SALDOS Y TRANSACCIONES. Todo movimiento de saldo prepago, con quién lo hizo.
//
// El saldo es plata de clientes que ya está en la caja: cada movimiento se audita y esta es
// la pantalla donde ese rastro se lee. La columna que importa es el delta, no el saldo final.
export default function Saldos() {
  const [datos, setDatos] = useState({ historial: [], pagination: { totalPaginas: 1, total: 0 } });
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [pagina, setPagina] = useState(1);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      setDatos(await listarHistorialSaldos({ pagina, limite: 25 }));
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

  return (
    <div className="pantalla pantalla-turno">
      <header className="turno-encabezado">
        <div>
          <h1 className="pantalla-titulo">Saldos y transacciones</h1>
          <p className="pantalla-bajada">
            Cada cambio de saldo prepago, con su motivo y su responsable. El saldo actual de cada
            cuenta está en <Link to="/admin/clientes">Clientes</Link>.
          </p>
        </div>
      </header>

      {error && <p className="mensaje-error" role="alert">{error}</p>}

      <section className="turno-movimientos" aria-label="Historial de saldos">
        <div className="tabla-contenedor">
          <table className="tabla">
            <thead>
              <tr>
                <th scope="col">Fecha</th>
                <th scope="col">Cliente</th>
                <th scope="col">Motivo</th>
                <th scope="col">Quién</th>
                <th scope="col" className="col-monto">Antes</th>
                <th scope="col" className="col-monto">Cambio</th>
                <th scope="col" className="col-monto">Después</th>
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
                    <p>
                      No hay movimientos de saldo registrados. Con la recarga discontinuada, esta
                      lista solo crece cuando se gasta saldo existente.
                    </p>
                  </td>
                </tr>
              )}

              {!cargando && historial.map((registro) => {
                const anterior = registro.saldoAnterior ?? registro.montoAnterior ?? null;
                const nuevo = registro.saldoNuevo ?? registro.montoNuevo ?? null;
                const delta = anterior != null && nuevo != null ? nuevo - anterior : null;
                return (
                  <tr key={registro._id}>
                    <td className="numerico">{fechaHora(registro.fecha ?? registro.fechaModificacion)}</td>
                    <td>{nombreDe(registro.afectado ?? registro.usuario)}</td>
                    <td className="col-concepto">{registro.motivo || <span className="texto-sutil">—</span>}</td>
                    <td>{nombreDe(registro.actor ?? registro.modificadoPor, registro.usuarioDni ?? '—')}</td>
                    <td className="col-monto numerico">{anterior != null ? pesos(anterior) : '—'}</td>
                    <td className="col-monto numerico">{delta != null ? pesosConSigno(delta) : '—'}</td>
                    <td className="col-monto numerico">{nuevo != null ? pesos(nuevo) : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {totalPaginas > 1 && (
        <nav className="paginacion" aria-label="Paginación de saldos">
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
