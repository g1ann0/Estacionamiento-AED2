import { useCallback, useEffect, useRef, useState } from 'react';
import { listarSucursales, crearSucursal, actualizarSucursal } from '../../services/administracionService';
import { pesos } from '../formato';
import '../../styles/caja.css';

const vacio = { nombre: '', direccion: '', capacidadTotal: '', capacidadAuto: '', capacidadMoto: '', tarifaExcepcion: '' };

// CONFIGURACIÓN → SUCURSALES.
//
// Los dos campos de acá no son cosmética: `capacidad.total` es el denominador de la ocupación
// —sin él la Terminal solo puede decir "32 adentro", nunca "32 de 40", y "playa completa" es
// indetectable— y `tarifaExcepcion` es lo que se cobra cuando un auto sale sin registro de
// ingreso; en null, ese flujo queda deshabilitado en vez de cobrar cero.
//
// Hasta ahora los dos solo se podían cambiar entrando a la base a mano.
export default function Sucursales() {
  const [sucursales, setSucursales] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [aviso, setAviso] = useState(null);

  const [editando, setEditando] = useState(null);
  const [formulario, setFormulario] = useState(vacio);
  const [guardando, setGuardando] = useState(false);
  const [errorDialogo, setErrorDialogo] = useState(null);
  const dialogo = useRef(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      setSucursales(await listarSucursales());
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const abrir = (sucursal) => {
    setEditando(sucursal);
    setErrorDialogo(null);
    setFormulario(sucursal
      ? {
          nombre: sucursal.nombre,
          direccion: sucursal.direccion ?? '',
          capacidadTotal: sucursal.capacidad?.total ?? '',
          capacidadAuto: sucursal.capacidad?.auto ?? '',
          capacidadMoto: sucursal.capacidad?.moto ?? '',
          tarifaExcepcion: sucursal.tarifaExcepcion ?? ''
        }
      : vacio);
    dialogo.current?.showModal();
  };

  const guardar = async (evento) => {
    evento.preventDefault();
    setGuardando(true);
    setErrorDialogo(null);
    const datos = {
      nombre: formulario.nombre,
      direccion: formulario.direccion,
      capacidad: {
        total: formulario.capacidadTotal,
        auto: formulario.capacidadAuto,
        moto: formulario.capacidadMoto
      },
      tarifaExcepcion: formulario.tarifaExcepcion
    };
    try {
      if (editando) {
        await actualizarSucursal(editando._id, datos);
        setAviso(`Sucursal "${formulario.nombre}" actualizada`);
      } else {
        await crearSucursal(datos);
        setAviso(`Sucursal "${formulario.nombre}" creada`);
      }
      dialogo.current?.close();
      await cargar();
    } catch (e) {
      setErrorDialogo(e.message);
    } finally {
      setGuardando(false);
    }
  };

  const campo = (clave) => ({
    value: formulario[clave],
    onChange: (e) => setFormulario((actual) => ({ ...actual, [clave]: e.target.value })),
    disabled: guardando
  });

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
          <h1 className="pantalla-titulo">Sucursales</h1>
          <p className="pantalla-bajada">
            La capacidad es el denominador de la ocupación; la tarifa de excepción es lo que se
            cobra cuando un vehículo sale sin registro de ingreso. Sin cargar, cada una
            deshabilita su función en vez de inventar un valor.
          </p>
        </div>
        <div className="turno-acciones">
          <button type="button" className="boton-primario" onClick={() => abrir(null)}>Nueva sucursal</button>
        </div>
      </header>

      {error && <p className="mensaje-error" role="alert">{error}</p>}

      <section className="turno-movimientos" aria-label="Sucursales">
        <div className="tabla-contenedor">
          <table className="tabla">
            <thead>
              <tr>
                <th scope="col">Sucursal</th>
                <th scope="col">Dirección</th>
                <th scope="col" className="col-monto">Capacidad</th>
                <th scope="col" className="col-monto">Autos</th>
                <th scope="col" className="col-monto">Motos</th>
                <th scope="col" className="col-monto">Tarifa de excepción</th>
                <th scope="col" className="col-accion"><span className="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              {cargando && Array.from({ length: 2 }).map((_, i) => (
                <tr key={`esqueleto-${i}`} className="fila-esqueleto">
                  <td colSpan={7}><span className="esqueleto" /></td>
                </tr>
              ))}

              {!cargando && sucursales.length === 0 && (
                <tr><td colSpan={7} className="tabla-estado"><p>No hay sucursales configuradas.</p></td></tr>
              )}

              {!cargando && sucursales.map((sucursal) => (
                <tr key={sucursal._id} className={sucursal.activa === false ? 'fila-anulada' : undefined}>
                  <td>
                    <strong>{sucursal.nombre}</strong>
                    {sucursal.esPrincipal && <span className="chip">Principal</span>}
                  </td>
                  <td className="col-concepto">{sucursal.direccion || <span className="texto-sutil">—</span>}</td>
                  <td className="col-monto numerico">
                    {sucursal.capacidad?.total ?? <span className="texto-sutil">Sin definir</span>}
                  </td>
                  <td className="col-monto numerico">
                    {sucursal.capacidad?.auto ?? <span className="texto-sutil">—</span>}
                  </td>
                  <td className="col-monto numerico">
                    {sucursal.capacidad?.moto ?? <span className="texto-sutil">—</span>}
                  </td>
                  <td className="col-monto numerico">
                    {sucursal.tarifaExcepcion != null
                      ? pesos(sucursal.tarifaExcepcion)
                      : <span className="chip chip-alerta">Deshabilitada</span>}
                  </td>
                  <td className="col-accion">
                    <div className="acciones-fila">
                      <button type="button" className="boton-secundario" onClick={() => abrir(sucursal)}>Editar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <dialog ref={dialogo} className="dialogo" onClose={() => setEditando(null)} aria-labelledby="dialogo-sucursal-titulo">
        <form className="dialogo-cuerpo" onSubmit={guardar}>
          <h2 id="dialogo-sucursal-titulo" className="dialogo-titulo">
            {editando ? `Editar ${editando.nombre}` : 'Nueva sucursal'}
          </h2>

          {errorDialogo && <p className="mensaje-error" role="alert">{errorDialogo}</p>}

          <label className="campo">
            <span>Nombre</span>
            <input className="control" {...campo('nombre')} required autoFocus />
          </label>

          <label className="campo">
            <span>Dirección <em>opcional</em></span>
            <input className="control" {...campo('direccion')} />
          </label>

          <label className="campo">
            <span>Capacidad total</span>
            <input className="control numerico" type="number" min="0" step="1" {...campo('capacidadTotal')} />
            <em>Vacío: la playa se muestra sin denominador y nunca se marca completa.</em>
          </label>

          <div className="filtros">
            <label className="campo">
              <span>Autos <em>informativo</em></span>
              <input className="control numerico" type="number" min="0" step="1" {...campo('capacidadAuto')} />
            </label>
            <label className="campo">
              <span>Motos <em>informativo</em></span>
              <input className="control numerico" type="number" min="0" step="1" {...campo('capacidadMoto')} />
            </label>
          </div>

          <label className="campo">
            <span>Tarifa de excepción</span>
            <input className="control numerico" type="number" min="0" step="1" {...campo('tarifaExcepcion')} />
            <em>Importe fijo del ticket perdido. El cajero no lo puede editar. Vacío: el flujo queda deshabilitado.</em>
          </label>

          <div className="dialogo-acciones">
            <button type="button" className="boton-secundario" onClick={() => dialogo.current?.close()} disabled={guardando}>
              Cancelar <kbd>Esc</kbd>
            </button>
            <button type="submit" className="boton-primario" disabled={guardando}>
              {guardando ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
