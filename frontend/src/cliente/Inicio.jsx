import { Link } from 'react-router-dom';
import { SquareParking, Car, Clock, Receipt } from 'lucide-react';
import SEO from '../components/SEO';
import '../styles/tokens.css';
import '../styles/cliente.css';
import '../styles/inicio.css';

// INICIO — la superficie pública. Es la única pantalla del sistema cuyo trabajo es convencer,
// y por eso es también la más fácil de llenar de cosas que no son ciertas.
//
// Lo que decía la versión anterior y ya no existe: "solicitá comprobantes de pago para
// acreditar saldo" (la recarga se discontinuó), "iniciá estacionamientos desde cualquier
// portón" y "control de accesos por portones" (el portón se eliminó del modelo porque se
// escribía y no lo leía nadie), y "vigilancia 24/7 con seguridad garantizada", que nunca fue
// una funcionalidad del sistema sino una frase.
//
// Lo que queda es lo que el producto hace: registrás tus autos, el playero cobra la tarifa que
// te corresponde, y te llevás un comprobante numerado. Nada más, porque nada más es verdad.
export default function Inicio() {
  return (
    <div className="cliente">
      <SEO
        title="Inicio"
        description="Gestión de estadías de una playa de estacionamiento: registrá tus vehículos, consultá tu historial y pagá con la tarifa que te corresponde."
        keywords="estacionamiento, playa de estacionamiento, estadías, comprobante, tarifa"
        canonical="/"
      />

      <header className="inicio-barra">
        <span className="cliente-marca">
          <SquareParking size={24} aria-hidden />
          Estacionamiento
        </span>
        <nav className="inicio-barra-acciones">
          <Link className="cliente-boton cliente-boton-secundario inicio-boton-compacto" to="/login">Entrar</Link>
          <Link className="cliente-boton inicio-boton-compacto" to="/registro">Crear cuenta</Link>
        </nav>
      </header>

      <main>
        <section className="inicio-hero">
          <h1 className="inicio-titulo">Dejá el auto. Del resto nos ocupamos nosotros.</h1>
          <p className="inicio-bajada">
            Registrás tus vehículos una vez y cada estadía queda anotada a tu nombre: cuánto
            estuviste, cuánto pagaste y con qué comprobante.
          </p>
          <div className="inicio-acciones">
            <Link className="cliente-boton inicio-cta" to="/registro">Crear mi cuenta</Link>
            <Link className="cliente-enlace" to="/login">Ya tengo cuenta</Link>
          </div>
        </section>

        {/* Tres pasos numerados porque son una secuencia real y el orden es el dato: primero
            existís en el sistema, después entrás, y recién al salir pagás. */}
        <section className="inicio-pasos" aria-labelledby="como-funciona">
          <h2 id="como-funciona" className="inicio-seccion-titulo">Cómo funciona</h2>
          <ol className="pasos">
            <li className="paso">
              <span className="paso-numero numerico">1</span>
              <div>
                <h3 className="paso-titulo">Creás tu cuenta y cargás tus autos</h3>
                <p className="paso-texto">
                  Con tu DNI, tu correo y la patente. Podés tener varios vehículos en la misma
                  cuenta.
                </p>
              </div>
            </li>
            <li className="paso">
              <span className="paso-numero numerico">2</span>
              <div>
                <h3 className="paso-titulo">Dejás el auto en la playa</h3>
                <p className="paso-texto">
                  El playero registra el ingreso con tu patente. No hace falta que muestres nada
                  más: el sistema ya sabe que ese auto es tuyo.
                </p>
              </div>
            </li>
            <li className="paso">
              <span className="paso-numero numerico">3</span>
              <div>
                <h3 className="paso-titulo">Al retirarlo, pagás y te llevás el comprobante</h3>
                <p className="paso-texto">
                  Se cobra el tiempo real, redondeado hacia arriba por hora, con la tarifa que te
                  corresponde. En efectivo, tarjeta o QR.
                </p>
              </div>
            </li>
          </ol>
        </section>

        <section className="inicio-cuenta" aria-labelledby="tu-cuenta">
          <h2 id="tu-cuenta" className="inicio-seccion-titulo">Qué ves desde tu cuenta</h2>
          <ul className="cuenta-lista">
            <li>
              <Car size={18} aria-hidden />
              <div>
                <h3 className="cuenta-titulo">Tus vehículos</h3>
                <p className="cuenta-texto">Los autos y motos que tenés registrados, y cuál está adentro ahora.</p>
              </div>
            </li>
            <li>
              <Clock size={18} aria-hidden />
              <div>
                <h3 className="cuenta-titulo">Tu historial</h3>
                <p className="cuenta-texto">Cada estadía con su hora de ingreso, su duración y lo que se cobró.</p>
              </div>
            </li>
            <li>
              <Receipt size={18} aria-hidden />
              <div>
                <h3 className="cuenta-titulo">Tus comprobantes</h3>
                <p className="cuenta-texto">
                  Cada cobro emite un comprobante numerado. Son documentos internos de la playa,
                  no comprobantes fiscales.
                </p>
              </div>
            </li>
          </ul>
        </section>

        <section className="inicio-cierre">
          <p className="inicio-cierre-texto">Crear la cuenta lleva un minuto y es gratis.</p>
          <Link className="cliente-boton inicio-cta" to="/registro">Crear mi cuenta</Link>
        </section>
      </main>

      <footer className="inicio-pie">
        <span className="cliente-marca">
          <SquareParking size={18} aria-hidden />
          Estacionamiento
        </span>
        <nav className="inicio-pie-enlaces">
          <Link className="cliente-enlace" to="/login">Entrar</Link>
          <Link className="cliente-enlace" to="/registro">Crear cuenta</Link>
        </nav>
      </footer>
    </div>
  );
}
