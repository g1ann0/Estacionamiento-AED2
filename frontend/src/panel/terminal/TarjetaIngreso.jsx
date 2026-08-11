import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

// Cliente registrado y ocasional comparten esta tarjeta: mismos lugares, mismo botón, mismo
// atajo. Solo cambian tres valores. Desde la perspectiva del cajero no debería importar si
// el conductor tiene cuenta o no — trabaja con patente, vehículo y estadía.
export default function TarjetaIngreso({
  resolucion, confirmando, onConfirmar, onCancelar, onBuscarEnPlaya, onCobrarExcepcion
}) {
  const { dominio, vehiculo, vehiculoNuevo, cliente, tarifa, inconsistencia, excepcion } = resolucion;
  const excepcionDisponible = excepcion?.disponible;

  const [tipoVehiculo, setTipoVehiculo] = useState(vehiculo?.tipo ?? 'auto');
  const [mostrarConductor, setMostrarConductor] = useState(false);
  const [conductor, setConductor] = useState({ nombre: '', telefono: '', documento: '' });
  const botonConfirmar = useRef(null);

  // El foco salta al botón: así el segundo Enter confirma sin que el operador toque nada.
  useEffect(() => { botonConfirmar.current?.focus(); }, []);

  // 1 y 2 eligen el tipo, cuando hay tipo que elegir.
  useEffect(() => {
    if (!vehiculoNuevo) return;
    const alPresionar = (evento) => {
      if (evento.target.tagName === 'INPUT') return;
      if (evento.key === '1') setTipoVehiculo('auto');
      if (evento.key === '2') setTipoVehiculo('moto');
    };
    window.addEventListener('keydown', alPresionar);
    return () => window.removeEventListener('keydown', alPresionar);
  }, [vehiculoNuevo]);

  const confirmar = () => {
    const datos = Object.fromEntries(
      Object.entries(conductor).filter(([, valor]) => valor.trim() !== '')
    );
    onConfirmar({
      tipoVehiculo,
      clienteOcasional: Object.keys(datos).length > 0 ? datos : undefined
    });
  };

  return (
    <div className="tarjeta tarjeta-ingreso">
      <p className="tarjeta-tipo">Ingreso</p>

      <p className="chapa tarjeta-patente">{dominio}</p>
      <p className="tarjeta-vehiculo">
        {/* Los registros viejos guardaron 'Sin datos' y 'S/D' como si fueran datos: la
            ausencia se muestra como ausencia, no como la cadena. */}
        {vehiculo
          ? [vehiculo.marca, vehiculo.modelo]
              .filter((v) => v && !['sin datos', 's/d'].includes(String(v).trim().toLowerCase()))
              .join(' ') || 'Vehículo conocido'
          : 'Vehículo nuevo'}
      </p>

      {inconsistencia && (
        <p className="tarjeta-advertencia" role="alert">
          Este vehículo figura como dentro pero no tiene estadía activa. Registrarlo de nuevo
          puede ser correcto; si el auto está saliendo, buscalo en vehículos dentro.
        </p>
      )}

      <dl className="tarjeta-datos">
        <div>
          <dt>Cliente</dt>
          {/* "Ocasional" es un tipo de cliente normal, no una advertencia: va en gris neutro. */}
          <dd>
            {cliente.tipo === 'registrado'
              ? <>{cliente.nombre} {cliente.apellido} <span className="chip">Registrado</span></>
              : <span className="chip">Ocasional</span>}
          </dd>
        </div>
        <div>
          <dt>Tarifa</dt>
          {/* El origen de la tarifa es lo que permite defender el importe frente al cliente. */}
          <dd className="numerico">
            ${tarifa.precioPorHora.toLocaleString('es-AR')}/h
            <span className="tarjeta-origen"> · {tarifa.etiqueta}</span>
          </dd>
        </div>
        {vehiculoNuevo && (
          <div>
            <dt>Tipo</dt>
            <dd>
              <div className="segmentado" role="group" aria-label="Tipo de vehículo">
                {['auto', 'moto'].map((valor, indice) => (
                  <button
                    key={valor}
                    type="button"
                    className={`segmento${tipoVehiculo === valor ? ' es-activo' : ''}`}
                    onClick={() => setTipoVehiculo(valor)}
                    aria-pressed={tipoVehiculo === valor}
                  >
                    {valor === 'auto' ? 'Auto' : 'Moto'}
                    <kbd>{indice + 1}</kbd>
                  </button>
                ))}
              </div>
            </dd>
          </div>
        )}
      </dl>

      {/* Los datos del conductor existen pero no estorban: el 90% de los ingresos no los toca. */}
      <button
        type="button"
        className="tarjeta-disclosure"
        onClick={() => setMostrarConductor((v) => !v)}
        aria-expanded={mostrarConductor}
      >
        <ChevronDown size={14} className={mostrarConductor ? 'abierto' : ''} aria-hidden />
        Datos del conductor
        <span className="tarjeta-opcional">opcional</span>
      </button>

      {mostrarConductor && (
        <div className="tarjeta-conductor">
          {[
            { campo: 'nombre', etiqueta: 'Nombre' },
            { campo: 'telefono', etiqueta: 'Teléfono' },
            { campo: 'documento', etiqueta: 'Documento' }
          ].map(({ campo, etiqueta }) => (
            <label key={campo}>
              <span>{etiqueta}</span>
              <input
                className="control"
                value={conductor[campo]}
                onChange={(e) => setConductor((c) => ({ ...c, [campo]: e.target.value }))}
                autoComplete="off"
              />
            </label>
          ))}
        </div>
      )}

      <button
        ref={botonConfirmar}
        type="button"
        className="boton-primario"
        onClick={confirmar}
        disabled={confirmando}
      >
        {confirmando ? 'Registrando…' : 'Confirmar ingreso'}
        <kbd>⏎</kbd>
      </button>

      {/* Las salidas se ofrecen en orden de probabilidad. Lo más común es que el auto recién
          llegue —por eso "Confirmar ingreso" es el botón grande—; después, que la patente se
          haya tipeado mal al entrar; y último, que no haya registro y haya que cobrar la
          excepción. Ponerla primero invitaría a cobrarla de más por comodidad. */}
      <div className="tarjeta-salidas">
        <p>¿El vehículo ya estaba adentro?</p>
        <button type="button" className="boton-texto" onClick={onBuscarEnPlaya} disabled={confirmando}>
          Buscar en vehículos dentro
        </button>
        {excepcionDisponible && (
          <button type="button" className="boton-texto" onClick={onCobrarExcepcion} disabled={confirmando}>
            Cobrar como estadía no registrada
          </button>
        )}
      </div>

      <button type="button" className="boton-texto" onClick={onCancelar} disabled={confirmando}>
        Cancelar <kbd>Esc</kbd>
      </button>
    </div>
  );
}
