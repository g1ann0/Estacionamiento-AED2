import { useCallback, useEffect, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { obtenerCuenta, estadoDeVehiculo, agregarVehiculo } from '../services/conductorService';
import { duracionEntre, hora, pesos } from '../panel/formato';
import '../styles/panelConductor.css';

const REFRESCO_MS = 60000;

const PLACEHOLDERS = ['sin datos', 's/d', 'n/a', ''];
const real = (valor) => (valor && !PLACEHOLDERS.includes(String(valor).trim().toLowerCase()) ? valor : null);

// PANEL DEL CONDUCTOR. Una pregunta arriba de todo: ¿tengo un auto adentro?
//
// El resto —mis vehículos, mi saldo— es contexto. Alguien que abre esta app en el celular
// casi siempre lo hace por lo mismo: saber si dejó el auto y desde cuándo.
//
// No cobra ni registra ingresos: eso pasa en el mostrador, con el playero, que es lo que la
// página de inicio le promete al cliente. Una app que también pudiera marcar ingresos crearía
// dos verdades sobre el mismo auto.
export default function Panel() {
  const { usuario: sesion } = useOutletContext();

  const [cuenta, setCuenta] = useState(null);
  const [adentro, setAdentro] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [aviso, setAviso] = useState(null);

  const [guardando, setGuardando] = useState(false);
  const [errorAlta, setErrorAlta] = useState(null);
  const [formulario, setFormulario] = useState({ dominio: '', tipo: 'auto', marca: '', modelo: '' });
  const dialogo = useRef(null);

  // El tiempo se recalcula en el cliente cada minuto: en una estadía de horas, el segundero
  // es ruido y obliga a repintar la pantalla sesenta veces por minuto en un celular.
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), REFRESCO_MS);
    return () => clearInterval(id);
  }, []);

  const cargar = useCallback(async () => {
    if (!sesion?.dni) return;
    try {
      const datos = await obtenerCuenta(sesion.dni);
      const usuario = datos.usuario ?? datos;
      setCuenta(usuario);

      const vehiculos = usuario.vehiculos ?? [];
      const estados = await Promise.all(
        vehiculos.map(async (vehiculo) => {
          const estadia = await estadoDeVehiculo(vehiculo.dominio).catch(() => null);
          return estadia ? { ...vehiculo, estadia } : null;
        })
      );
      setAdentro(estados.filter(Boolean));
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }, [sesion?.dni]);

  useEffect(() => { cargar(); }, [cargar]);

  const guardar = async (evento) => {
    evento.preventDefault();
    setGuardando(true);
    setErrorAlta(null);
    try {
      await agregarVehiculo({
        dni: sesion.dni,
        dominio: formulario.dominio.toUpperCase().trim(),
        tipo: formulario.tipo,
        marca: formulario.marca.trim(),
        modelo: formulario.modelo.trim()
      });
      dialogo.current?.close();
      setAviso(`${formulario.dominio.toUpperCase()} quedó registrado en tu cuenta`);
      setFormulario({ dominio: '', tipo: 'auto', marca: '', modelo: '' });
      await cargar();
    } catch (e) {
      setErrorAlta(e.message);
    } finally {
      setGuardando(false);
    }
  };

  const campo = (clave) => ({
    value: formulario[clave],
    disabled: guardando,
    onChange: (e) => setFormulario((actual) => ({ ...actual, [clave]: e.target.value }))
  });

  if (cargando) return <p className="conductor-cargando">Cargando tu cuenta…</p>;

  const vehiculos = cuenta?.vehiculos ?? [];
  const saldo = cuenta?.montoDisponible ?? 0;

  return (
    <div className="conductor">
      {aviso && <p className="cliente-exito" role="status">{aviso}</p>}
      {error && <p className="cliente-error" role="alert">{error}</p>}

      <h1 className="cliente-titulo">Hola, {sesion?.nombre ?? 'qué tal'}</h1>

      {/* La respuesta primero, y en el tamaño de la pregunta. */}
      <section className="estado" aria-label="Estado de tus vehículos">
        {adentro.length === 0 ? (
          <p className="estado-vacio">
            No tenés ningún vehículo en la playa ahora.
          </p>
        ) : (
          adentro.map(({ dominio, estadia }) => (
            <article key={dominio} className="estado-tarjeta">
              <p className="cliente-etiqueta">Adentro</p>
              <p className="chapa estado-patente">{dominio}</p>
              <dl className="estado-datos">
                <div>
                  <dt>Desde</dt>
                  <dd className="numerico">{hora(estadia.horaInicio)}</dd>
                </div>
                <div>
                  <dt>Hace</dt>
                  <dd className="numerico">{duracionEntre(estadia.horaInicio, ahora)}</dd>
                </div>
              </dl>
              <p className="estado-nota">Se paga al retirarlo, en la playa.</p>
            </article>
          ))
        )}
      </section>

      <section aria-label="Tus vehículos">
        <div className="conductor-seccion-header">
          <h2 className="conductor-seccion-titulo">Tus vehículos</h2>
          <button type="button" className="conductor-agregar" onClick={() => { setErrorAlta(null); dialogo.current?.showModal(); }}>
            <Plus size={16} aria-hidden /> Agregar
          </button>
        </div>

        {vehiculos.length === 0 ? (
          <p className="conductor-vacio">
            Todavía no cargaste ningún vehículo. Agregá el tuyo para que la playa lo reconozca
            por la patente.
          </p>
        ) : (
          <ul className="vehiculos">
            {vehiculos.map((vehiculo) => {
              const estaAdentro = adentro.some((v) => v.dominio === vehiculo.dominio);
              const detalle = [real(vehiculo.marca), real(vehiculo.modelo)].filter(Boolean).join(' ');
              return (
                <li key={vehiculo.dominio} className="vehiculo">
                  <span className="chapa vehiculo-patente">{vehiculo.dominio}</span>
                  <span className="vehiculo-detalle">
                    {vehiculo.tipo === 'moto' ? 'Moto' : 'Auto'}
                    {detalle && ` · ${detalle}`}
                  </span>
                  {estaAdentro && <span className="vehiculo-estado">En la playa</span>}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* El saldo solo aparece si existe. Mostrar "$0" en una cuenta sin saldo sería ofrecer
          una funcionalidad que ya no admite recargas: sería publicidad de algo que se cerró. */}
      {saldo > 0 && (
        <section className="saldo" aria-label="Tu saldo">
          <div>
            <p className="cliente-etiqueta">Saldo disponible</p>
            <p className="numerico saldo-monto">{pesos(saldo)}</p>
          </div>
          <p className="saldo-nota">
            Se usa como medio de pago hasta agotarse. Las recargas están discontinuadas: hoy se
            paga al retirar el vehículo.
          </p>
        </section>
      )}

      <dialog ref={dialogo} className="conductor-dialogo" aria-labelledby="alta-vehiculo-titulo">
        <form className="conductor-dialogo-cuerpo" onSubmit={guardar}>
          <h2 id="alta-vehiculo-titulo" className="cliente-titulo">Agregar vehículo</h2>

          {errorAlta && <p className="cliente-error" role="alert">{errorAlta}</p>}

          <label className="cliente-campo">
            <span>Patente</span>
            <input
              className="cliente-control chapa"
              {...campo('dominio')}
              onChange={(e) => setFormulario((actual) => ({ ...actual, dominio: e.target.value.toUpperCase() }))}
              placeholder="AB123CD"
              autoComplete="off"
              required
              autoFocus
            />
          </label>

          <label className="cliente-campo">
            <span>Tipo</span>
            <select className="cliente-control" {...campo('tipo')}>
              <option value="auto">Auto</option>
              <option value="moto">Moto</option>
            </select>
          </label>

          <label className="cliente-campo">
            <span>Marca <em>opcional</em></span>
            <input className="cliente-control" {...campo('marca')} />
          </label>

          <label className="cliente-campo">
            <span>Modelo <em>opcional</em></span>
            <input className="cliente-control" {...campo('modelo')} />
          </label>

          <div className="conductor-dialogo-acciones">
            <button type="button" className="cliente-boton cliente-boton-secundario" onClick={() => dialogo.current?.close()} disabled={guardando}>
              Cancelar
            </button>
            <button type="submit" className="cliente-boton" disabled={guardando}>
              {guardando ? 'Guardando…' : 'Agregar'}
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
