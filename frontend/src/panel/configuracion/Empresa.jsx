import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { obtenerEmpresa, guardarEmpresa, validarEmpresa } from '../../services/empresaService';
import { fecha } from '../formato';
import '../../styles/caja.css';

const CONDICIONES_IVA = [
  'IVA Responsable Inscripto',
  'IVA Responsable no Inscripto',
  'IVA no Responsable',
  'IVA Sujeto Exento',
  'Consumidor Final',
  'Responsable Monotributo',
  'Sujeto no Categorizado'
];

const soloFecha = (valor) => (valor ? new Date(valor).toISOString().slice(0, 10) : '');

// CONFIGURACIÓN → EMPRESA Y FACTURACIÓN. La última pantalla del panel que quedaba en el
// sistema viejo.
//
// Dos decisiones que la gobiernan:
//
//  1. **Nada fiscal se simula.** La integración con ARCA es la Etapa 6 y hoy no existe: todo
//     comprobante se emite como ticket no fiscal, sin CAE. Por eso el bloque de ARCA no
//     ofrece interruptores que no hacen nada — dice lo que hay y lo que falta, y se lee, no
//     se toca. Un switch "solicitud automática de CAE" que no solicita ningún CAE es una
//     mentira con apariencia de función.
//  2. **La validación es del negocio, no del formulario.** El backend responde si con estos
//     datos se podría facturar de verdad. Ese resultado va arriba de todo, antes que los
//     campos: es la única pregunta que el dueño trae a esta pantalla.
export default function Empresa() {
  const [empresa, setEmpresa] = useState(null);
  const [validacion, setValidacion] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);
  const [aviso, setAviso] = useState(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [datos, resultado] = await Promise.all([obtenerEmpresa(), validarEmpresa().catch(() => null)]);
      setEmpresa(datos);
      setValidacion(resultado);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const campo = (ruta) => {
    const partes = ruta.split('.');
    const valor = partes.reduce((objeto, clave) => objeto?.[clave], empresa) ?? '';
    return {
      value: valor,
      disabled: guardando,
      onChange: (evento) => {
        const nuevo = evento.target.value;
        setEmpresa((actual) => {
          const copia = structuredClone(actual);
          let destino = copia;
          for (const clave of partes.slice(0, -1)) destino = destino[clave];
          destino[partes.at(-1)] = nuevo;
          return copia;
        });
      }
    };
  };

  const guardar = async (evento) => {
    evento.preventDefault();
    setGuardando(true);
    setError(null);
    try {
      await guardarEmpresa(empresa);
      setAviso('Configuración guardada');
      // Se revalida después de guardar: el estado fiscal puede haber cambiado con la edición,
      // y mostrarlo desactualizado sería peor que no mostrarlo.
      setValidacion(await validarEmpresa().catch(() => null));
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  };

  if (cargando) return <p className="pantalla-cargando">Cargando la configuración…</p>;

  if (!empresa) {
    return (
      <div className="pantalla">
        <h1 className="pantalla-titulo">Empresa y facturación</h1>
        {error && <p className="mensaje-error" role="alert">{error}</p>}
        <button type="button" className="boton-secundario" onClick={cargar}>Reintentar</button>
      </div>
    );
  }

  return (
    <div className="pantalla pantalla-formulario">
      {aviso && (
        <p className="mensaje-exito" role="status">
          {aviso}
          <button type="button" className="mensaje-cerrar" onClick={() => setAviso(null)} aria-label="Cerrar">×</button>
        </p>
      )}

      <header className="turno-encabezado">
        <div>
          <h1 className="pantalla-titulo">Empresa y facturación</h1>
          <p className="pantalla-bajada">
            Los datos del emisor que salen impresos en cada comprobante.
          </p>
        </div>
      </header>

      {error && <p className="mensaje-error" role="alert">{error}</p>}

      {/* El veredicto va antes que los campos: es lo que el dueño vino a preguntar. */}
      {validacion && (
        <div className={`veredicto${validacion.esValida ? ' es-valido' : ''}`}>
          <p className="veredicto-titulo">
            {validacion.esValida
              ? <><CheckCircle2 size={15} aria-hidden /> Los datos alcanzan para facturar</>
              : <><AlertTriangle size={15} aria-hidden /> Faltan datos para poder facturar</>}
          </p>
          {validacion.errores?.length > 0 && (
            <ul className="veredicto-lista">
              {validacion.errores.map((mensaje) => <li key={mensaje}>{mensaje}</li>)}
            </ul>
          )}
          {validacion.advertencias?.length > 0 && (
            <ul className="veredicto-lista es-advertencia">
              {validacion.advertencias.map((mensaje) => <li key={mensaje}>{mensaje}</li>)}
            </ul>
          )}
        </div>
      )}

      <form className="formulario" onSubmit={guardar}>
        <fieldset className="formulario-bloque">
          <legend>Identificación fiscal</legend>

          <label className="campo">
            <span>Razón social</span>
            <input className="control" {...campo('razonSocial')} required />
          </label>

          <div className="formulario-fila">
            <label className="campo">
              <span>CUIT</span>
              <input className="control numerico" placeholder="20-12345678-9" {...campo('cuit')} required />
              <em>Formato XX-XXXXXXXX-X, con dígito verificador válido.</em>
            </label>

            <label className="campo">
              <span>Inicio de actividades</span>
              <input
                className="control"
                type="date"
                value={soloFecha(empresa.inicioActividades)}
                disabled={guardando}
                onChange={(e) => setEmpresa((actual) => ({ ...actual, inicioActividades: e.target.value }))}
                required
              />
            </label>
          </div>

          <label className="campo">
            <span>Condición frente al IVA</span>
            <select className="control" {...campo('condicionIva')}>
              {CONDICIONES_IVA.map((condicion) => <option key={condicion} value={condicion}>{condicion}</option>)}
            </select>
          </label>
        </fieldset>

        <fieldset className="formulario-bloque">
          <legend>Domicilio fiscal</legend>

          <div className="formulario-fila">
            <label className="campo campo-ancho">
              <span>Calle</span>
              <input className="control" {...campo('domicilio.calle')} required />
            </label>
            <label className="campo">
              <span>Número</span>
              <input className="control numerico" {...campo('domicilio.numero')} required />
            </label>
            <label className="campo">
              <span>Piso <em>opcional</em></span>
              <input className="control" {...campo('domicilio.piso')} />
            </label>
            <label className="campo">
              <span>Depto. <em>opcional</em></span>
              <input className="control" {...campo('domicilio.departamento')} />
            </label>
          </div>

          <div className="formulario-fila">
            <label className="campo">
              <span>Localidad</span>
              <input className="control" {...campo('domicilio.localidad')} required />
            </label>
            <label className="campo">
              <span>Provincia</span>
              <input className="control" {...campo('domicilio.provincia')} required />
            </label>
            <label className="campo">
              <span>Código postal</span>
              <input className="control numerico" {...campo('domicilio.codigoPostal')} required />
            </label>
          </div>
        </fieldset>

        <fieldset className="formulario-bloque">
          <legend>Contacto</legend>
          <div className="formulario-fila">
            <label className="campo">
              <span>Teléfono</span>
              <input className="control" {...campo('contacto.telefono')} />
            </label>
            <label className="campo">
              <span>Correo</span>
              <input className="control" type="email" {...campo('contacto.email')} />
            </label>
            <label className="campo">
              <span>Sitio web</span>
              <input className="control" {...campo('contacto.sitioWeb')} />
            </label>
          </div>
        </fieldset>

        <fieldset className="formulario-bloque">
          <legend>Numeración</legend>
          <div className="formulario-fila">
            <label className="campo">
              <span>Punto de venta</span>
              <input className="control numerico" placeholder="00001" {...campo('puntoVenta')} required />
              <em>Cinco dígitos. Es el prefijo de todo comprobante emitido.</em>
            </label>
          </div>
        </fieldset>

        <div className="formulario-acciones">
          <button type="submit" className="boton-primario boton-cobrar" disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar configuración'}
          </button>
          {empresa.fechaActualizacion && (
            <span className="texto-sutil">
              Última modificación: {fecha(empresa.fechaActualizacion)}
              {empresa.actualizadoPor?.nombre ? ` por ${empresa.actualizadoPor.nombre} ${empresa.actualizadoPor.apellido ?? ''}` : ''}
            </span>
          )}
        </div>
      </form>

      {/* Estado real de la integración fiscal. Se lee, no se toca: mientras ARCA no exista,
          ofrecer switches acá sería vender una función que no está. */}
      <section className="formulario-bloque bloque-informativo" aria-label="Estado de la facturación electrónica">
        <h2 className="bloque-titulo">Facturación electrónica (ARCA)</h2>
        <p className="pantalla-bajada">
          <strong>No está habilitada.</strong> Hoy cada cobro emite un ticket no fiscal, sin CAE.
          La integración con ARCA es una etapa pendiente del plan; hasta que exista, ningún
          comprobante de este sistema tiene validez fiscal y la interfaz no va a decir lo contrario.
        </p>
        <dl className="cierre-resumen">
          <div>
            <dt>Certificado digital</dt>
            <dd>{empresa.arca?.certificadoDigital?.activo ? 'Cargado' : 'Sin cargar'}</dd>
          </div>
          <div>
            <dt>Alias del certificado</dt>
            <dd>{empresa.arca?.certificadoDigital?.alias || '—'}</dd>
          </div>
          <div>
            <dt>Tipo de comprobante que se emite</dt>
            <dd>Ticket no fiscal</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
