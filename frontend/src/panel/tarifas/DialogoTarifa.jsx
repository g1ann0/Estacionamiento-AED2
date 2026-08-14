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

  // Reglas de cobro. Todas nacen neutras: hora entera, sin tope y sin recargos, que es como
  // cobraba el sistema antes de que existieran. Quien no las toca no cambia nada.
  const [tipoVehiculo, setTipoVehiculo] = useState('todos');
  const [fraccionMinutos, setFraccionMinutos] = useState('60');
  const [topeDiario, setTopeDiario] = useState('');
  const [recargoNocturno, setRecargoNocturno] = useState('0');
  const [nocturnoDesde, setNocturnoDesde] = useState('22:00');
  const [nocturnoHasta, setNocturnoHasta] = useState('06:00');
  const [recargoFinDeSemana, setRecargoFinDeSemana] = useState('0');
  const [recargoFeriado, setRecargoFeriado] = useState('0');

  const editando = Boolean(tarifa);

  useEffect(() => {
    const elemento = dialogo.current;
    if (!elemento) return;
    if (abierto && !elemento.open) {
      setTipoUsuario(tarifa?.tipoUsuario ?? '');
      setPrecioPorHora(tarifa ? String(tarifa.precioPorHora) : '');
      setDescripcion(tarifa?.descripcion ?? '');
      setMotivo('');
      setTipoVehiculo(tarifa?.tipoVehiculo ?? 'todos');
      setFraccionMinutos(String(tarifa?.fraccionMinutos ?? 60));
      setTopeDiario(tarifa?.topeDiario == null ? '' : String(tarifa.topeDiario));
      setRecargoNocturno(String(tarifa?.recargos?.nocturno?.porcentaje ?? 0));
      setNocturnoDesde(tarifa?.recargos?.nocturno?.desde ?? '22:00');
      setNocturnoHasta(tarifa?.recargos?.nocturno?.hasta ?? '06:00');
      setRecargoFinDeSemana(String(tarifa?.recargos?.finDeSemana?.porcentaje ?? 0));
      setRecargoFeriado(String(tarifa?.recargos?.feriado?.porcentaje ?? 0));
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
      motivo: motivo.trim(),
      tipoVehiculo,
      fraccionMinutos: Number(fraccionMinutos) || 60,
      topeDiario: topeDiario === '' ? null : Number(topeDiario),
      recargos: {
        nocturno: { porcentaje: Number(recargoNocturno) || 0, desde: nocturnoDesde, hasta: nocturnoHasta },
        finDeSemana: { porcentaje: Number(recargoFinDeSemana) || 0 },
        feriado: { porcentaje: Number(recargoFeriado) || 0 }
      }
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

        <div className="formulario-fila">
          <label className="campo">
            <span>Se aplica a</span>
            <select className="control" value={tipoVehiculo} onChange={(e) => setTipoVehiculo(e.target.value)} disabled={guardando}>
              <option value="todos">Todos los vehículos</option>
              <option value="auto">Solo autos</option>
              <option value="moto">Solo motos</option>
            </select>
            {tipoVehiculo !== 'todos' && (
              <em>Le gana a la tarifa general del mismo tipo de cliente.</em>
            )}
          </label>

          <label className="campo">
            <span>Se cobra cada</span>
            <select className="control" value={fraccionMinutos} onChange={(e) => setFraccionMinutos(e.target.value)} disabled={guardando}>
              <option value="60">Hora completa</option>
              <option value="30">Media hora</option>
              <option value="15">15 minutos</option>
            </select>
            <em>Siempre hacia arriba. La pantalla de cobro lo muestra explícito.</em>
          </label>
        </div>

        <label className="campo">
          <span>Tope por día <em>opcional</em></span>
          <input
            className="control numerico"
            type="number"
            min="0"
            step="1"
            inputMode="numeric"
            value={topeDiario}
            onChange={(e) => setTopeDiario(e.target.value)}
            placeholder="Sin tope"
            disabled={guardando}
          />
          <em>Máximo por cada 24 horas de estadía. Evita el importe impagable del auto olvidado.</em>
        </label>

        {/* Los recargos son el único lugar donde un número mal puesto se cobra de más sin que
            nadie lo note hasta el reclamo. Van juntos, con su porcentaje visible, y en cero. */}
        <fieldset className="formulario-bloque">
          <legend>Recargos <em>se aplica solo el mayor, nunca la suma</em></legend>

          {/* El porcentaje va solo y las dos horas juntas: tres columnas no entran en el ancho
              del diálogo y "Hasta" caía sola en la fila siguiente, lejos de su "Desde". */}
          <label className="campo">
            <span>Nocturno %</span>
            <input className="control numerico" type="number" min="0" step="5" value={recargoNocturno}
              onChange={(e) => setRecargoNocturno(e.target.value)} disabled={guardando} />
          </label>

          <div className="formulario-fila">
            <label className="campo">
              <span>Desde</span>
              <input className="control" type="time" value={nocturnoDesde}
                onChange={(e) => setNocturnoDesde(e.target.value)} disabled={guardando || Number(recargoNocturno) === 0} />
            </label>
            <label className="campo">
              <span>Hasta</span>
              <input className="control" type="time" value={nocturnoHasta}
                onChange={(e) => setNocturnoHasta(e.target.value)} disabled={guardando || Number(recargoNocturno) === 0} />
            </label>
          </div>

          <div className="formulario-fila">
            <label className="campo">
              <span>Fin de semana %</span>
              <input className="control numerico" type="number" min="0" step="5" value={recargoFinDeSemana}
                onChange={(e) => setRecargoFinDeSemana(e.target.value)} disabled={guardando} />
            </label>
            <label className="campo">
              <span>Feriado %</span>
              <input className="control numerico" type="number" min="0" step="5" value={recargoFeriado}
                onChange={(e) => setRecargoFeriado(e.target.value)} disabled={guardando} />
              <em>Los días se cargan en Configuración → Feriados.</em>
            </label>
          </div>
        </fieldset>

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
