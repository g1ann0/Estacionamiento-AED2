import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { listarTarifas, crearTarifa, actualizarTarifa, eliminarTarifa } from '../../services/tarifaService';
import { fechaHora, pesos } from '../formato';
import DialogoTarifa from './DialogoTarifa';
import '../../styles/caja.css';

const TIPOS_AUTOMATICOS = ['asociado', 'no_asociado'];

const nombreVisible = (tipo) => tipo.replace(/_/g, ' ');

// TARIFAS — la cascada es un diferencial del producto y la pantalla tiene que explicarla, no
// esconderla: un admin que no entiende por qué su tarifa "estudiante" no se cobra nunca es un
// admin que va a pensar que el sistema está roto.
//
// Solo `asociado` y `no_asociado` entran solas. Cualquier otra se cobra únicamente a los
// clientes que la tengan asignada, y eso se dice en la fila, no en un manual.
export default function Tarifas() {
  const [tarifas, setTarifas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [aviso, setAviso] = useState(null);

  const [editando, setEditando] = useState(null);
  const [dialogoAbierto, setDialogoAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [errorDialogo, setErrorDialogo] = useState(null);

  const [borrando, setBorrando] = useState(null);
  const confirmacion = useRef(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      setTarifas(await listarTarifas());
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const abrirNueva = () => { setEditando(null); setErrorDialogo(null); setDialogoAbierto(true); };
  const abrirEdicion = (tarifa) => { setEditando(tarifa); setErrorDialogo(null); setDialogoAbierto(true); };

  const guardar = async (datos) => {
    setGuardando(true);
    setErrorDialogo(null);
    try {
      if (editando) {
        await actualizarTarifa(editando.tipoUsuario, datos);
        setAviso(`Tarifa "${editando.tipoUsuario}" actualizada a ${pesos(datos.precioPorHora)}/h`);
      } else {
        const respuesta = await crearTarifa(datos);
        setAviso(respuesta.mensaje);
      }
      setDialogoAbierto(false);
      await cargar();
    } catch (e) {
      setErrorDialogo(e.message);
    } finally {
      setGuardando(false);
    }
  };

  const confirmarBorrado = async () => {
    setGuardando(true);
    try {
      await eliminarTarifa(borrando.tipoUsuario);
      confirmacion.current?.close();
      setAviso(`Tarifa "${borrando.tipoUsuario}" eliminada`);
      setBorrando(null);
      await cargar();
    } catch (e) {
      confirmacion.current?.close();
      setError(e.message);
    } finally {
      setGuardando(false);
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
          <h1 className="pantalla-titulo">Tarifas</h1>
          <p className="pantalla-bajada">
            Al cobrar, el sistema busca en este orden: <strong>tarifa asignada al cliente</strong> →{' '}
            <strong>asociado / no asociado</strong> → valor por defecto. Se cobra la primera que encuentra.
          </p>
        </div>
        <div className="turno-acciones">
          <Link className="boton-secundario" to="/admin/tarifas/historial">Ver historial</Link>
          <button type="button" className="boton-primario" onClick={abrirNueva}>Nueva tarifa</button>
        </div>
      </header>

      {error && <p className="mensaje-error" role="alert">{error}</p>}

      <section className="turno-movimientos" aria-label="Tarifas configuradas">
        <div className="tabla-contenedor">
          <table className="tabla">
            <thead>
              <tr>
                <th scope="col">Tarifa</th>
                <th scope="col">Cómo se aplica</th>
                <th scope="col">Descripción</th>
                <th scope="col">Última modificación</th>
                <th scope="col" className="col-monto">Por hora</th>
                <th scope="col" className="col-accion"><span className="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              {cargando && Array.from({ length: 3 }).map((_, i) => (
                <tr key={`esqueleto-${i}`} className="fila-esqueleto">
                  <td colSpan={6}><span className="esqueleto" /></td>
                </tr>
              ))}

              {!cargando && tarifas.length === 0 && (
                <tr><td colSpan={6} className="tabla-estado"><p>No hay tarifas configuradas.</p></td></tr>
              )}

              {!cargando && tarifas.map((tarifa) => {
                const automatica = TIPOS_AUTOMATICOS.includes(tarifa.tipoUsuario);
                return (
                  <tr key={tarifa._id}>
                    <td><strong>{nombreVisible(tarifa.tipoUsuario)}</strong></td>
                    <td>
                      {automatica
                        ? <span className="texto-sutil">Automática, por condición del cliente</span>
                        : <span className="texto-sutil">Solo si se le asigna a un cliente</span>}
                    </td>
                    <td className="col-concepto">{tarifa.descripcion || <span className="texto-sutil">—</span>}</td>
                    <td className="numerico">{fechaHora(tarifa.fechaActualizacion)}</td>
                    <td className="col-monto numerico">{pesos(tarifa.precioPorHora)}</td>
                    <td className="col-accion">
                      <div className="acciones-fila">
                        <button type="button" className="boton-secundario" onClick={() => abrirEdicion(tarifa)}>Editar</button>
                        {/* Las dos automáticas sostienen la cascada: borrarlas dejaría al
                            sistema cobrando el valor por defecto sin que nadie lo haya decidido. */}
                        {!automatica && (
                          <button
                            type="button"
                            className="boton-secundario"
                            onClick={() => { setBorrando(tarifa); confirmacion.current?.showModal(); }}
                          >
                            Eliminar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <DialogoTarifa
        abierto={dialogoAbierto}
        tarifa={editando}
        guardando={guardando}
        error={errorDialogo}
        onGuardar={guardar}
        onCerrar={() => setDialogoAbierto(false)}
      />

      <dialog ref={confirmacion} className="dialogo" aria-labelledby="confirmar-borrado-titulo">
        <div className="dialogo-cuerpo">
          <h2 id="confirmar-borrado-titulo" className="dialogo-titulo">
            ¿Eliminar la tarifa "{borrando?.tipoUsuario}"?
          </h2>
          <p className="dialogo-texto">
            Los clientes que la tengan asignada pasan a cobrarse por su condición de asociado o
            no asociado. El cambio queda en el historial.
          </p>
          <div className="dialogo-acciones">
            <button type="button" className="boton-secundario" onClick={() => { confirmacion.current?.close(); setBorrando(null); }} disabled={guardando}>
              Cancelar
            </button>
            <button type="button" className="boton-primario" onClick={confirmarBorrado} disabled={guardando}>
              {guardando ? 'Eliminando…' : 'Sí, eliminar'}
            </button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
