import { useCallback, useEffect, useState } from 'react';
import { Download, Mail } from 'lucide-react';
import { listarComprobantes, descargarComprobante, enviarComprobante } from '../../services/comprobanteEstadiaService';
import { ETIQUETA_MEDIO_LARGA, fechaHora, nombreReceptor, pesos } from '../formato';
import DialogoEnviar from './DialogoEnviar';
import '../../styles/caja.css';

const TODOS = '';

const numeroDe = (c) => `${c.puntoVenta}-${String(c.numero).padStart(8, '0')}`;

const ETIQUETA_ESTADO = {
  emitido: 'Emitido',
  pendiente_cae: 'Pendiente CAE',
  error_arca: 'Error ARCA',
  anulado: 'Anulado'
};

// COMPROBANTES DE ESTADÍA — hasta ahora se emitían en cada egreso y no había ninguna pantalla
// para encontrarlos: existían en la base y nadie podía verlos, descargarlos ni reenviarlos.
//
// El comprobante es un ticket NO FISCAL sin CAE. La pantalla lo dice una vez, arriba, y no
// vuelve a mencionarlo en cada fila: decirlo es obligatorio, repetirlo es ruido.
export default function ComprobantesEstadia() {
  const [datos, setDatos] = useState({ comprobantes: [], total: 0, totalPaginas: 1 });
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [aviso, setAviso] = useState(null);

  const [q, setQ] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [medioPago, setMedioPago] = useState(TODOS);
  const [pagina, setPagina] = useState(1);

  const [enviandoDe, setEnviandoDe] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      setDatos(await listarComprobantes({ q, desde, hasta, medioPago, pagina }));
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }, [q, desde, hasta, medioPago, pagina]);

  // La búsqueda espera a que el operador termine de escribir: una llamada por tecla sobre una
  // tabla paginada es tráfico sin ganancia.
  useEffect(() => {
    const id = setTimeout(cargar, 250);
    return () => clearTimeout(id);
  }, [cargar]);

  const bajar = async (comprobante) => {
    try {
      await descargarComprobante(comprobante._id, `comprobante_${numeroDe(comprobante)}.pdf`);
    } catch (e) {
      setError(e.message);
    }
  };

  const mandar = async (email) => {
    setEnviando(true);
    setErrorEnvio(null);
    try {
      const respuesta = await enviarComprobante(enviandoDe._id, email);
      setEnviandoDe(null);
      setAviso(respuesta.mensaje);
    } catch (e) {
      setErrorEnvio(e.message);
    } finally {
      setEnviando(false);
    }
  };

  const { comprobantes, total, totalPaginas } = datos;

  return (
    <div className="pantalla pantalla-turno">
      {aviso && (
        <p className="mensaje-exito" role="status">
          {aviso}
          <button type="button" className="mensaje-cerrar" onClick={() => setAviso(null)} aria-label="Cerrar">×</button>
        </p>
      )}

      <header className="turno-encabezado">
        <div>
          <h1 className="pantalla-titulo">Comprobantes de estadía</h1>
          <p className="pantalla-bajada">
            Cada cobro emite un ticket numerado por talonario. Son documentos <strong>no fiscales</strong>,
            sin CAE: la emisión fiscal electrónica todavía no está habilitada.
          </p>
        </div>
      </header>

      <div className="filtros">
        <label className="campo">
          <span>Buscar</span>
          <input
            className="control"
            value={q}
            onChange={(e) => { setQ(e.target.value); setPagina(1); }}
            placeholder="Patente o número"
            autoComplete="off"
          />
        </label>

        <label className="campo">
          <span>Desde</span>
          <input className="control" type="date" value={desde} onChange={(e) => { setDesde(e.target.value); setPagina(1); }} />
        </label>

        <label className="campo">
          <span>Hasta</span>
          <input className="control" type="date" value={hasta} onChange={(e) => { setHasta(e.target.value); setPagina(1); }} />
        </label>

        <label className="campo">
          <span>Medio</span>
          <select className="control" value={medioPago} onChange={(e) => { setMedioPago(e.target.value); setPagina(1); }}>
            <option value={TODOS}>Todos</option>
            {Object.entries(ETIQUETA_MEDIO_LARGA).map(([valor, etiqueta]) => (
              <option key={valor} value={valor}>{etiqueta}</option>
            ))}
          </select>
        </label>

        <span className="filtros-conteo numerico">
          {total} {total === 1 ? 'comprobante' : 'comprobantes'}
        </span>
      </div>

      {error && <p className="mensaje-error" role="alert">{error}</p>}

      <section className="turno-movimientos" aria-label="Comprobantes emitidos">
        <div className="tabla-contenedor">
          <table className="tabla">
            <thead>
              <tr>
                <th scope="col">Número</th>
                <th scope="col">Emitido</th>
                <th scope="col">Patente</th>
                <th scope="col">Receptor</th>
                <th scope="col">Medio</th>
                <th scope="col" className="col-monto">Total</th>
                <th scope="col" className="col-accion"><span className="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              {cargando && Array.from({ length: 6 }).map((_, i) => (
                <tr key={`esqueleto-${i}`} className="fila-esqueleto">
                  <td colSpan={7}><span className="esqueleto" /></td>
                </tr>
              ))}

              {!cargando && comprobantes.length === 0 && (
                <tr>
                  <td colSpan={7} className="tabla-estado">
                    <p>
                      {q || desde || hasta || medioPago
                        ? 'Ningún comprobante coincide con esos filtros.'
                        : 'Todavía no se emitió ningún comprobante. El primero sale con el primer cobro.'}
                    </p>
                  </td>
                </tr>
              )}

              {!cargando && comprobantes.map((c) => (
                <tr key={c._id} className={c.estado === 'anulado' ? 'fila-anulada' : undefined}>
                  <td className="numerico">{numeroDe(c)}</td>
                  <td className="numerico">{fechaHora(c.fechaEmision)}</td>
                  <td className="chapa">
                    {c.estadiaId?.vehiculoDominio ?? <span className="texto-sutil">—</span>}
                    {c.estadiaId?.origen === 'excepcion' && <span className="chip chip-alerta">Excepción</span>}
                  </td>
                  <td>
                    {nombreReceptor(c.receptor) ?? <span className="chip">Consumidor final</span>}
                    {c.receptor.tipo === 'clienteOcasional' && <span className="chip">Ocasional</span>}
                  </td>
                  <td>{ETIQUETA_MEDIO_LARGA[c.medioPago] ?? c.medioPago}</td>
                  <td className="col-monto numerico">{pesos(c.total)}</td>
                  <td className="col-accion">
                    <div className="acciones-fila">
                      {c.estado !== 'emitido' && <span className="chip chip-alerta">{ETIQUETA_ESTADO[c.estado]}</span>}
                      <button type="button" className="boton-secundario" onClick={() => bajar(c)}>
                        <Download size={13} aria-hidden /> Descargar
                      </button>
                      <button type="button" className="boton-secundario" onClick={() => { setErrorEnvio(null); setEnviandoDe(c); }}>
                        <Mail size={13} aria-hidden /> Enviar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {totalPaginas > 1 && (
        <nav className="paginacion" aria-label="Paginación de comprobantes">
          <button type="button" className="boton-secundario" onClick={() => setPagina((p) => Math.max(1, p - 1))} disabled={pagina === 1}>
            Anterior
          </button>
          <span className="numerico">Página {pagina} de {totalPaginas}</span>
          <button type="button" className="boton-secundario" onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))} disabled={pagina === totalPaginas}>
            Siguiente
          </button>
        </nav>
      )}

      <DialogoEnviar
        abierto={Boolean(enviandoDe)}
        comprobante={enviandoDe ? numeroDe(enviandoDe) : ''}
        enviando={enviando}
        error={errorEnvio}
        onEnviar={mandar}
        onCerrar={() => setEnviandoDe(null)}
      />
    </div>
  );
}
