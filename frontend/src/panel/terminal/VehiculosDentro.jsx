import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';

// 24 horas: la playa opera de noche y "04:10 p. m." obliga a traducir mentalmente.
const hora = (fecha) =>
  new Date(fecha).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });

const transcurrido = (desde, ahora) => {
  const minutos = Math.max(0, Math.floor((ahora - new Date(desde).getTime()) / 60000));
  return `${Math.floor(minutos / 60)}h ${String(minutos % 60).padStart(2, '0')}m`;
};

export default function VehiculosDentro({ activas, ocupacion, contadores, cargando, error, onReintentar, onCobrar }) {
  const [busqueda, setBusqueda] = useState('');

  // El tiempo se calcula en el cliente desde horaInicio y se refresca cada 30s. Cada segundo
  // sería ruido visual sin valor operativo.
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  const filtradas = useMemo(() => {
    const termino = busqueda.trim().toUpperCase();
    if (!termino) return activas;
    return activas.filter((estadia) => {
      const nombre = estadia.clienteOcasional?.nombre ?? '';
      return estadia.vehiculoDominio.includes(termino) || nombre.toUpperCase().includes(termino);
    });
  }, [activas, busqueda]);

  return (
    <section className="playa" aria-label="Vehículos dentro">
      <header className="playa-header">
        <div className="playa-ocupacion">
          <span className="playa-ocupacion-etiqueta">Adentro</span>
          <strong className="numerico playa-ocupacion-valor">
            {ocupacion?.dentro ?? activas.length}
            {/* Sin capacidad configurada no se inventa un denominador. */}
            {ocupacion?.capacidad != null && (
              <span className="playa-ocupacion-capacidad"> / {ocupacion.capacidad}</span>
            )}
          </strong>
          {ocupacion?.completa && <span className="chip chip-alerta">Playa completa</span>}
        </div>

        {/* Ritmo del turno: cuántos entraron y cuántos salieron desde que abrió. Es lo único
            que la caja ciega deja mostrar acá — cantidades, no plata. */}
        {contadores && (
          <p className="playa-ritmo">
            Turno: <strong className="numerico">{contadores.ingresosPlaya}</strong> entraron ·{' '}
            <strong className="numerico">{contadores.egresosPlaya}</strong> salieron
          </p>
        )}

        <div className="playa-buscar">
          <Search size={14} aria-hidden />
          <input
            id="buscar-en-playa"
            className="control"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar patente o cliente"
            aria-label="Buscar en vehículos dentro"
            autoComplete="off"
          />
        </div>
      </header>

      <div className="tabla-contenedor">
        <table className="tabla">
          <thead>
            <tr>
              <th scope="col">Patente</th>
              <th scope="col">Ingreso</th>
              <th scope="col">Tiempo</th>
              <th scope="col">Cliente</th>
              <th scope="col" className="col-accion"><span className="sr-only">Acciones</span></th>
            </tr>
          </thead>
          <tbody>
            {cargando && Array.from({ length: 6 }).map((_, i) => (
              // El esqueleto tiene la forma real de la tabla, no un bloque genérico.
              <tr key={`esqueleto-${i}`} className="fila-esqueleto">
                <td colSpan={5}><span className="esqueleto" /></td>
              </tr>
            ))}

            {!cargando && error && (
              <tr>
                <td colSpan={5} className="tabla-estado">
                  <p>{error}</p>
                  <button type="button" className="boton-secundario" onClick={onReintentar}>Reintentar</button>
                </td>
              </tr>
            )}

            {!cargando && !error && filtradas.length === 0 && (
              <tr>
                <td colSpan={5} className="tabla-estado">
                  {/* Vacío y "sin resultados" son estados distintos: dicen cosas distintas. */}
                  {activas.length === 0
                    ? <p>No hay vehículos en la playa. Escribí una patente para registrar el primer ingreso.</p>
                    : <p>Ningún vehículo coincide con «{busqueda}».</p>}
                </td>
              </tr>
            )}

            {!cargando && !error && filtradas.map((estadia) => (
              <tr key={estadia._id}>
                <td className="chapa">{estadia.vehiculoDominio}</td>
                <td className="numerico">{hora(estadia.horaInicio)}</td>
                <td className="numerico">{transcurrido(estadia.horaInicio, ahora)}</td>
                <td>
                  {estadia.usuarioDNI
                    ? (estadia.clienteOcasional?.nombre ?? 'Registrado')
                    : (estadia.clienteOcasional?.nombre ?? <span className="chip">Ocasional</span>)}
                </td>
                <td className="col-accion">
                  {/* La acción frecuente queda visible en la fila y carga la tarjeta de cobro
                      en la columna izquierda: no navega ni abre un modal. */}
                  <button
                    type="button"
                    className="boton-secundario"
                    onClick={() => onCobrar(estadia.vehiculoDominio)}
                  >
                    Cobrar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
