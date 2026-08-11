import { Link } from 'react-router-dom';
import { SquareParking } from 'lucide-react';
import SEO from '../components/SEO';
import '../styles/tokens.css';
import '../styles/cliente.css';

// Marco compartido de las pantallas de acceso: registro, recuperación y seteo de contraseña.
// Las cinco son la misma forma —marca, un título que dice qué está pasando, un formulario
// corto y una salida— y por eso comparten envase en vez de repetirlo cinco veces.
export default function Marco({ titulo, bajada, seo, children, pie }) {
  return (
    <div className="cliente">
      {seo && <SEO {...seo} />}

      <div className="acceso">
        <div className="acceso-caja">
          <Link to="/" className="acceso-marca">
            <SquareParking size={26} aria-hidden />
            <span>Estacionamiento</span>
          </Link>

          <div>
            <h1 className="cliente-titulo">{titulo}</h1>
            {bajada && <p className="cliente-bajada">{bajada}</p>}
          </div>

          {children}

          {pie && <p className="acceso-pie">{pie}</p>}
        </div>
      </div>
    </div>
  );
}
