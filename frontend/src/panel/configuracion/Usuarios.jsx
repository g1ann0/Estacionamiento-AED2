import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { listarClientes, listarTarifasAsignables, actualizarRolYTarifa } from '../../services/administracionService';
import { pesos } from '../formato';
import '../../styles/caja.css';

// CONFIGURACIÓN → USUARIOS Y ROLES. Quién entra al panel y con qué alcance, y qué tarifa se
// le cobra a cada cliente.
//
// La tarifa asignada es la primera de la cascada: gana sobre la condición de asociado. Es el
// único mecanismo por el que una tarifa con nombre propio llega a cobrarse, así que se asigna
// desde acá y no adivinando nombres en la pantalla de Tarifas.
export default function Usuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [tarifas, setTarifas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [busqueda, setBusqueda] = useState('');
  const [soloAdmin, setSoloAdmin] = useState(false);

  const [editando, setEditando] = useState(null);
  const [rol, setRol] = useState('cliente');
  const [asociado, setAsociado] = useState(false);
  const [tarifaAsignada, setTarifaAsignada] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [errorDialogo, setErrorDialogo] = useState(null);
  const dialogo = useRef(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [lista, disponibles] = await Promise.all([listarClientes(), listarTarifasAsignables()]);
      setUsuarios(lista);
      setTarifas(Array.isArray(disponibles) ? disponibles : []);
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
    return usuarios.filter((usuario) => {
      if (soloAdmin && usuario.rol !== 'admin') return false;
      if (!termino) return true;
      return [usuario.nombre, usuario.apellido, usuario.dni, usuario.email]
        .filter(Boolean)
        .some((campo) => String(campo).toLowerCase().includes(termino));
    });
  }, [usuarios, busqueda, soloAdmin]);

  const nombreTarifa = (id) => {
    const tarifa = tarifas.find((t) => t._id === id || t._id === id?._id);
    return tarifa ? `${tarifa.tipoUsuario.replace(/_/g, ' ')} · ${pesos(tarifa.precioPorHora)}/h` : null;
  };

  const abrir = (usuario) => {
    setEditando(usuario);
    setErrorDialogo(null);
    setRol(usuario.rol ?? 'cliente');
    setAsociado(Boolean(usuario.asociado));
    setTarifaAsignada(usuario.tarifaAsignada?._id ?? usuario.tarifaAsignada ?? '');
    dialogo.current?.showModal();
  };

  const guardar = async (evento) => {
    evento.preventDefault();
    setGuardando(true);
    setErrorDialogo(null);
    try {
      await actualizarRolYTarifa(editando.dni, { rol, asociado, tarifaAsignada: tarifaAsignada || null });
      setAviso(`${editando.apellido}, ${editando.nombre} actualizado`);
      dialogo.current?.close();
      await cargar();
    } catch (e) {
      setErrorDialogo(e.message);
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
          <h1 className="pantalla-titulo">Usuarios y roles</h1>
          <p className="pantalla-bajada">
            El rol define qué ve cada uno en el panel. La tarifa asignada se cobra por encima de
            la condición de asociado.
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
          <input type="checkbox" checked={soloAdmin} onChange={(e) => setSoloAdmin(e.target.checked)} />
          <span>Solo administradores</span>
        </label>

        <span className="filtros-conteo numerico">
          {filtrados.length} {filtrados.length === 1 ? 'usuario' : 'usuarios'}
        </span>
      </div>

      {error && <p className="mensaje-error" role="alert">{error}</p>}

      <section className="turno-movimientos" aria-label="Usuarios del sistema">
        <div className="tabla-contenedor">
          <table className="tabla">
            <thead>
              <tr>
                <th scope="col">Usuario</th>
                <th scope="col">DNI</th>
                <th scope="col">Rol</th>
                <th scope="col">Condición</th>
                <th scope="col">Tarifa asignada</th>
                <th scope="col" className="col-accion"><span className="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              {cargando && Array.from({ length: 5 }).map((_, i) => (
                <tr key={`esqueleto-${i}`} className="fila-esqueleto">
                  <td colSpan={6}><span className="esqueleto" /></td>
                </tr>
              ))}

              {!cargando && filtrados.length === 0 && (
                <tr><td colSpan={6} className="tabla-estado"><p>Ningún usuario coincide.</p></td></tr>
              )}

              {!cargando && filtrados.map((usuario) => (
                <tr key={usuario._id} className={usuario.activo === false ? 'fila-anulada' : undefined}>
                  <td>
                    {usuario.apellido}, {usuario.nombre}
                    {usuario.activo === false && <span className="chip chip-alerta">Baja</span>}
                  </td>
                  <td className="numerico">{usuario.dni}</td>
                  <td>
                    {usuario.rol === 'admin'
                      ? <strong>Administrador</strong>
                      : <span className="texto-sutil">{usuario.rol === 'operador' ? 'Operador' : 'Cliente'}</span>}
                  </td>
                  <td>{usuario.asociado ? 'Asociado' : <span className="texto-sutil">No asociado</span>}</td>
                  <td className="col-concepto">
                    {nombreTarifa(usuario.tarifaAsignada) ?? <span className="texto-sutil">Por condición</span>}
                  </td>
                  <td className="col-accion">
                    <div className="acciones-fila">
                      <button type="button" className="boton-secundario" onClick={() => abrir(usuario)}>Editar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <dialog ref={dialogo} className="dialogo" onClose={() => setEditando(null)} aria-labelledby="dialogo-usuario-titulo">
        <form className="dialogo-cuerpo" onSubmit={guardar}>
          <h2 id="dialogo-usuario-titulo" className="dialogo-titulo">
            {editando ? `${editando.apellido}, ${editando.nombre}` : 'Usuario'}
          </h2>

          {errorDialogo && <p className="mensaje-error" role="alert">{errorDialogo}</p>}

          <label className="campo">
            <span>Rol</span>
            <select className="control" value={rol} onChange={(e) => setRol(e.target.value)} disabled={guardando}>
              <option value="cliente">Cliente</option>
              <option value="operador">Operador</option>
              <option value="admin">Administrador</option>
            </select>
            {/* Los tres roles son reales: el enum de `Usuario` los admite y las rutas de caja,
                turnos, estadías, comprobantes y sucursales ya distinguen operador de admin. */}
            <em>
              El operador cobra y opera la caja, pero no toca tarifas, configuración ni auditoría.
            </em>
          </label>

          <label className="campo campo-en-linea">
            <input type="checkbox" checked={asociado} onChange={(e) => setAsociado(e.target.checked)} disabled={guardando} />
            <span>Asociado</span>
          </label>

          <label className="campo">
            <span>Tarifa asignada</span>
            <select className="control" value={tarifaAsignada} onChange={(e) => setTarifaAsignada(e.target.value)} disabled={guardando}>
              <option value="">Sin asignar — se cobra por condición</option>
              {tarifas.map((tarifa) => (
                <option key={tarifa._id} value={tarifa._id}>
                  {tarifa.tipoUsuario.replace(/_/g, ' ')} · {pesos(tarifa.precioPorHora)}/h
                </option>
              ))}
            </select>
            <em>Gana sobre la condición de asociado: es lo primero que mira la cascada.</em>
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
