import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { listarClientes, listarClientesDeBaja, darDeBajaCliente, reactivarCliente } from '../../services/administracionService';
import { fecha, pesos } from '../formato';
import '../../styles/caja.css';

// CLIENTES. La lista de cuentas registradas: quién es, qué tarifa se le aplica y cuánto saldo
// le queda del circuito viejo de prepago.
//
// La tarifa asignada es la primera de la cascada: si un cliente la tiene, es la que se cobra,
// por encima de su condición de asociado. Por eso la columna está acá y no escondida en un
// detalle — es la explicación de por qué a ese cliente se le cobró lo que se le cobró.
export default function Clientes() {
  const [clientes, setClientes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const [busqueda, setBusqueda] = useState('');
  const [soloConSaldo, setSoloConSaldo] = useState(false);
  const [verBajas, setVerBajas] = useState(false);
  const [aviso, setAviso] = useState(null);

  const [accionando, setAccionando] = useState(false);
  const [porDarDeBaja, setPorDarDeBaja] = useState(null);
  const confirmacion = useRef(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      // Las bajas viven en otra consulta porque el listado normal las excluye. Se traen las
      // dos y se elige cuál mostrar: el toggle no vuelve a pegarle al servidor.
      const [activos, bajas] = await Promise.all([
        listarClientes(),
        listarClientesDeBaja().catch(() => [])
      ]);
      setClientes(verBajas ? bajas : activos);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }, [verBajas]);

  useEffect(() => { cargar(); }, [cargar]);

  const filtrados = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    return clientes.filter((cliente) => {
      if (soloConSaldo && !(cliente.montoDisponible > 0)) return false;
      if (!termino) return true;
      return [cliente.nombre, cliente.apellido, cliente.dni, cliente.email]
        .filter(Boolean)
        .some((campo) => String(campo).toLowerCase().includes(termino));
    });
  }, [clientes, busqueda, soloConSaldo]);

  const saldoTotal = useMemo(
    () => filtrados.reduce((suma, cliente) => suma + (cliente.montoDisponible ?? 0), 0),
    [filtrados]
  );

  const confirmarBaja = async () => {
    setAccionando(true);
    try {
      await darDeBajaCliente(porDarDeBaja.dni);
      confirmacion.current?.close();
      setAviso(`${porDarDeBaja.apellido}, ${porDarDeBaja.nombre} dado de baja`);
      setPorDarDeBaja(null);
      await cargar();
    } catch (e) {
      confirmacion.current?.close();
      setError(e.message);
    } finally {
      setAccionando(false);
    }
  };

  const reactivar = async (cliente) => {
    setAccionando(true);
    try {
      await reactivarCliente(cliente.dni);
      setAviso(`${cliente.apellido}, ${cliente.nombre} reactivado`);
      await cargar();
    } catch (e) {
      setError(e.message);
    } finally {
      setAccionando(false);
    }
  };

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
          <h1 className="pantalla-titulo">Clientes</h1>
          <p className="pantalla-bajada">
            Cuentas registradas. El saldo que ves es del circuito de prepago, que ya no admite
            recargas nuevas: se gasta y no se repone.
          </p>
        </div>
      </header>

      <div className="filtros">
        <label className="campo">
          <span>Buscar</span>
          <input
            className="control"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Nombre, DNI o correo"
            autoComplete="off"
          />
        </label>

        <label className="campo campo-en-linea">
          <input type="checkbox" checked={soloConSaldo} onChange={(e) => setSoloConSaldo(e.target.checked)} />
          <span>Solo con saldo</span>
        </label>

        <label className="campo campo-en-linea">
          <input type="checkbox" checked={verBajas} onChange={(e) => setVerBajas(e.target.checked)} />
          <span>Ver bajas</span>
        </label>

        <span className="filtros-conteo numerico">
          {filtrados.length} {filtrados.length === 1 ? 'cliente' : 'clientes'} · saldo {pesos(saldoTotal)}
        </span>
      </div>

      {error && <p className="mensaje-error" role="alert">{error}</p>}

      <section className="turno-movimientos" aria-label="Clientes registrados">
        <div className="tabla-contenedor">
          <table className="tabla">
            <thead>
              <tr>
                <th scope="col">Cliente</th>
                <th scope="col">DNI</th>
                <th scope="col">Correo</th>
                <th scope="col">Condición</th>
                <th scope="col">Tarifa asignada</th>
                <th scope="col">Alta</th>
                <th scope="col" className="col-monto">Saldo</th>
                <th scope="col" className="col-accion"><span className="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              {cargando && Array.from({ length: 6 }).map((_, i) => (
                <tr key={`esqueleto-${i}`} className="fila-esqueleto">
                  <td colSpan={8}><span className="esqueleto" /></td>
                </tr>
              ))}

              {!cargando && filtrados.length === 0 && (
                <tr>
                  <td colSpan={8} className="tabla-estado">
                    <p>
                      {verBajas
                        ? 'No hay clientes dados de baja.'
                        : (busqueda || soloConSaldo ? 'Ningún cliente coincide.' : 'Todavía no hay clientes registrados.')}
                    </p>
                  </td>
                </tr>
              )}

              {!cargando && filtrados.map((cliente) => (
                <tr key={cliente._id} className={cliente.activo === false ? 'fila-anulada' : undefined}>
                  <td>
                    {cliente.apellido}, {cliente.nombre}
                    {cliente.activo === false && <span className="chip chip-alerta">Baja</span>}
                    {cliente.rol === 'admin' && <span className="chip">Admin</span>}
                  </td>
                  <td className="numerico">{cliente.dni}</td>
                  <td className="col-concepto">
                    {cliente.email}
                    {!cliente.verificado && <span className="chip chip-alerta">Sin verificar</span>}
                  </td>
                  <td>{cliente.asociado ? 'Asociado' : <span className="texto-sutil">No asociado</span>}</td>
                  <td>
                    {cliente.tarifaAsignada
                      ? <strong>{String(cliente.tarifaAsignada).replace(/_/g, ' ')}</strong>
                      : <span className="texto-sutil">Por condición</span>}
                  </td>
                  <td className="numerico">{cliente.fechaRegistro ? fecha(cliente.fechaRegistro) : '—'}</td>
                  <td className="col-monto numerico">
                    {cliente.montoDisponible > 0
                      ? pesos(cliente.montoDisponible)
                      : <span className="texto-sutil">{pesos(0)}</span>}
                  </td>
                  <td className="col-accion">
                    <div className="acciones-fila">
                      {cliente.activo === false ? (
                        <button type="button" className="boton-secundario" onClick={() => reactivar(cliente)} disabled={accionando}>
                          Reactivar
                        </button>
                      ) : cliente.rol !== 'admin' && (
                        /* Un administrador no se puede dar de baja desde acá: el backend lo
                           rechaza y ofrecer el botón sería prometer algo que no va a pasar. */
                        <button
                          type="button"
                          className="boton-secundario"
                          onClick={() => { setPorDarDeBaja(cliente); confirmacion.current?.showModal(); }}
                          disabled={accionando}
                        >
                          Dar de baja
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <dialog ref={confirmacion} className="dialogo" aria-labelledby="confirmar-baja-titulo">
        <div className="dialogo-cuerpo">
          <h2 id="confirmar-baja-titulo" className="dialogo-titulo">
            ¿Dar de baja a {porDarDeBaja?.apellido}, {porDarDeBaja?.nombre}?
          </h2>
          <p className="dialogo-texto">
            La cuenta deja de poder entrar, pero no se borra nada: sus estadías, comprobantes y
            movimientos quedan intactos, y la baja se puede revertir desde «Ver bajas».
            {porDarDeBaja?.montoDisponible > 0 && (
              <> Ojo: le queda un saldo de {pesos(porDarDeBaja.montoDisponible)} sin usar.</>
            )}
          </p>
          <div className="dialogo-acciones">
            <button type="button" className="boton-secundario" onClick={() => { confirmacion.current?.close(); setPorDarDeBaja(null); }} disabled={accionando}>
              Cancelar
            </button>
            <button type="button" className="boton-primario" onClick={confirmarBaja} disabled={accionando}>
              {accionando ? 'Dando de baja…' : 'Sí, dar de baja'}
            </button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
