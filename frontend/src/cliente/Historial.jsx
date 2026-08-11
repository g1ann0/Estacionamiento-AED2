import { useCallback, useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { misEstadias, descargarMiComprobante } from '../services/conductorService';
import { duracionEntre, fecha, hora, pesos } from '../panel/formato';
import '../styles/panelConductor.css';

const numeroDe = (c) => `${c.puntoVenta}-${String(c.numero).padStart(8, '0')}`;

// HISTORIAL DEL CONDUCTOR. Cada estadía como una fila de vida propia, no como una tabla:
// en un celular una tabla de siete columnas obliga a scrollear de costado para leer un dato.
//
// La pantalla anterior mostraba "transacciones" —el modelo espejo de la estadía— y tenía
// `http://localhost:3000` escrito a mano en sus tres consultas, así que fuera de la máquina
// del desarrollador no cargaba nada.
export default function Historial() {
  const [datos, setDatos] = useState({ estadias: [], total: 0, totalPaginas: 1 });
  const [pagina, setPagina] = useState(1);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      setDatos(await misEstadias({ pagina }));
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }, [pagina]);

  useEffect(() => { cargar(); }, [cargar]);

  const bajar = async (comprobante) => {
    try {
      await descargarMiComprobante(comprobante._id, `comprobante_${numeroDe(comprobante)}.pdf`);
    } catch (e) {
      setError(e.message);
    }
  };

  const { estadias, total, totalPaginas } = datos;

  return (
    <div className="conductor">
      <h1 className="cliente-titulo">Tu historial</h1>

      {error && <p className="cliente-error" role="alert">{error}</p>}

      {cargando && <p className="conductor-cargando">Cargando tus estadías…</p>}

      {!cargando && estadias.length === 0 && (
        <p className="conductor-vacio">
          Todavía no tenés estadías registradas. La primera aparece acá apenas dejes el auto en
          la playa.
        </p>
      )}

      {!cargando && estadias.length > 0 && (
        <>
          <p className="cliente-etiqueta">{total} {total === 1 ? 'estadía' : 'estadías'}</p>

          <ul className="estadias">
            {estadias.map((estadia) => {
              const abierta = estadia.estado === 'activo';
              return (
                <li key={estadia._id} className="estadia">
                  <div className="estadia-fila">
                    <span className="chapa estadia-patente">{estadia.vehiculoDominio}</span>
                    {abierta
                      ? <span className="vehiculo-estado">En la playa</span>
                      : <span className="numerico estadia-monto">
                          {estadia.montoTotal != null ? pesos(estadia.montoTotal) : '—'}
                        </span>}
                  </div>

                  <p className="estadia-detalle numerico">
                    {fecha(estadia.horaInicio)} · {hora(estadia.horaInicio)}
                    {estadia.horaFin && <> → {hora(estadia.horaFin)}</>}
                    {estadia.horaFin && <> · {duracionEntre(estadia.horaInicio, estadia.horaFin)}</>}
                  </p>

                  {estadia.origen === 'excepcion' && (
                    <p className="estadia-nota">
                      Se cobró como estadía no registrada: el vehículo salió sin registro de ingreso.
                    </p>
                  )}

                  {estadia.comprobante && (
                    <button type="button" className="estadia-comprobante" onClick={() => bajar(estadia.comprobante)}>
                      <Download size={15} aria-hidden />
                      Comprobante {numeroDe(estadia.comprobante)}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>

          {totalPaginas > 1 && (
            <nav className="conductor-paginacion" aria-label="Paginación del historial">
              <button
                type="button"
                className="cliente-boton cliente-boton-secundario"
                onClick={() => setPagina((p) => Math.max(1, p - 1))}
                disabled={pagina === 1}
              >
                Anterior
              </button>
              <span className="numerico">{pagina} de {totalPaginas}</span>
              <button
                type="button"
                className="cliente-boton cliente-boton-secundario"
                onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
                disabled={pagina === totalPaginas}
              >
                Siguiente
              </button>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
