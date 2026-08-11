import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  listarVehiculos,
  listarClientes,
  crearVehiculoAdmin,
  actualizarVehiculoAdmin,
  eliminarVehiculoAdmin
} from '../../services/administracionService';
import { fecha } from '../formato';
import '../../styles/caja.css';

// Los registros viejos guardaron 'Sin datos' y 'S/D' como si fueran datos, de cuando marca y
// modelo eran obligatorios y el mostrador no los tenía. La ausencia se muestra como ausencia.
const PLACEHOLDERS = ['sin datos', 's/d', 'n/a', ''];
const real = (valor) => (valor && !PLACEHOLDERS.includes(String(valor).trim().toLowerCase()) ? valor : null);

const formularioVacio = { dominio: '', tipo: 'auto', marca: '', modelo: '', anio: '', usuarioDni: '', motivo: '' };

// CLIENTES → VEHÍCULOS. El padrón de autos con dueño registrado. Los ocasionales no están acá
// —no tienen cuenta— y eso es correcto: esta pantalla responde "qué autos tienen dueño".
//
// Las tres acciones piden motivo porque el backend lo exige, y lo exige por una razón: cambiar
// el dominio de un vehículo reescribe a qué auto apuntan las estadías que ya se cobraron.
export default function Vehiculos() {
  const [vehiculos, setVehiculos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [busqueda, setBusqueda] = useState('');
  const [tipo, setTipo] = useState('');

  const [editando, setEditando] = useState(null);
  const [formulario, setFormulario] = useState(formularioVacio);
  const [guardando, setGuardando] = useState(false);
  const [errorDialogo, setErrorDialogo] = useState(null);
  const dialogo = useRef(null);

  const [porEliminar, setPorEliminar] = useState(null);
  const [motivoBaja, setMotivoBaja] = useState('');
  const confirmacion = useRef(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [lista, personas] = await Promise.all([listarVehiculos(), listarClientes().catch(() => [])]);
      setVehiculos(lista);
      setClientes(personas);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const filtrados = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    return vehiculos.filter((vehiculo) => {
      if (tipo && vehiculo.tipo !== tipo) return false;
      if (!termino) return true;
      const propietario = vehiculo.propietario ?? vehiculo.usuario ?? {};
      return [vehiculo.dominio, vehiculo.marca, vehiculo.modelo, propietario.dni, propietario.nombre, propietario.apellido]
        .filter(Boolean)
        .some((campo) => String(campo).toLowerCase().includes(termino));
    });
  }, [vehiculos, busqueda, tipo]);

  const abrir = (vehiculo) => {
    setEditando(vehiculo);
    setErrorDialogo(null);
    const duenio = vehiculo?.propietario ?? vehiculo?.usuario ?? null;
    setFormulario(vehiculo
      ? {
          dominio: vehiculo.dominio,
          tipo: vehiculo.tipo ?? 'auto',
          marca: real(vehiculo.marca) ?? '',
          modelo: real(vehiculo.modelo) ?? '',
          anio: vehiculo.año ?? '',
          usuarioDni: duenio?.dni ?? '',
          motivo: ''
        }
      : formularioVacio);
    dialogo.current?.showModal();
  };

  const guardar = async (evento) => {
    evento.preventDefault();
    setGuardando(true);
    setErrorDialogo(null);
    const payload = {
      tipo: formulario.tipo,
      marca: formulario.marca.trim(),
      modelo: formulario.modelo.trim(),
      año: formulario.anio ? Number(formulario.anio) : undefined,
      usuarioDni: formulario.usuarioDni,
      motivo: formulario.motivo.trim()
    };
    try {
      if (editando) {
        // El dominio se manda como `nuevoDominio` solo si cambió: es la clave con la que las
        // estadías ya cobradas apuntan a este vehículo.
        await actualizarVehiculoAdmin(editando.dominio, {
          ...payload,
          nuevoDominio: formulario.dominio.toUpperCase() !== editando.dominio ? formulario.dominio.toUpperCase() : undefined
        });
        setAviso(`Vehículo ${formulario.dominio.toUpperCase()} modificado`);
      } else {
        await crearVehiculoAdmin({ ...payload, dominio: formulario.dominio.toUpperCase() });
        setAviso(`Vehículo ${formulario.dominio.toUpperCase()} agregado`);
      }
      dialogo.current?.close();
      await cargar();
    } catch (e) {
      setErrorDialogo(e.message);
    } finally {
      setGuardando(false);
    }
  };

  const confirmarEliminacion = async () => {
    if (!motivoBaja.trim()) return;
    setGuardando(true);
    try {
      await eliminarVehiculoAdmin(porEliminar.dominio, motivoBaja.trim());
      confirmacion.current?.close();
      setAviso(`Vehículo ${porEliminar.dominio} eliminado`);
      setPorEliminar(null);
      setMotivoBaja('');
      await cargar();
    } catch (e) {
      confirmacion.current?.close();
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  };

  const campo = (clave) => ({
    value: formulario[clave],
    disabled: guardando,
    onChange: (e) => setFormulario((actual) => ({ ...actual, [clave]: e.target.value }))
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
          <h1 className="pantalla-titulo">Vehículos</h1>
          <p className="pantalla-bajada">
            Autos y motos con dueño registrado. Los vehículos de clientes ocasionales no se dan
            de alta: entran y salen sin cuenta.
          </p>
        </div>
        <div className="turno-acciones">
          <button type="button" className="boton-primario" onClick={() => abrir(null)}>Agregar vehículo</button>
        </div>
      </header>

      <div className="filtros">
        <label className="campo">
          <span>Buscar</span>
          <input
            className="control"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Patente, marca o dueño"
            autoComplete="off"
          />
        </label>

        <label className="campo">
          <span>Tipo</span>
          <select className="control" value={tipo} onChange={(e) => setTipo(e.target.value)}>
            <option value="">Todos</option>
            <option value="auto">Auto</option>
            <option value="moto">Moto</option>
          </select>
        </label>

        <span className="filtros-conteo numerico">
          {filtrados.length} {filtrados.length === 1 ? 'vehículo' : 'vehículos'}
        </span>
      </div>

      {error && <p className="mensaje-error" role="alert">{error}</p>}

      <section className="turno-movimientos" aria-label="Vehículos registrados">
        <div className="tabla-contenedor">
          <table className="tabla">
            <thead>
              <tr>
                <th scope="col">Patente</th>
                <th scope="col">Tipo</th>
                <th scope="col">Marca y modelo</th>
                <th scope="col">Dueño</th>
                <th scope="col">Alta</th>
                <th scope="col" className="col-accion"><span className="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              {cargando && Array.from({ length: 6 }).map((_, i) => (
                <tr key={`esqueleto-${i}`} className="fila-esqueleto">
                  <td colSpan={6}><span className="esqueleto" /></td>
                </tr>
              ))}

              {!cargando && filtrados.length === 0 && (
                <tr>
                  <td colSpan={6} className="tabla-estado">
                    <p>{busqueda || tipo ? 'Ningún vehículo coincide.' : 'Todavía no hay vehículos registrados.'}</p>
                  </td>
                </tr>
              )}

              {!cargando && filtrados.map((vehiculo) => {
                const duenio = vehiculo.propietario ?? vehiculo.usuario ?? null;
                const marca = [real(vehiculo.marca), real(vehiculo.modelo)].filter(Boolean).join(' ');
                return (
                  <tr key={vehiculo._id}>
                    <td className="chapa">{vehiculo.dominio}</td>
                    <td>{vehiculo.tipo === 'moto' ? 'Moto' : 'Auto'}</td>
                    <td className="col-concepto">{marca || <span className="texto-sutil">Sin datos cargados</span>}</td>
                    <td>
                      {duenio?.apellido || duenio?.nombre
                        ? <>{duenio.apellido}, {duenio.nombre} <span className="texto-sutil">· {duenio.dni}</span></>
                        : <span className="texto-sutil">—</span>}
                    </td>
                    <td className="numerico">{vehiculo.fechaRegistro ? fecha(vehiculo.fechaRegistro) : '—'}</td>
                    <td className="col-accion">
                      <div className="acciones-fila">
                        <button type="button" className="boton-secundario" onClick={() => abrir(vehiculo)}>Editar</button>
                        <button
                          type="button"
                          className="boton-secundario"
                          onClick={() => { setPorEliminar(vehiculo); setMotivoBaja(''); confirmacion.current?.showModal(); }}
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <dialog ref={dialogo} className="dialogo" onClose={() => setEditando(null)} aria-labelledby="dialogo-vehiculo-titulo">
        <form className="dialogo-cuerpo" onSubmit={guardar}>
          <h2 id="dialogo-vehiculo-titulo" className="dialogo-titulo">
            {editando ? `Editar ${editando.dominio}` : 'Agregar vehículo'}
          </h2>

          {errorDialogo && <p className="mensaje-error" role="alert">{errorDialogo}</p>}

          <label className="campo">
            <span>Patente</span>
            <input
              className="control chapa"
              {...campo('dominio')}
              onChange={(e) => setFormulario((actual) => ({ ...actual, dominio: e.target.value.toUpperCase() }))}
              placeholder="AB123CD"
              required
              autoFocus
            />
            {editando && <em>Cambiarla reescribe a qué auto apuntan las estadías ya cobradas.</em>}
          </label>

          <label className="campo">
            <span>Dueño</span>
            <select className="control" {...campo('usuarioDni')} required>
              <option value="">Elegir cliente…</option>
              {clientes.map((cliente) => (
                <option key={cliente._id} value={cliente.dni}>
                  {cliente.apellido}, {cliente.nombre} · {cliente.dni}
                </option>
              ))}
            </select>
          </label>

          <div className="formulario-fila">
            <label className="campo">
              <span>Tipo</span>
              <select className="control" {...campo('tipo')}>
                <option value="auto">Auto</option>
                <option value="moto">Moto</option>
              </select>
            </label>
            <label className="campo">
              <span>Marca <em>opcional</em></span>
              <input className="control" {...campo('marca')} />
            </label>
            <label className="campo">
              <span>Modelo <em>opcional</em></span>
              <input className="control" {...campo('modelo')} />
            </label>
            <label className="campo">
              <span>Año <em>opcional</em></span>
              <input className="control numerico" type="number" min="1900" max="2100" {...campo('anio')} />
            </label>
          </div>

          <label className="campo">
            <span>Motivo</span>
            <input className="control" {...campo('motivo')} placeholder="Ej: el cliente sumó un segundo auto" required />
            <em>Queda en la auditoría junto al antes y el después.</em>
          </label>

          <div className="dialogo-acciones">
            <button type="button" className="boton-secundario" onClick={() => dialogo.current?.close()} disabled={guardando}>
              Cancelar <kbd>Esc</kbd>
            </button>
            <button type="submit" className="boton-primario" disabled={guardando}>
              {guardando ? 'Guardando…' : (editando ? 'Guardar cambios' : 'Agregar')}
            </button>
          </div>
        </form>
      </dialog>

      <dialog ref={confirmacion} className="dialogo" aria-labelledby="confirmar-vehiculo-titulo">
        <form className="dialogo-cuerpo" onSubmit={(e) => { e.preventDefault(); confirmarEliminacion(); }}>
          <h2 id="confirmar-vehiculo-titulo" className="dialogo-titulo">
            ¿Eliminar el vehículo {porEliminar?.dominio}?
          </h2>
          <p className="dialogo-texto">
            Sale del padrón y deja de estar asociado a su dueño. Las estadías que ya se cobraron
            con esa patente no se tocan.
          </p>
          <label className="campo">
            <span>Motivo</span>
            <input
              className="control"
              value={motivoBaja}
              onChange={(e) => setMotivoBaja(e.target.value)}
              disabled={guardando}
              required
              autoFocus
            />
          </label>
          <div className="dialogo-acciones">
            <button type="button" className="boton-secundario" onClick={() => { confirmacion.current?.close(); setPorEliminar(null); }} disabled={guardando}>
              Cancelar
            </button>
            <button type="submit" className="boton-primario" disabled={guardando || !motivoBaja.trim()}>
              {guardando ? 'Eliminando…' : 'Sí, eliminar'}
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
