import { ETIQUETA_MEDIO_LARGA, ETIQUETA_ORIGEN, hora, pesosConSigno } from '../formato';

// Movimientos del turno. Cada fila muestra su monto —el operador acaba de cobrarlos, taparlos
// sería teatro— pero la tabla NO tiene fila de total ni subtotales: eso es lo que la caja
// ciega protege. Los totales aparecen recién en el paso 2 del cierre.
export default function TablaMovimientos({ movimientos, cargando, error, onReintentar, vacio }) {
  return (
    <div className="tabla-contenedor">
      <table className="tabla">
        <thead>
          <tr>
            <th scope="col">Hora</th>
            <th scope="col">Tipo</th>
            <th scope="col">Medio</th>
            <th scope="col">Concepto</th>
            <th scope="col" className="col-monto">Monto</th>
          </tr>
        </thead>
        <tbody>
          {cargando && Array.from({ length: 5 }).map((_, i) => (
            <tr key={`esqueleto-${i}`} className="fila-esqueleto">
              <td colSpan={5}><span className="esqueleto" /></td>
            </tr>
          ))}

          {!cargando && error && (
            <tr>
              <td colSpan={5} className="tabla-estado">
                <p>{error}</p>
                <button type="button" className="boton-secundario" onClick={onReintentar}>Reintentar</button>
              </td>
            </tr>
          )}

          {!cargando && !error && movimientos.length === 0 && (
            <tr><td colSpan={5} className="tabla-estado"><p>{vacio}</p></td></tr>
          )}

          {!cargando && !error && movimientos.map((mov) => {
            const monto = mov.tipo === 'ingreso' ? mov.monto : -mov.monto;
            const concepto = mov.origen === 'cobro_estadia'
              ? `Estadía ${mov.estadiaId?.vehiculoDominio ?? ''}`.trim()
              : mov.motivo;

            return (
              <tr key={mov._id} className={mov.anulado ? 'fila-anulada' : undefined}>
                <td className="numerico">{hora(mov.fecha)}</td>
                <td>{ETIQUETA_ORIGEN[mov.origen] ?? mov.origen}</td>
                <td>{ETIQUETA_MEDIO_LARGA[mov.medioPago] ?? mov.medioPago}</td>
                <td className="col-concepto">
                  {concepto || <span className="texto-sutil">Sin concepto</span>}
                  {mov.anulado && <span className="chip chip-alerta">Anulado</span>}
                </td>
                <td className={`col-monto numerico${monto < 0 ? ' es-egreso' : ''}`}>{pesosConSigno(monto)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
