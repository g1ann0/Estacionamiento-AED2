import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listarActivas } from '../../services/administracionService';
import VehiculosDentro from '../terminal/VehiculosDentro';
import '../../styles/terminal.css';
import '../../styles/caja.css';

const REFRESCO_MS = 30000;

// PLAYA → VEHÍCULOS DENTRO. La misma tabla que la Terminal tiene a la derecha, acá con todo
// el ancho: sirve para mirar la playa, no para cobrar con el cliente enfrente.
//
// "Cobrar" no abre un formulario nuevo: manda a la Terminal con la patente resuelta, que es
// el único lugar donde se cobra. Dos pantallas que cobran son dos formas de cobrar mal.
export default function Dentro() {
  const navegar = useNavigate();
  const [activas, setActivas] = useState([]);
  const [ocupacion, setOcupacion] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const cargar = useCallback(async () => {
    try {
      const { activas: lista, ocupacion: datos } = await listarActivas();
      setActivas(lista);
      setOcupacion(datos);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
    const id = setInterval(cargar, REFRESCO_MS);
    return () => clearInterval(id);
  }, [cargar]);

  return (
    <div className="pantalla pantalla-turno">
      <header className="turno-encabezado">
        <div>
          <h1 className="pantalla-titulo">Vehículos dentro</h1>
          <p className="pantalla-bajada">
            El estado de la playa ahora mismo. Para cobrar, la fila lleva a la Terminal con la
            patente ya resuelta.
          </p>
        </div>
      </header>

      <VehiculosDentro
        activas={activas}
        ocupacion={ocupacion}
        cargando={cargando}
        error={error}
        onReintentar={cargar}
        onCobrar={(dominio) => navegar(`/admin?patente=${encodeURIComponent(dominio)}`)}
      />
    </div>
  );
}
