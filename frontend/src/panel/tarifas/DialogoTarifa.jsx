import { useEffect, useRef, useState } from 'react';

const TIPOS_AUTOMATICOS = ['asociado', 'no_asociado'];

// Alta y edición de tarifa en el mismo diálogo: los campos son los mismos y la única
// diferencia real es que el nombre no se puede cambiar una vez creado (es la clave con la que
// la tarifa quedó asignada a los clientes).
export default function DialogoTarifa({ abierto, tarifa, guardando, error, onGuardar, onCerrar }) {
  const dialogo = useRef(null);
  const [tipoUsuario, setTipoUsuario] = useState('');
  const [precioPorHora, setPrecioPorHora] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [motivo, setMotivo] = useState('');

  const editando = Boolean(tarifa);

  useEffect(() => {
    const elemento = dialogo.current;
    if (!elemento) return;
    if (abierto && !elemento.open) {
      setTipoUsuario(tarifa?.tipoUsuario ?? '');
      setPrecioPorHora(tarifa ? String(tarifa.precioPorHora) : '');
      setDescripcion(tarifa?.descripcion ?? '');
      setMotivo('');
      elemento.showModal();
    }
    if (!abierto && elemento.open) elemento.close();
  }, [abierto, tarifa]);

  const enviar = (evento) => {
    evento.preventDefault();
    const precio = parseFloat(precioPorHora);
    if (!Number.isFinite(precio) || precio < 0) return;
    if (!editando && !tipoUsuario.trim()) return;
    onGuardar({
      tipoUsuario: tipoUsuario.trim().toLowerCase(),
      precioPorHora: precio,
      descripcion: descripcion.trim(),
      motivo: motivo.trim()
    });
  };

  const nombreLibre = !editando && tipoUsuario.trim() && !TIPOS_AUTOMATICOS.includes(tipoUsuario.trim().toLowerCase());

  return (
    <dialog ref={dialogo} className="dialogo" onCancel={onCerrar} onClose={onCerrar} aria-labelledby="dialogo-tarifa-titulo">
      <form className="dialogo-cuerpo" onSubmit={enviar}>
        <h2 id="dialogo-tarifa-titulo" className="dialogo-titulo">
          {editando ? `Editar tarifa "${tarifa.tipoUsuario}"` : 'Nueva tarifa'}
        </h2>

        {error && <p className="mensaje-error" role="alert">{error}</p>}

        {!editando && (
          <label className="campo">
            <span>Nombre</span>
            <input
              className="control"
              value={tipoUsuario}
              onChange={(e) => setTipoUsuario(e.target.value)}
              placeholder="Ej: convenio_shopping"
              disabled={guardando}
              required
              autoFocus
            />
            {/* El aviso aparece mientras escribe, no después de guardar: es la diferencia entre
                entender la cascada y crear una tarifa que nunca se cobra. */}
            {nombreLibre && (
              <em>
                Una tarifa con nombre propio no se aplica sola. Se cobra solo a los clientes a
                los que se la asignes.
              </em>
            )}
          </label>
        )}

        <label className="campo">
          <span>Precio por hora</span>
          <input
            className="control numerico"
            type="number"
            min="0"
            step="1"
            inputMode="numeric"
            value={precioPorHora}
            onChange={(e) => setPrecioPorHora(e.target.value)}
            disabled={guardando}
            required
            autoFocus={editando}
          />
        </label>

        <label className="campo">
          <span>Descripción <em>opcional</em></span>
          <input
            className="control"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            disabled={guardando}
          />
        </label>

        {editando && (
          <label className="campo">
            <span>Motivo del cambio <em>opcional</em></span>
            <input
              className="control"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ej: aumento de agosto"
              disabled={guardando}
            />
            <em>Queda en el historial de tarifas junto al precio anterior.</em>
          </label>
        )}

        <div className="dialogo-acciones">
          <button type="button" className="boton-secundario" onClick={onCerrar} disabled={guardando}>
            Cancelar <kbd>Esc</kbd>
          </button>
          <button type="submit" className="boton-primario" disabled={guardando}>
            {guardando ? 'Guardando…' : (editando ? 'Guardar cambios' : 'Crear tarifa')}
          </button>
        </div>
      </form>
    </dialog>
  );
}
